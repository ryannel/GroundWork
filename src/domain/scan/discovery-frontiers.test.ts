import { describe, expect, it, vi } from 'vitest';

import { interpretationFixture } from '@/../test/scan-interpretation-kit';
import {
  discoveryInventoryDigest,
  discoveryValidator,
} from '@/infrastructure/scan/discovery-format';

import { assessDiscovery, discoveryErrors } from './discovery-check';
import type { DiscoveryInput } from './discovery-types';
import type { ScanDiscovery } from './discovery.generated';
import type { ScanDocument } from './scan.generated';

vi.mock(import('server-only'), () => ({}));

function frontierFixture(): { document: ScanDiscovery; input: DiscoveryInput } {
  const original = interpretationFixture();
  const context = original.document.contexts[0];
  if (context.kind !== 'scan_snapshot') throw new Error('Expected target');
  const inventory = {
    repo: context.repo,
    commit: context.commit,
    analysis_version: 'analysis:1',
    snapshot_sha256: context.sha256,
    candidates: [
      { id: 'candidate:entry', kind: 'entry' as const, root: 'apps/out-of-budget', evidence: [] },
    ],
  };
  const sha256 = discoveryInventoryDigest(inventory);
  return {
    input: {
      inventory: { ...inventory, sha256 },
      interpretation: original.document,
      snapshots: [
        {
          kind: 'scan_snapshot',
          id: context.id,
          sha256: context.sha256,
          document: JSON.parse(original.inputs[0]!.bytes) as ScanDocument,
        },
      ],
    },
    document: {
      format: 'scan-discovery/v1',
      repo: context.repo,
      commit: context.commit,
      analysis_version: inventory.analysis_version,
      snapshot_sha256: context.sha256,
      inventory_sha256: sha256,
      components: [],
      receipts: [],
      candidates: [
        {
          candidate_id: 'candidate:entry',
          disposition: 'unresolved',
          component_id: null,
          reason: 'Source body exceeds the packet budget; no inspection claimed.',
          evidence: [],
        },
      ],
      behaviours: [
        {
          candidate_id: 'candidate:entry',
          outcome: 'unresolved',
          claim_ids: [],
          run_id: original.document.runs[0]!.id,
          inspected: [],
          reason: 'Source anchor unavailable within budget.',
        },
      ],
    },
  };
}

describe('honest discovery frontiers', () => {
  it('distinguishes retained entry evidence from actual model inspection', async () => {
    const { document, input } = frontierFixture();
    const snapshot = input.snapshots[0];
    if (snapshot?.kind !== 'scan_snapshot') throw new Error('Expected native fixture');
    const source = snapshot.document.sources[0]!;
    const inventory = {
      ...input.inventory,
      candidates: [
        {
          id: 'candidate:entry',
          kind: 'entry' as const,
          root: source.path,
          evidence: [
            {
              kind: 'observed_record' as const,
              context_id: snapshot.id,
              record_id: source.id,
              source_id: source.id,
              basis: 'entry' as const,
            },
          ],
        },
      ],
    };
    const frozen = { ...inventory, sha256: discoveryInventoryDigest(inventory) };
    document.inventory_sha256 = frozen.sha256;
    document.behaviours[0]!.reason =
      'Available in the packet but not examined in the responsible authoring batch.';
    const supplied = { ...input, inventory: frozen };
    const validate = await discoveryValidator(supplied);
    expect(validate(document).behaviours[0]?.inspected).toEqual([]);
    expect(assessDiscovery(document, supplied).status).toBe('blocked');
    document.behaviours[0]!.outcome = 'supporting';
    expect(() => validate(document)).toThrow('entry-local inspected evidence');
  });
  it('publishes an unresolved unanchored candidate without claiming source inspection or completeness', async () => {
    const { document, input } = frontierFixture();
    const validate = await discoveryValidator(input);
    expect(validate(document).candidates[0]?.evidence).toEqual([]);
    expect(discoveryErrors(document, input)).toEqual([]);
    expect(assessDiscovery(document, input).status).toBe('blocked');
    expect(assessDiscovery(document, input).knowledgeGaps).toContain(
      'candidate:entry: candidate source anchor remains unresolved.',
    );
  });
  it('cannot turn missing anchors into a resolved exclusion or supporting behaviour', () => {
    const { document, input } = frontierFixture();
    document.candidates[0]!.disposition = 'non_runtime';
    document.behaviours[0]!.outcome = 'supporting';
    expect(discoveryErrors(document, input)).toContain(
      'candidate:entry: a resolved disposition needs candidate-local evidence.',
    );
    expect(discoveryErrors(document, input)).toContain(
      'candidate:entry: behaviour needs entry-local inspected evidence.',
    );
  });
  it('does not claim complete discovery from an empty frozen roster', () => {
    const { document, input } = frontierFixture();
    document.candidates = [];
    document.behaviours = [];
    const inventory = { ...input.inventory, candidates: [] };
    expect(discoveryErrors(document, { ...input, inventory })).toEqual([]);
    expect(assessDiscovery(document, { ...input, inventory }).status).toBe('blocked');
    expect(assessDiscovery(document, { ...input, inventory }).blockers).toContain(
      'Discovery inventory has no candidates; scope coverage cannot be established.',
    );
  });
});
