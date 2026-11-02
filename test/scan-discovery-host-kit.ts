import { discoveryAreas } from '@/domain/scan/discovery-receipts';
import type { DiscoveryInput, DiscoveryInventory } from '@/domain/scan/discovery-types';
import type { DiscoveryEvidence, ScanDiscovery } from '@/domain/scan/discovery.generated';
import type { InterpretationSnapshot } from '@/domain/scan/interpretation-context';
import type { ActionClaim, ScanInterpretation } from '@/domain/scan/interpretation.generated';
import type { ScanDocument } from '@/domain/scan/scan.generated';
import { discoveryInventoryDigest } from '@/infrastructure/scan/discovery-format';
import { interpretationDigest } from '@/infrastructure/scan/interpretation-format';

import { interpretationFixture } from './scan-interpretation-kit';

const bases = ['boundary', 'entry', 'implementation'] as const;

export function discoveryHostFixture(): { document: ScanDiscovery; input: DiscoveryInput } {
  const original = interpretationFixture();
  const context = original.document.contexts[0];
  if (context.kind !== 'scan_snapshot') throw new Error('Expected target fixture');
  const input: {
    inventory: DiscoveryInventory;
    interpretation: ScanInterpretation;
    snapshots: InterpretationSnapshot[];
  } = {
    inventory: {
      repo: context.repo,
      commit: context.commit,
      analysis_version: 'analysis:split',
      snapshot_sha256: context.sha256,
      sha256: '',
      candidates: [],
    },
    interpretation: original.document,
    snapshots: [
      {
        kind: 'scan_snapshot',
        id: context.id,
        sha256: context.sha256,
        document: JSON.parse(original.inputs[0]!.bytes) as ScanDocument,
      },
    ],
  };
  const evidence: DiscoveryEvidence[] = [];
  for (const sourcePath of ['package.json', 'client.ts', 'server.ts']) {
    const id = `context:${sourcePath}`;
    const text =
      sourcePath === 'package.json'
        ? '{"scripts":{"client":"web","server":"http"}}\n'
        : 'export function entry() {}\n';
    const sha256 = interpretationDigest(text);
    const uri = `https://github.com/${context.repo}/blob/${context.commit}/${sourcePath}`;
    input.interpretation.contexts.push({
      kind: 'context_snapshot',
      id,
      sha256,
      role: 'surrounding',
      uri,
      revision: context.commit,
      title: sourcePath,
      authority: 'documentation',
      pins: [{ repo: context.repo, commit: context.commit }],
      input_provenance: {
        provided_by: 'workspace',
        retrieved_at: '2026-10-26T12:00:00Z',
        description: 'Exact synthetic pinned source',
      },
    });
    input.interpretation.runs[0]!.input_context_ids.push(id);
    input.snapshots = [
      ...input.snapshots,
      { kind: 'context_snapshot', id, sha256, uri, revision: context.commit, text },
    ];
    evidence.push({
      kind: 'context_snapshot',
      context_id: id,
      path: sourcePath,
      commit: context.commit,
      sha256,
      lines: [1, 1],
    });
  }
  const inventory = {
    ...input.inventory,
    candidates: [
      {
        id: 'candidate:app',
        kind: 'boundary' as const,
        root: '.',
        evidence: evidence.map((item, index) => ({
          ...item,
          basis: bases[index] ?? 'implementation',
        })),
      },
    ],
  };
  input.inventory = { ...inventory, sha256: discoveryInventoryDigest(inventory) };
  const template = original.document.claims.find((claim) => claim.kind === 'action')!;
  input.interpretation.claims = ['client', 'server'].map((host, index): ActionClaim => ({
    ...template,
    id: `action:${host}`,
    actor: null,
    name: `Run ${host} entry`,
    support: [
      {
        kind: 'context_snapshot',
        context_id: evidence[index + 1]!.context_id,
        locator: `${host}.ts`,
        lines: [1, 1],
      },
    ],
    entrypoints: [
      {
        kind: 'context_snapshot',
        context_id: evidence[index + 1]!.context_id,
        locator: `${host}.ts`,
        lines: [1, 1],
      },
    ],
  }));
  input.interpretation.attempts = discoveryAreas.map((area) => ({
    area,
    run_id: template.run_id,
    outcome: area === 'action' ? 'claims_proposed' : 'insufficient_context',
    claim_ids: area === 'action' ? ['action:client', 'action:server'] : [],
    reason: 'Independent local entry inspection; other knowledge remains unknown.',
  }));
  return {
    input,
    document: {
      format: 'scan-discovery/v1',
      repo: inventory.repo,
      commit: inventory.commit,
      analysis_version: inventory.analysis_version,
      snapshot_sha256: inventory.snapshot_sha256,
      inventory_sha256: input.inventory.sha256,
      candidates: [
        {
          candidate_id: 'candidate:app',
          disposition: 'split',
          component_id: null,
          component_ids: ['component:client', 'component:server'],
          reason: 'Two explicitly declared source hosts',
          evidence,
        },
      ],
      components: ['client', 'server'].map((host, index) => ({
        id: `component:${host}`,
        candidate_ids: ['candidate:app'],
        boundary: 'source_declared',
        deployment: 'unknown',
        source_roots: [`${host}.ts`],
        evidence: [evidence[0]!, evidence[index + 1]!],
      })),
      action_hosts: ['client', 'server'].map((host, index) => ({
        action_id: `action:${host}`,
        component_id: `component:${host}`,
        evidence: [evidence[0]!, evidence[index + 1]!],
      })),
      receipts: ['client', 'server'].flatMap((host, index) =>
        discoveryAreas.map((area) => ({
          component_id: `component:${host}`,
          area,
          run_id: template.run_id,
          outcome:
            area === 'action' ? ('claims_proposed' as const) : ('insufficient_context' as const),
          claim_ids: area === 'action' ? [`action:${host}`] : [],
          reason: 'Examined host-specific source; no quota for unknown areas.',
          inspected: [evidence[0]!, evidence[index + 1]!],
        })),
      ),
      behaviours: [],
    },
  };
}
