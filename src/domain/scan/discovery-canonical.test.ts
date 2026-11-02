import { describe, expect, it, vi } from 'vitest';

import { interpretationFixture } from '@/../test/scan-interpretation-kit';
import {
  discoveryInventoryDigest,
  discoveryValidator,
} from '@/infrastructure/scan/discovery-format';
import { interpretationDigest } from '@/infrastructure/scan/interpretation-format';

import { assessDiscovery } from './discovery-check';
import { discoveryAreas } from './discovery-receipts';
import type { DiscoveryInput } from './discovery-types';
import type { ScanDiscovery } from './discovery.generated';

vi.mock(import('server-only'), () => ({}));

function fixture(): { document: ScanDiscovery; input: DiscoveryInput } {
  const repo = 'example/contracts';
  const commit = 'a'.repeat(40);
  const text = 'syntax = "proto3";\nmessage Request {}\n';
  const sha256 = interpretationDigest(text);
  const uri = `https://github.com/${repo}/blob/${commit}/request.proto`;
  const context = {
    kind: 'context_snapshot' as const,
    id: 'context:proto',
    role: 'target' as const,
    sha256,
    uri,
    revision: commit,
    title: 'Pinned contract',
    authority: 'documentation' as const,
    pins: [{ repo, commit }],
    input_provenance: {
      provided_by: 'workspace' as const,
      retrieved_at: '2026-10-26T12:00:00Z',
      description: 'Exact selected Git source bytes',
    },
  };
  const evidence = {
    kind: 'context_snapshot' as const,
    context_id: context.id,
    path: 'request.proto',
    commit,
    sha256,
    lines: [1, 2] as [number, number],
  };
  const inventory = {
    repo,
    commit,
    analysis_version: 'analysis:1',
    snapshot_sha256: sha256,
    candidates: [
      {
        id: 'candidate:contracts',
        root: '.',
        kind: 'support' as const,
        evidence: [{ ...evidence, basis: 'implementation' as const }],
      },
    ],
  };
  const run = {
    ...interpretationFixture().document.runs[0]!,
    input_context_ids: [context.id] as [string],
  };
  const input: DiscoveryInput = {
    inventory: { ...inventory, sha256: discoveryInventoryDigest(inventory) },
    interpretation: {
      format: 'scan-interpretation/v1',
      id: 'interpretation:contracts',
      state: 'complete',
      contexts: [context],
      runs: [run],
      claims: [],
      attempts: discoveryAreas.map((area) => ({
        area,
        run_id: run.id,
        outcome: 'insufficient_context',
        claim_ids: [],
        reason: 'No independent runtime or customer action established.',
      })),
    },
    snapshots: [{ kind: 'context_snapshot', id: context.id, sha256, uri, revision: commit, text }],
  };
  return {
    input,
    document: {
      format: 'scan-discovery/v1',
      repo,
      commit,
      analysis_version: inventory.analysis_version,
      snapshot_sha256: sha256,
      inventory_sha256: input.inventory.sha256,
      components: [],
      receipts: [],
      behaviours: [],
      candidates: [
        {
          candidate_id: 'candidate:contracts',
          component_id: null,
          disposition: 'non_runtime',
          reason: 'Source contract library; no independent process declared.',
          evidence: [evidence],
        },
      ],
    },
  };
}

describe('canonical-only source investigation', () => {
  it('accepts pinned contract source without requiring a fabricated AST target', async () => {
    const { document, input } = fixture();
    const validate = await discoveryValidator(input);
    expect(validate(document).components).toEqual([]);
    expect(assessDiscovery(document, input).status).toBe('complete');
  });
  it('rejects wrong target pin, digest, source URI and actual bytes', async () => {
    const { document, input } = fixture();
    const context = input.interpretation.contexts[0];
    if (context.kind !== 'context_snapshot') throw new Error('Expected canonical target');
    const changed = [
      { ...context, pins: [{ repo: 'wrong/repo', commit: context.revision }] },
      { ...context, sha256: 'f'.repeat(64) },
      { ...context, uri: 'https://example.com/request.proto' },
    ];
    for (const target of changed) {
      const altered = {
        ...input,
        interpretation: { ...input.interpretation, contexts: [target] as [typeof target] },
      };
      const validate = await discoveryValidator(altered);
      expect(() => validate(document)).toThrow('ScanDiscovery');
    }
    const snapshots = input.snapshots.map((snapshot) =>
      snapshot.kind === 'context_snapshot' ? { ...snapshot, text: 'Changed content' } : snapshot,
    );
    await expect(discoveryValidator({ ...input, snapshots })).rejects.toThrow(
      'digest does not match its bytes',
    );
  });
});
