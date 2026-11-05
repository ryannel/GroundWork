import 'server-only';

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { permalinkOf } from '@/domain/code-links';
import type { DiscoveryCandidate, DiscoveryInventory } from '@/domain/scan/discovery-types';

import { discoveryEntry, discoverySelection, discoveryScopes } from './discovery-inventory-rules';
import {
  discoveryDigest,
  readDiscoveryBytes,
  type DiscoverySource,
} from './discovery-inventory-source';
import type { InterpretationInputManifest } from './interpretation-inputs';

export const DISCOVERY_PACKET_LIMITS = { fileBytes: 262_144, totalBytes: 33_554_432, files: 4096 };
interface PacketFile {
  readonly path: string;
  readonly context_id: string | null;
  readonly basis: string;
  readonly state: 'retained' | 'git' | 'missing';
  readonly reason: string | null;
}
interface Packet {
  readonly candidate_id: string;
  readonly root: string;
  readonly manifests: readonly string[];
  readonly entry_candidates: readonly string[];
  readonly selected: readonly PacketFile[];
  readonly frontiers: readonly string[];
}
interface StoredContext {
  readonly id: string;
  readonly sha256: string;
  readonly lines: number;
  readonly bytes: number;
}
function createPacketState() {
  const inputs: InterpretationInputManifest['inputs'] = [];
  const stored = new Map<string, StoredContext>();
  return {
    inputs,
    get: (filename: string) => stored.get(filename),
    set: (filename: string, context: StoredContext) => stored.set(filename, context),
    bytes: () => [...stored.values()].reduce((total, entry) => total + entry.bytes, 0),
    files: () => stored.size,
  };
}
type PacketState = ReturnType<typeof createPacketState>;
type Evidence = DiscoveryCandidate['evidence'][number];
function evidenceFor(input: {
  readonly source: DiscoverySource;
  readonly selection: ReturnType<typeof discoverySelection>[number];
  readonly context: { readonly id: string; readonly sha256: string; readonly lines: number };
}): Evidence {
  return {
    kind: 'context_snapshot',
    context_id: input.context.id,
    path: input.selection.file.path,
    commit: input.source.commit,
    sha256: input.context.sha256,
    lines: [1, input.context.lines],
    basis: input.selection.basis,
  };
}
function unavailable(
  file: ReturnType<typeof discoverySelection>[number],
  reason: string,
): PacketFile {
  return { path: file.file.path, context_id: null, basis: file.basis, state: 'missing', reason };
}
async function storeContext(input: {
  readonly output: string;
  readonly relative: string;
  readonly bytes: Buffer;
  readonly persist: boolean;
}): Promise<void> {
  if (!input.persist) return;
  await writeFile(path.join(input.output, input.relative), input.bytes, { flag: 'wx' }).catch(
    (error: unknown) => {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
    },
  );
}
async function contextFile(input: {
  readonly source: DiscoverySource;
  readonly output: string;
  readonly selection: ReturnType<typeof discoverySelection>[number];
  readonly state: PacketState;
  readonly persist?: boolean;
}): Promise<{ readonly packet: PacketFile; readonly evidence: Evidence | null }> {
  const { source, output, selection, state } = input;
  const existing = state.get(selection.file.path);
  if (existing !== undefined) {
    return {
      packet: {
        path: selection.file.path,
        context_id: existing.id,
        basis: selection.basis,
        state: 'retained',
        reason: null,
      },
      evidence: evidenceFor({ source, selection, context: existing }),
    };
  }
  const reason = limitReason(selection.file.bytes, state);
  if (reason !== null) return { packet: unavailable(selection, reason), evidence: null };
  const { bytes, origin } = await readDiscoveryBytes(source, selection.file);
  const text = bytes.toString('utf8');
  if (bytes.includes(0) || !Buffer.from(text).equals(bytes)) {
    return {
      packet: unavailable(selection, 'Binary/NUL or invalid UTF-8; no context substituted.'),
      evidence: null,
    };
  }
  const sha256 = discoveryDigest(bytes);
  const identity = discoveryDigest([source.repo, source.commit, selection.file.path].join(':'));
  const id = `context:${identity.slice(0, 24)}`;
  const relative = `contexts/${sha256}.txt`;
  await storeContext({ output, relative, bytes, persist: input.persist !== false });
  const context = { id, sha256, lines: Math.max(1, text.split('\n').length), bytes: bytes.length };
  state.set(selection.file.path, context);
  state.inputs.push({
    kind: 'context_snapshot',
    id,
    path: relative,
    uri: permalinkOf({ ...source, path: selection.file.path }, { encoding: 'raw' }),
    revision: source.commit,
  });
  return {
    packet: {
      path: selection.file.path,
      context_id: id,
      basis: selection.basis,
      state: origin,
      reason: null,
    },
    evidence: evidenceFor({ source, selection, context }),
  };
}
function limitReason(bytes: number, state: PacketState): string | null {
  if (!Number.isSafeInteger(bytes) || bytes < 0) return 'Invalid object size; source not read.';
  if (bytes > DISCOVERY_PACKET_LIMITS.fileBytes) {
    return 'Full file exceeds per-context byte bound; source not read.';
  }
  if (state.bytes() + bytes > DISCOVERY_PACKET_LIMITS.totalBytes) {
    return 'Total context byte bound exhausted; source not read.';
  }
  return state.files() >= DISCOVERY_PACKET_LIMITS.files
    ? 'Context-file count bound exhausted; source not read.'
    : null;
}
function packetSelection(
  scope: ReturnType<typeof discoveryScopes>[number],
  extraPaths: readonly string[] | undefined,
) {
  const planned = new Map(
    discoverySelection(scope).map((selection) => [selection.file.path, selection]),
  );
  for (const file of scope.files.filter((item) => extraPaths?.includes(item.path) === true)) {
    if (!planned.has(file.path)) {
      planned.set(file.path, {
        file,
        basis: discoveryEntry(file.path) ? 'entry' : 'implementation',
      });
    }
  }
  return [...planned.values()];
}
async function scopePacket(input: {
  readonly source: DiscoverySource;
  readonly output: string;
  readonly scope: ReturnType<typeof discoveryScopes>[number];
  readonly state: PacketState;
  readonly persist?: boolean;
  readonly extraPaths?: readonly string[];
}): Promise<{ readonly candidate: DiscoveryCandidate; readonly packet: Packet }> {
  const identity = discoveryDigest([input.source.repo, input.scope.root].join(':'));
  const id = `candidate:${identity.slice(0, 24)}`;
  const selected = await packetSelection(input.scope, input.extraPaths).reduce<
    Promise<Awaited<ReturnType<typeof contextFile>>[]>
  >(
    async (previous, selection) => [
      ...(await previous),
      await contextFile({ ...input, selection }),
    ],
    Promise.resolve([]),
  );
  const entries = input.scope.files
    .filter((file) => discoveryEntry(file.path))
    .map((file) => file.path);
  const inspected = new Set(
    selected.filter((item) => item.evidence !== null).map((item) => item.packet.path),
  );
  const frontiers = entries.filter((filename) => !inspected.has(filename));
  return {
    candidate: {
      id,
      kind: 'boundary',
      root: input.scope.root,
      evidence: selected.flatMap((item) => (item.evidence === null ? [] : [item.evidence])),
    },
    packet: {
      candidate_id: id,
      root: input.scope.root,
      manifests: input.scope.manifests.map((file) => file.path),
      entry_candidates: entries,
      selected: selected.map((item) => item.packet),
      frontiers: [
        ...frontiers.map((filename) => `Entry candidate needs deeper evidence: ${filename}`),
        'Path discovery is conservative; unsupported framework entries and unselected implementation remain unexamined.',
        ...selected.flatMap((item) =>
          item.packet.reason === null ? [] : [`${item.packet.path}: ${item.packet.reason}`],
        ),
      ],
    },
  };
}
function discoveryCandidates(
  repo: string,
  item: Awaited<ReturnType<typeof scopePacket>>,
): readonly DiscoveryCandidate[] {
  return [
    item.candidate,
    ...item.packet.entry_candidates.map((filename): DiscoveryCandidate => ({
      id: `entry:${discoveryDigest([repo, filename].join(':')).slice(0, 24)}`,
      kind: 'entry',
      root: filename,
      evidence: item.candidate.evidence.filter(
        (evidence) => evidence.kind === 'context_snapshot' && evidence.path === filename,
      ),
    })),
  ];
}
function targetSnapshotSha(source: DiscoverySource, state: PacketState): string {
  if (source.snapshot !== null) return source.snapshotSha256;
  const first = state.inputs.find((item) => item.kind === 'context_snapshot');
  return first === undefined ? '' : path.basename(first.path, '.txt');
}
function targetSnapshotState(source: DiscoverySource, state: PacketState): string {
  if (source.snapshot !== null) return 'existing_pinned_source';
  return state.inputs.length === 0
    ? 'missing_no_native_or_canonical_context'
    : 'canonical_context_only_no_native_scan';
}
/** Full source files remain bounded and unchanged; candidate counts never imply runtime proof. */
export async function buildDiscoveryPackets(input: {
  readonly source: DiscoverySource;
  readonly output: string;
  readonly analysisVersion: string;
  readonly extraPaths?: readonly string[];
  readonly persist?: boolean;
}): Promise<{
  readonly inventory: DiscoveryInventory;
  readonly packets: unknown;
  readonly inputs: InterpretationInputManifest;
}> {
  if (input.persist !== false) await mkdir(path.join(input.output, 'contexts'));
  const state = createPacketState();
  if (input.source.snapshot !== null) {
    state.inputs.push({
      kind: 'scan_snapshot',
      id: 'scan:target',
      path: path.relative(input.output, input.source.snapshot),
    });
  }
  if ((input.extraPaths?.length ?? 0) > 4096) throw new Error('Context path count exceeds 4096.');
  if (new Set(input.extraPaths).size !== (input.extraPaths?.length ?? 0)) {
    throw new Error('Context paths contain duplicates.');
  }
  const scopes = discoveryScopes(input.source.files);
  const ownedPaths = new Set(scopes.flatMap((scope) => scope.files.map((file) => file.path)));
  if (input.extraPaths?.some((filename) => !ownedPaths.has(filename)) === true) {
    throw new Error('Explicit discovery context path is outside the pinned candidate scopes.');
  }
  const results = await scopes.reduce<Promise<Awaited<ReturnType<typeof scopePacket>>[]>>(
    async (previous, scope) => [...(await previous), await scopePacket({ ...input, scope, state })],
    Promise.resolve([]),
  );
  const base = {
    repo: input.source.repo,
    commit: input.source.commit,
    analysis_version: input.analysisVersion,
    snapshot_sha256: targetSnapshotSha(input.source, state),
    candidates: results.flatMap((item) => discoveryCandidates(input.source.repo, item)),
  };
  return {
    inventory: { ...base, sha256: discoveryDigest(JSON.stringify(base)) },
    packets: {
      format: 'scan-discovery-packets/v1',
      repo: base.repo,
      commit: base.commit,
      limits: DISCOVERY_PACKET_LIMITS,
      used: { bytes: state.bytes(), files: state.files() },
      targetSnapshot: targetSnapshotState(input.source, state),
      packets: results.map((item) => item.packet),
      modelCalls: 0,
      semanticAcceptance: 'not_established',
    },
    inputs: { format: 'scan-interpretation-inputs/v1', inputs: state.inputs },
  };
}
