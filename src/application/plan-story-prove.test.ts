import { describe, expect, it, vi } from 'vitest';

import {
  contractEvidence,
  contractHeadline,
  coverageHeadline,
  e2eHeadline,
  evidenceLine,
  fitParts,
} from '@/application/plan-story-prove';
import { e2eReach, namesOf } from '@/application/plan-story-prove-flows';

vi.mock('server-only', () => ({}));

const { planData } = await import('@/infrastructure/plan-data');

async function modelOf(plan: string) {
  const data = await planData({ workspace: 'alder-finch', plan });
  if (data === null) throw new Error(`no ${plan}`);
  return data.model;
}

describe('fitParts', () => {
  it('joins parts to two lines and leaves the rest for the lede', () => {
    const fitted = fitParts([
      'no end-to-end test covers four of the eleven changed flows',
      'five of the eleven changed flows are covered only in part',
    ]);
    expect(fitted.headline).toBe('no end-to-end test covers four of the eleven changed flows.');
    expect(fitted.rest).toBe('Five of the eleven changed flows are covered only in part.');
  });

  it('keeps short parts together', () => {
    expect(fitParts(['a', 'b']).headline).toBe('a; b.');
  });
});

describe('namesOf', () => {
  it('names two and counts the rest', () => {
    expect(namesOf(['A', 'B'])).toBe('A and B');
    expect(namesOf(['A', 'B', 'C', 'D'])).toBe('A, B and two more');
  });
});

describe('e2eHeadline', () => {
  it('says which flows no end-to-end test covers and which only in part', async () => {
    const model = await modelOf('stock-reservation');
    const head = e2eHeadline(model);
    expect(head.headline).toBe('No end-to-end test covers “Allocate the order”.');
    expect(head.rest).toBe('“Pay and place the order” is covered only in part.');
    expect(head.reach.none.map((f) => f.id)).toEqual(e2eReach(model).none.map((f) => f.id));
  });

  it('counts when more than two flows are named', async () => {
    const head = e2eHeadline(await modelOf('delivery-promise'));
    expect(head.headline).toBe('No end-to-end test covers four of the eleven changed flows.');
  });
});

describe('contractHeadline', () => {
  it('names the one re-routed link that has no contract test', async () => {
    const model = await modelOf('storefront-graph');
    expect(contractHeadline(model, contractEvidence(model))).toMatch(
      /^The re-routed call “.+” has no contract test\.$/,
    );
  });

  it('is content when every link has a test, and counts the links', async () => {
    const model = await modelOf('stock-reservation');
    const evidence = contractEvidence(model);
    expect(contractHeadline(model, evidence)).toBe(
      'Every new or re-routed call has a contract test.',
    );
    expect(evidenceLine(evidence)).toBe('Four contract tests cover six links between services.');
  });
});

describe('coverageHeadline', () => {
  it('names the change with unit tests only', async () => {
    const head = coverageHeadline(await modelOf('delivery-promise'));
    expect(head.headline).toBe('Every change has a test, but one has unit tests only.');
    expect(head.weakest?.kind).toBe('Unit tests only');
    expect(head.weakest?.ids).toEqual(['chg:enrichment-weight-required']);
  });

  it('says the thin spot in the flows when every change has an end-to-end test', async () => {
    const model = await modelOf('stock-reservation');
    expect(coverageHeadline(model).headline).toBe(
      'Every change has a test, and each is covered end to end.',
    );
    const reach = e2eHeadline(model).reach;
    expect(coverageHeadline(model, { reach }).headline).toBe(
      'Every change has a test, but no end-to-end test covers “Allocate the order”.',
    );
  });

  it('adds the tests that never run what they prove', async () => {
    const head = coverageHeadline(await modelOf('storefront-graph'));
    expect(head.rest).toBe('One test claims a change but never runs its steps.');
  });
});
