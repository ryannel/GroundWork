import 'server-only';

import { createHash } from 'node:crypto';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

import { z } from 'zod';

import type { EntryHistory, HistoricalAddress } from '@/application/entry-history';
import { explorerServiceOverview } from '@/application/explorer-service-overview';
import { kindOf, stripPrefix } from '@/domain/ids';
import { explorerPage } from '@/domain/service-explorer-check';

import { pathIn, readBoundedBytes, realPathOf } from './disk';
import { workspaceFolder } from './workspace-folders';

const FORMAT = 'groundwork-entry-history/v1';
const file = z.string().regex(/^page-[a-f0-9]{24}\.json$/u);
const checksum = z.strictObject({
  bytes: z
    .int()
    .min(1)
    .max(4 * 1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/u),
});
const identity = z.strictObject({
  publication: z.enum(['live', 'fallback']),
  service: z.string().min(1),
  name: z.string().min(1),
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/u),
  commit: z.string().regex(/^[a-f0-9]{40}$/u),
});
const selection = checksum.extend({
  ...identity.shape,
  key: z.string().regex(/^[a-f0-9]{32}$/u),
});
const bucket = checksum.extend({ bucket: z.string().regex(/^[a-f0-9]{1,6}$/u) });
const storedPage = checksum.extend({ file, kind: z.enum(['overview', 'flow', 'data', 'callers']) });
const index = z.strictObject({
  format: z.literal(FORMAT),
  scopes: z.array(selection).max(400),
  packs: z.array(bucket).max(256),
});
const scope = identity.extend({
  format: z.literal(FORMAT),
  overview: file,
  callers: file,
  sourceIndex: file.optional(),
  interpretationIndex: file.optional(),
  entries: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        label: z.string().min(1),
        file,
        native: z
          .string()
          .refine((id) =>
            ['endpoint', 'subscription', 'job', 'interaction'].includes(kindOf(id) ?? ''),
          )
          .nullable(),
      }),
    )
    .max(500),
  pages: z.array(storedPage),
  retired: z.array(bucket).max(1024),
  direct: z.array(bucket).max(1024).optional(),
  complete: z.boolean().optional(),
});
const retiredPages = z.array(
  z.strictObject({
    file,
    title: z.string(),
    sources: z.array(
      z.strictObject({ label: z.string(), url: z.string().regex(/^https:\/\/\S+$/u) }),
    ),
  }),
);
const packedPages = z.record(z.string(), z.string());
const directPages = z.array(storedPage.extend({ raw: z.string() }));
type DirectPage = z.infer<typeof directPages>[number];
type Bucket = z.infer<typeof bucket>;
type Selection = z.infer<typeof selection>;
type Scope = z.infer<typeof scope>;
type Checksum = z.infer<typeof checksum>;

async function archiveFile(folder: string, parts: readonly string[], bound: number) {
  const target = await realPathOf(pathIn(folder, 'evidence-archive', 'entries', ...parts));
  if (target === null) return null;
  if (!target.startsWith(folder + path.sep)) {
    throw new Error('Historical archive path escaped its workspace.');
  }
  return readBoundedBytes(target, bound);
}
async function verified(folder: string, parts: readonly string[], expected: Checksum) {
  const raw = await archiveFile(folder, parts, expected.bytes);
  if (
    raw?.length !== expected.bytes ||
    createHash('sha256').update(raw).digest('hex') !== expected.sha256
  ) {
    throw new Error('Historical entry archive checksum changed.');
  }
  return raw;
}
async function checkedPack(
  folder: string,
  parts: readonly string[],
  expected: Checksum,
): Promise<unknown> {
  const raw = await verified(folder, parts, expected);
  return JSON.parse(gunzipSync(raw, { maxOutputLength: 4 * 1024 * 1024 }).toString('utf8'));
}
function bucketFor(groups: readonly Bucket[], page: string): Bucket | undefined {
  return groups.find((row) => page.startsWith(row.bucket, 5));
}
async function directPage(folder: string, selected: Selection, data: Scope, page: string) {
  const group = bucketFor(data.direct ?? [], page);
  if (group === undefined) return null;
  const contents = await checkedPack(
    folder,
    ['direct', selected.key, `${group.bucket}.json.gz`],
    group,
  );
  return directPages.parse(contents).find((row) => row.file === page) ?? null;
}
async function retiredPage(folder: string, selected: Selection, data: Scope, page: string) {
  const group = bucketFor(data.retired, page);
  if (group === undefined) return null;
  const contents = await checkedPack(
    folder,
    ['scopes', selected.key, `${group.bucket}.json.gz`],
    group,
  );
  return retiredPages.parse(contents).find((row) => row.file === page) ?? null;
}
async function readScope(folder: string, selected: Selection): Promise<Scope> {
  const raw = await verified(folder, ['scopes', `${selected.key}.json`], selected);
  const value = scope.parse(JSON.parse(raw.toString('utf8')));
  if (
    value.repo !== selected.repo ||
    value.commit !== selected.commit ||
    value.service !== selected.service ||
    value.publication !== selected.publication
  ) {
    throw new Error('Historical entry scope or pin changed.');
  }
  return value;
}
function selectionsFor(scopes: readonly Selection[], address: HistoricalAddress) {
  if (address.scope !== undefined) return scopes.filter((row) => row.key === address.scope);
  if (address.service === undefined) {
    const first = scopes[0];
    return first === undefined
      ? []
      : [first, ...scopes.filter((row) => row !== first && row.publication === 'fallback')];
  }
  const exact = scopes.filter((row) => row.service === address.service);
  const compatible = scopes.filter(
    (row) =>
      row.service !== address.service &&
      stripPrefix(row.service, 'svc') === stripPrefix(address.service, 'svc'),
  );
  const matched = [...exact, ...compatible];
  if (address.page === undefined || matched.length === 0) return matched;
  return [
    ...matched,
    ...scopes.filter((row) => row.publication === 'fallback' && !matched.includes(row)),
  ];
}
async function selectScope(
  folder: string,
  candidates: readonly Selection[],
  page: string | undefined,
) {
  const scopes = await Promise.all(
    candidates.map(async (candidate) => {
      const data = await readScope(folder, candidate);
      const stored = page === undefined || data.pages.some((item) => item.file === page);
      const direct = stored ? null : await directPage(folder, candidate, data, page);
      const matched =
        stored || direct !== null || (await retiredPage(folder, candidate, data, page)) !== null;
      return { selection: candidate, scope: data, matched, direct };
    }),
  );
  const matches = scopes.filter((row) => row.matched);
  const matchingOwner =
    matches.find((row) => row.selection.publication === 'live') ??
    matches.find((row) => row.direct === null);
  return matchingOwner ?? matches[0] ?? scopes[0] ?? null;
}
async function storedPageBytes(folder: string, packs: readonly Bucket[], sha256: string) {
  const pack = packs.find((row) => row.bucket === sha256.slice(0, 2));
  if (pack === undefined) throw new Error('Missing historical entry object pack.');
  const values = packedPages.parse(
    await checkedPack(folder, ['objects', `${pack.bucket}.json.gz`], pack),
  );
  return values[sha256];
}

async function checkedHistoricalPage(
  folder: string,
  packs: readonly Bucket[],
  stored: z.infer<typeof storedPage>,
  direct: string | undefined,
) {
  const raw = direct ?? (await storedPageBytes(folder, packs, stored.sha256));
  if (
    raw === undefined ||
    Buffer.byteLength(raw) !== stored.bytes ||
    createHash('sha256').update(raw).digest('hex') !== stored.sha256
  ) {
    throw new Error('Historical entry page checksum changed.');
  }
  const original = explorerPage(JSON.parse(raw));
  if (original.kind !== stored.kind) throw new Error('Historical page kind changed.');
  return original;
}

async function selectedHistory(
  folder: string,
  selected: {
    readonly selection: Selection;
    readonly scope: Scope;
    readonly direct: DirectPage | null;
  },
  address: HistoricalAddress,
  packs: readonly Bucket[],
): Promise<EntryHistory> {
  const { selection: archivedScope, scope: data } = selected;
  const context = {
    scope: archivedScope,
    entries: data.entries,
    overview: data.overview,
    callers: data.callers,
    links: data.pages.map((row) => row.file),
    complete: data.complete === true,
    sourceIndex: data.sourceIndex,
    interpretationIndex: data.interpretationIndex,
  };
  const requested = address.page ?? data.overview;
  const stored = selected.direct ?? data.pages.find((row) => row.file === requested);
  if (stored === undefined) {
    const retired = await retiredPage(folder, archivedScope, data, requested);
    return retired === null
      ? { ...context, kind: 'unavailable', title: 'Historical page unavailable', sources: [] }
      : { ...context, kind: 'retired', title: retired.title, sources: retired.sources };
  }
  const original = await checkedHistoricalPage(folder, packs, stored, selected.direct?.raw);
  const page = stored.file === data.overview ? explorerServiceOverview(original, data) : original;
  const selectedNode = page.nodes.find(
    (node) => address.page !== undefined && node.id === address.node,
  );
  return {
    ...context,
    kind: 'snapshot',
    file: stored.file,
    page,
    selected: selectedNode?.id ?? null,
  };
}

export async function readEntryHistory(
  workspace: string,
  address: HistoricalAddress,
  root?: string,
): Promise<EntryHistory | null> {
  const registered = await workspaceFolder(workspace, root);
  if (registered === null) return null;
  const folder = await realPathOf(registered);
  if (folder === null) return null;
  const raw = await archiveFile(folder, ['index.json'], 256 * 1024);
  if (raw === null) return null;
  const { scopes, packs } = index.parse(JSON.parse(raw.toString('utf8')));
  if (address.scope === undefined && address.service === undefined && address.page === undefined) {
    return { kind: 'directory', scopes };
  }
  const selected = await selectScope(folder, selectionsFor(scopes, address), address.page);
  return selected === null
    ? { kind: 'directory', scopes }
    : selectedHistory(folder, selected, address, packs);
}
