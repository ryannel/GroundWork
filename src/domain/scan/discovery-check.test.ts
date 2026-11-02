import { describe, expect, it, vi } from 'vitest';

import { interpretationFixture } from '@/../test/scan-interpretation-kit';

import { assessDiscovery, discoveryErrors } from './discovery-check';
import { discoveryAreas } from './discovery-receipts';
import type { DiscoveryInput } from './discovery-types';
import type { DiscoveryEvidence, ScanDiscovery } from './discovery.generated';
import type { ScanDocument } from './scan.generated';

vi.mock(import('server-only'), () => ({}));

function fixture(): { document: ScanDiscovery; input: DiscoveryInput } {
  const original = interpretationFixture();
  const context = original.document.contexts[0];
  if (context.kind !== 'scan_snapshot') throw new Error('Expected source context');
  const bytes = original.inputs[0]!.bytes;
  const source: ScanDocument = JSON.parse(bytes) as ScanDocument;
  const evidence: DiscoveryEvidence = {
    kind: 'observed_record',
    context_id: context.id,
    record_id: 'host:server',
    source_id: 'source:handler',
  };
  const inventory = {
    repo: context.repo,
    commit: context.commit,
    analysis_version: 'analysis:1',
    snapshot_sha256: context.sha256,
    sha256: 'b'.repeat(64),
    candidates: [
      {
        id: 'candidate:one',
        kind: 'boundary' as const,
        root: 'handler.ts',
        evidence: [{ ...evidence, basis: 'entry' as const }],
      },
    ],
  };
  const input: DiscoveryInput = {
    inventory,
    interpretation: original.document,
    snapshots: [
      { kind: 'scan_snapshot', id: context.id, sha256: context.sha256, document: source },
    ],
  };
  return {
    input,
    document: {
      format: 'scan-discovery/v1',
      behaviours: [],
      repo: inventory.repo,
      commit: inventory.commit,
      analysis_version: inventory.analysis_version,
      snapshot_sha256: inventory.snapshot_sha256,
      inventory_sha256: inventory.sha256,
      candidates: [
        {
          candidate_id: 'candidate:one',
          disposition: 'component',
          component_id: 'component:one',
          reason: 'Entry registration',
          evidence: [evidence],
        },
      ],
      components: [
        {
          id: 'component:one',
          candidate_ids: ['candidate:one'],
          boundary: 'source_declared',
          deployment: 'unknown',
          evidence: [evidence],
        },
      ],
      receipts: discoveryAreas.map((area) => ({
        component_id: 'component:one',
        area,
        run_id: original.document.runs[0]!.id,
        outcome: 'insufficient_context',
        claim_ids: [],
        reason: 'Examined entry; business goal is unknown.',
        inspected: [evidence],
      })),
    },
  };
}
function expectRejected(change: (document: ScanDiscovery) => void): void {
  const { document, input } = fixture();
  change(document);
  expect(discoveryErrors(document, input).length).toBeGreaterThan(0);
}

describe('frozen component discovery', () => {
  it('keeps legacy interpretation readable while reporting discovery as unknown', () => {
    const { input } = fixture();
    expect(assessDiscovery(undefined, input).status).toBe('unknown');
  });
  it('accepts genuine best-effort investigation with five visible knowledge gaps and no quota', () => {
    const { document, input } = fixture();
    expect(assessDiscovery(document, input)).toEqual({
      status: 'complete',
      blockers: [],
      knowledgeGaps: discoveryAreas.map(
        (area) => `component:one: ${area}: Examined entry; business goal is unknown.`,
      ),
    });
  });
  it('rejects missing, extra and duplicated dispositions and receipts', () => {
    expectRejected((original) => {
      const document = original;
      document.candidates = [];
    });
    expectRejected((original) => {
      const document = original;
      document.candidates.push({ ...document.candidates[0]!, candidate_id: 'extra' });
    });
    expectRejected((original) => {
      const document = original;
      document.candidates.push(document.candidates[0]!);
    });
    expectRejected((original) => {
      const document = original;
      document.receipts.pop();
    });
    expectRejected((original) => {
      const document = original;
      document.receipts.push(document.receipts[0]!);
    });
  });
  it('rejects changed pins, analysis versions and either digest', () => {
    expectRejected((original) => {
      const document = original;
      document.commit = 'f'.repeat(40);
    });
    expectRejected((original) => {
      const document = original;
      document.repo = 'wrong/repo';
    });
    expectRejected((original) => {
      const document = original;
      document.analysis_version = 'analysis:2';
    });
    expectRejected((original) => {
      const document = original;
      document.snapshot_sha256 = 'f'.repeat(64);
    });
    expectRejected((original) => {
      const document = original;
      document.inventory_sha256 = 'f'.repeat(64);
    });
  });
  it('blocks unresolved candidates and inconsistent component assignments', () => {
    expectRejected((original) => {
      const document = original;
      document.candidates[0]!.disposition = 'unresolved';
    });
    expectRejected((original) => {
      const document = original;
      document.candidates[0]!.component_id = 'missing';
    });
    expectRejected((original) => {
      const document = original;
      document.components[0]!.candidate_ids.push('missing');
    });
    expectRejected((original) => {
      const document = original;
      document.components.push(document.components[0]!);
    });
  });
  it('cannot promote a root name alone to a runtime boundary', () => {
    const { document, input } = fixture();
    const inventory = {
      ...input.inventory,
      candidates: input.inventory.candidates.map((candidate) => ({
        ...candidate,
        evidence: candidate.evidence.map((evidence) => ({
          ...evidence,
          basis: 'root_name' as const,
        })),
      })),
    };
    expect(discoveryErrors(document, { ...input, inventory })).toContain(
      'component:one: source boundary or entry evidence is required.',
    );
  });
  it('rejects uninspected evidence and mismatched claim kinds or runs', () => {
    expectRejected((original) => {
      const document = original;
      document.receipts[0]!.run_id = 'missing';
    });
    expectRejected((original) => {
      const document = original;
      document.receipts[0]!.inspected[0] = {
        ...document.receipts[0]!.inspected[0],
        context_id: 'missing',
      };
    });
    expectRejected((original) => {
      const document = original;
      document.receipts[0]!.claim_ids = ['inferred:actor'];
      document.receipts[0]!.outcome = 'claims_proposed';
    });
    expectRejected((original) => {
      const document = original;
      document.receipts[0]!.claim_ids = ['missing'];
      document.receipts[0]!.outcome = 'claims_proposed';
    });
  });
  it('rejects a generic claim copied to another component with unrelated local evidence', () => {
    const { document, input } = fixture();
    const source = input.snapshots[0];
    if (source?.kind !== 'scan_snapshot') throw new Error('Expected source snapshot');
    const local: DiscoveryEvidence = {
      kind: 'observed_record',
      context_id: source.id,
      record_id: 'source:other',
      source_id: 'source:other',
    };
    source.document.sources.push({
      ...source.document.sources[0]!,
      id: 'source:other',
      path: 'other.ts',
    });
    const inventory = {
      ...input.inventory,
      candidates: [
        ...input.inventory.candidates,
        {
          id: 'candidate:two',
          kind: 'entry' as const,
          root: 'other.ts',
          evidence: [{ ...local, basis: 'entry' as const }],
        },
      ],
    };
    document.candidates.push({
      candidate_id: 'candidate:two',
      disposition: 'component',
      component_id: 'component:two',
      reason: 'Another entry',
      evidence: [local],
    });
    document.components.push({
      id: 'component:two',
      candidate_ids: ['candidate:two'],
      boundary: 'source_declared',
      deployment: 'unknown',
      evidence: [local],
    });
    document.receipts.push(
      ...document.receipts.map((receipt) => ({
        ...receipt,
        component_id: 'component:two',
        inspected: [local] as [DiscoveryEvidence],
        ...(receipt.area === 'action'
          ? { outcome: 'claims_proposed' as const, claim_ids: ['inferred:action'] }
          : {}),
      })),
    );
    expect(discoveryErrors(document, { ...input, inventory })).toContain(
      'inferred:action: discovery claim lacks component-local support.',
    );
  });
  it('supports evidence-backed non-runtime dispositions and blocks invalid evidence ownership', () => {
    const { document, input } = fixture();
    document.candidates[0]!.disposition = 'non_runtime';
    document.candidates[0]!.component_id = null;
    document.components = [];
    document.receipts = [];
    expect(discoveryErrors(document, input)).toEqual([]);
    document.candidates[0]!.evidence[0] = {
      kind: 'observed_record',
      context_id: 'missing',
      record_id: 'missing',
      source_id: 'missing',
    };
    expect(discoveryErrors(document, input).length).toBeGreaterThan(0);
  });
  it('rejects unused or unpinned inventory and incomplete model work', () => {
    const { document, input } = fixture();
    expect(
      discoveryErrors(document, {
        ...input,
        inventory: {
          ...input.inventory,
          candidates: [...input.inventory.candidates, ...input.inventory.candidates],
        },
      }).length,
    ).toBeGreaterThan(0);
    expect(
      discoveryErrors(document, {
        ...input,
        inventory: { ...input.inventory, snapshot_sha256: 'f'.repeat(64) },
      }).length,
    ).toBeGreaterThan(0);
    expect(
      assessDiscovery(document, {
        ...input,
        interpretation: { ...input.interpretation, state: 'partial' },
      }).blockers,
    ).toContain('Discovery requires completed best-effort interpretation.');
  });
});
