import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import { interpretationFixture } from '@/../test/scan-interpretation-kit';
import { generateDiscoveryTypes } from '@/../tools/scan-discovery-types';
import { assessDiscovery, discoveryErrors } from '@/domain/scan/discovery-check';
import { discoveryAreas } from '@/domain/scan/discovery-receipts';
import type { DiscoveryInput } from '@/domain/scan/discovery-types';
import type { DiscoveryEvidence, ScanDiscovery } from '@/domain/scan/discovery.generated';
import type { ScanDocument } from '@/domain/scan/scan.generated';

import { discoveryInventoryDigest, discoveryValidator } from './discovery-format';
import { interpretationDigest } from './interpretation-format';

vi.mock(import('server-only'), () => ({}));

function canonicalFixture(): { document: ScanDiscovery; input: DiscoveryInput } {
  const original = interpretationFixture();
  const target = original.document.contexts[0];
  if (target.kind !== 'scan_snapshot') throw new Error('Expected target');
  const bytes = '{"name":"test-drive","scripts":{"start":"node src/main.js"}}\n';
  const path = 'apps/test-drive/package.json';
  const uri = `https://github.com/${target.repo}/blob/${target.commit}/${path}`;
  const sha256 = interpretationDigest(bytes);
  const evidence: DiscoveryEvidence = {
    kind: 'context_snapshot',
    context_id: 'context:manifest',
    path,
    commit: target.commit,
    sha256,
    lines: [1, 1],
  };
  original.document.contexts.push({
    kind: 'context_snapshot',
    id: evidence.context_id,
    sha256,
    role: 'surrounding',
    uri,
    revision: target.commit,
    title: 'Pinned package',
    authority: 'documentation',
    input_provenance: {
      provided_by: 'workspace',
      retrieved_at: '2026-10-26T12:00:00Z',
      description: 'Pinned Git bytes',
    },
    pins: [{ repo: target.repo, commit: target.commit }],
  });
  original.document.runs[0]!.input_context_ids.push(evidence.context_id);
  const inventory = {
    repo: target.repo,
    commit: target.commit,
    analysis_version: 'analysis:1',
    snapshot_sha256: target.sha256,
    candidates: [
      {
        id: 'candidate:test-drive',
        kind: 'boundary' as const,
        root: 'apps/test-drive',
        evidence: [{ ...evidence, basis: 'boundary' as const }],
      },
    ],
  };
  const inventorySha = discoveryInventoryDigest(inventory);
  const input: DiscoveryInput = {
    inventory: { ...inventory, sha256: inventorySha },
    interpretation: original.document,
    snapshots: [
      {
        kind: 'scan_snapshot',
        id: target.id,
        sha256: target.sha256,
        document: JSON.parse(original.inputs[0]!.bytes) as ScanDocument,
      },
      {
        kind: 'context_snapshot',
        id: evidence.context_id,
        sha256,
        uri,
        revision: target.commit,
        text: bytes,
      },
    ],
  };
  return {
    input,
    document: {
      format: 'scan-discovery/v1',
      repo: target.repo,
      commit: target.commit,
      analysis_version: inventory.analysis_version,
      snapshot_sha256: target.sha256,
      inventory_sha256: inventorySha,
      candidates: [
        {
          candidate_id: 'candidate:test-drive',
          disposition: 'component',
          component_id: 'component:test-drive',
          reason: 'Start command declares a source boundary.',
          evidence: [evidence],
        },
      ],
      components: [
        {
          id: 'component:test-drive',
          candidate_ids: ['candidate:test-drive'],
          boundary: 'source_declared',
          deployment: 'unknown',
          evidence: [evidence],
        },
      ],
      behaviours: [],
      receipts: discoveryAreas.map((area) => ({
        component_id: 'component:test-drive',
        area,
        run_id: original.document.runs[0]!.id,
        outcome: 'insufficient_context',
        claim_ids: [],
        reason: 'Package examined; goal remains unknown.',
        inspected: [evidence],
      })),
    },
  };
}

describe('closed discovery sidecar', () => {
  it('keeps generated types aligned with its closed schema', async () => {
    await expect(readFile('src/domain/scan/discovery.generated.ts', 'utf8')).resolves.toBe(
      await generateDiscoveryTypes(),
    );
  });
  it('accepts pinned canonical manifests without mistaking test-drive for test-only code', async () => {
    const { document, input } = canonicalFixture();
    const validate = await discoveryValidator(input);
    expect(validate(document).components[0]?.deployment).toBe('unknown');
    expect(() => validate({ ...document, ready: true })).toThrow('ScanDiscovery');
    expect(() =>
      validate({
        ...document,
        components: [{ ...document.components[0], deployment: 'deployed' }],
      }),
    ).toThrow('ScanDiscovery');
  });
  it('verifies the frozen inventory digest independently of the result', async () => {
    const { input } = canonicalFixture();
    await expect(
      discoveryValidator({ ...input, inventory: { ...input.inventory, sha256: 'f'.repeat(64) } }),
    ).rejects.toThrow('inventory digest');
  });
  it('rejects wrong source paths, digest, commit and line ranges in canonical evidence', () => {
    const { document, input } = canonicalFixture();
    const evidence = input.inventory.candidates[0]!.evidence[0]!;
    if (evidence.kind !== 'context_snapshot') throw new Error('Expected canonical evidence');
    const variants = [
      { ...evidence, path: 'README.md' },
      { ...evidence, sha256: 'f'.repeat(64) },
      { ...evidence, commit: 'f'.repeat(40) },
      { ...evidence, lines: [1, 9] as [number, number] },
    ];
    for (const changed of variants) {
      const inventory = {
        ...input.inventory,
        candidates: [{ ...input.inventory.candidates[0]!, evidence: [changed] }],
      };
      expect(discoveryErrors(document, { ...input, inventory }).length).toBeGreaterThan(0);
    }
  });
  it('does not hide an unassigned entry behind a component summary', () => {
    const { document, input } = canonicalFixture();
    const inventory = {
      ...input.inventory,
      candidates: input.inventory.candidates.map((candidate) => ({
        ...candidate,
        kind: 'entry' as const,
      })),
    };
    expect(discoveryErrors(document, { ...input, inventory })).toContain(
      'candidate:test-drive: entry needs exactly one behaviour receipt.',
    );
    document.behaviours.push({
      candidate_id: 'candidate:test-drive',
      outcome: 'supporting',
      claim_ids: [],
      run_id: input.interpretation.runs[0]!.id,
      inspected: document.components[0]!.evidence,
      reason: 'This source supports the component; no distinct user activity is established.',
    });
    expect(discoveryErrors(document, { ...input, inventory })).toEqual([]);
    document.behaviours[0]!.outcome = 'unresolved';
    expect(discoveryErrors(document, { ...input, inventory })).toEqual([]);
    expect(assessDiscovery(document, { ...input, inventory }).blockers).toContain(
      'candidate:test-drive: unresolved entry behaviour blocks exhaustive discovery.',
    );
  });
  it('checks canonical bytes rather than accepting a caller supplied digest', async () => {
    const { input } = canonicalFixture();
    const snapshots = input.snapshots.map((snapshot) =>
      snapshot.kind === 'context_snapshot'
        ? { ...snapshot, text: 'Changed source bytes' }
        : snapshot,
    );
    await expect(discoveryValidator({ ...input, snapshots })).rejects.toThrow(
      'digest does not match its bytes',
    );
  });
  it('accepts a repository root scope but rejects parent traversal', () => {
    const { document, input } = canonicalFixture();
    const rootInventory = {
      ...input.inventory,
      candidates: input.inventory.candidates.map((candidate) => ({ ...candidate, root: '.' })),
    };
    expect(discoveryErrors(document, { ...input, inventory: rootInventory })).toEqual([]);
    const unsafeInventory = {
      ...input.inventory,
      candidates: input.inventory.candidates.map((candidate) => ({
        ...candidate,
        root: 'apps/../apps/test-drive',
      })),
    };
    expect(
      discoveryErrors(document, { ...input, inventory: unsafeInventory }).length,
    ).toBeGreaterThan(0);
  });
  it('requires local action and entrypoint evidence to explain a distinct activity', () => {
    const { document, input } = canonicalFixture();
    const inventory = {
      ...input.inventory,
      candidates: input.inventory.candidates.map((candidate) => ({
        ...candidate,
        kind: 'entry' as const,
      })),
    };
    const evidence = document.components[0]!.evidence[0];
    if (evidence.kind !== 'context_snapshot') throw new Error('Expected manifest');
    const support = {
      kind: 'context_snapshot' as const,
      context_id: evidence.context_id,
      locator: evidence.path,
      lines: evidence.lines,
    };
    const interpretation = {
      ...input.interpretation,
      claims: input.interpretation.claims.map((claim) =>
        claim.kind === 'action'
          ? {
              ...claim,
              support: [support] as [typeof support],
              entrypoints: [support] as [typeof support],
            }
          : claim,
      ),
    };
    document.behaviours.push({
      candidate_id: 'candidate:test-drive',
      outcome: 'explained',
      claim_ids: ['inferred:action'],
      run_id: interpretation.runs[0]!.id,
      reason: 'The entry supports the inferred action.',
      inspected: [evidence],
    });
    expect(discoveryErrors(document, { ...input, inventory, interpretation })).toEqual([]);
    document.behaviours[0]!.claim_ids = ['inferred:actor'];
    expect(
      discoveryErrors(document, { ...input, inventory, interpretation }).length,
    ).toBeGreaterThan(0);
    document.behaviours[0]!.claim_ids = ['inferred:action'];
    document.behaviours[0]!.run_id = 'missing';
    expect(
      discoveryErrors(document, { ...input, inventory, interpretation }).length,
    ).toBeGreaterThan(0);
  });
  it('does not let a manifest-only attempt skip available implementation evidence', () => {
    const { document, input } = canonicalFixture();
    const evidence = input.inventory.candidates[0]!.evidence[0]!;
    if (evidence.kind !== 'context_snapshot') throw new Error('Expected canonical evidence');
    const implementation = {
      ...evidence,
      basis: 'implementation' as const,
      lines: [2, 2] as [number, number],
    };
    const inventory = {
      ...input.inventory,
      candidates: [{ ...input.inventory.candidates[0]!, evidence: [evidence, implementation] }],
    };
    expect(discoveryErrors(document, { ...input, inventory })).toContain(
      'candidate:test-drive: action has not inspected implementation evidence.',
    );
  });
  it('validates honest partial data while keeping exhaustive discovery blocked', async () => {
    const { document, input } = canonicalFixture();
    document.candidates[0]!.disposition = 'unresolved';
    document.candidates[0]!.component_id = null;
    document.components = [];
    document.receipts = [];
    const validate = await discoveryValidator(input);
    expect(validate(document).candidates[0]?.disposition).toBe('unresolved');
    expect(assessDiscovery(document, input).status).toBe('blocked');
  });
});
