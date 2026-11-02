import { describe, expect, it, vi } from 'vitest';

import { discoveryHostFixture as fixture } from '@/../test/scan-discovery-host-kit';
import {
  discoveryInventoryDigest,
  discoveryValidator,
} from '@/infrastructure/scan/discovery-format';

import { assessDiscovery, discoveryErrors } from './discovery-check';
import type { ScanDiscovery } from './discovery.generated';

vi.mock(import('server-only'), () => ({}));

function expectRejected(change: (document: ScanDiscovery) => void, message: string): void {
  const { document, input } = fixture();
  change(document);
  expect(discoveryErrors(document, input).join(' ')).toContain(message);
}

describe('explicit multiple source hosts within one candidate', () => {
  it('validates a declared client/server split with unique, local action ownership', async () => {
    const { document, input } = fixture();
    const validate = await discoveryValidator(input);
    expect(validate(document)).toEqual(document);
    expect(assessDiscovery(document, input).status).toBe('complete');
  });
  it('accepts nested host evidence from its separately assigned candidate without requiring the other host basis', () => {
    const { document, input } = fixture();
    const original = input.inventory.candidates[0]!;
    const serverEvidence = original.evidence.filter(
      (evidence) => evidence.context_id === 'context:server.ts',
    );
    const nested = {
      ...original,
      id: 'candidate:function',
      root: 'server.ts',
      evidence: serverEvidence,
    };
    const parent = {
      ...original,
      evidence: original.evidence.filter((evidence) => evidence.context_id !== 'context:server.ts'),
    };
    const inventory = { ...input.inventory, candidates: [parent, nested] };
    const expanded = {
      ...input,
      inventory: { ...inventory, sha256: discoveryInventoryDigest(inventory) },
    };
    document.inventory_sha256 = expanded.inventory.sha256;
    const disposition = document.candidates[0]!;
    const evidence = disposition.evidence.filter((item) => item.context_id === 'context:server.ts');
    disposition.evidence = disposition.evidence.filter(
      (item) => item.context_id !== 'context:server.ts',
    );
    document.candidates.push({
      candidate_id: nested.id,
      disposition: 'part_of_component',
      component_id: 'component:server',
      reason: 'Independently inventoried nested function source',
      evidence,
    });
    document.components
      .find((component) => component.id === 'component:server')!
      .candidate_ids.push(nested.id);
    expect(discoveryErrors(document, expanded)).toEqual([]);
    expect(assessDiscovery(document, expanded).status).toBe('complete');
  });
  it('does not accept one reconciled candidate for 59 independently frozen inventory rows', () => {
    const { document, input } = fixture();
    const inventory = {
      ...input.inventory,
      candidates: Array.from({ length: 59 }, (_, index) => ({
        ...input.inventory.candidates[0]!,
        id: `candidate:${String(index)}`,
      })),
    };
    const expanded = {
      ...input,
      inventory: { ...inventory, sha256: discoveryInventoryDigest(inventory) },
    };
    document.inventory_sha256 = expanded.inventory.sha256;
    document.candidates[0]!.candidate_id = 'candidate:0';
    for (const component of document.components) component.candidate_ids = ['candidate:0'];
    expect(discoveryErrors(document, expanded)).toContain(
      'Discovery dispositions must cover the exact frozen candidate inventory once.',
    );
  });
  it('requires primary hosts for explained entry behaviours even when action areas remain insufficient', () => {
    const { document, input } = fixture();
    const inventory = {
      ...input.inventory,
      candidates: input.inventory.candidates.map((candidate) => ({
        ...candidate,
        kind: 'entry' as const,
      })),
    };
    const expanded = {
      ...input,
      inventory: { ...inventory, sha256: discoveryInventoryDigest(inventory) },
    };
    document.inventory_sha256 = expanded.inventory.sha256;
    document.receipts = document.receipts.map((receipt) => ({
      ...receipt,
      outcome: 'insufficient_context',
      claim_ids: [],
    }));
    document.behaviours = [
      {
        candidate_id: 'candidate:app',
        outcome: 'explained',
        claim_ids: ['action:client', 'action:server'],
        inspected: document.candidates[0]!.evidence,
        run_id: input.interpretation.runs[0]!.id,
        reason: 'Two locally explained source entries.',
      },
    ];
    expect(discoveryErrors(document, expanded)).toEqual([]);
    document.action_hosts = [];
    expect(discoveryErrors(document, expanded).join(' ')).toContain(
      'split-host entry behaviour needs its explicit primary action host',
    );
  });
  it('rejects repeated candidate membership without an explicit split disposition', () => {
    expectRejected((original) => {
      const document = original;
      document.candidates[0]!.disposition = 'component';
      document.candidates[0]!.component_id = 'component:client';
    }, 'membership disagrees');
  });
  it('rejects absent host bindings and client actions assigned to server evidence', () => {
    expectRejected((original) => {
      const document = original;
      document.action_hosts = [];
    }, 'explicit primary action host');
    expectRejected((original) => {
      const document = original;
      document.action_hosts![0]!.component_id = 'component:server';
    }, 'host-local action support');
  });
  it('rejects a generic action bound to both hosts or copied into both receipts', () => {
    expectRejected((original) => {
      const document = original;
      document.action_hosts!.push({
        ...document.action_hosts![0]!,
        component_id: 'component:server',
      });
    }, 'exactly one primary action host');
    expectRejected((original) => {
      const document = original;
      document.receipts.find(
        (receipt) => receipt.component_id === 'component:server' && receipt.area === 'action',
      )!.claim_ids = ['action:client'];
    }, 'host-local claim support');
  });
  it('rejects parent-manifest-only host promotion and overlapping source roots', () => {
    expectRejected((original) => {
      const document = original;
      document.components[0]!.evidence = [document.components[0]!.evidence[0]];
    }, 'host-local entry or implementation');
    expectRejected((original) => {
      const document = original;
      document.components[0]!.source_roots = ['.'];
    }, 'source roots overlap');
  });
});
