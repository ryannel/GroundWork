import { describe, expect, it } from 'vitest';

import { shop } from '@/../test/federation-kit';
import { orderNotes } from '@/../test/fixtures/acme/plans/chapters-order-notes';
import { sameDay } from '@/../test/fixtures/acme/plans/chapters-same-day';
import { modelOf } from '@/../test/plan-kit';
import {
  contractEvidence,
  contractHeadline,
  coverageHeadline,
  e2eHeadline,
  evidenceLine,
  fitParts,
} from '@/application/plan-story-prove';
import { e2eReach, namesOf } from '@/application/plan-story-prove-flows';

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
  it('says which flows no end-to-end test covers and which only in part', () => {
    const model = modelOf(orderNotes());
    const head = e2eHeadline(model);
    expect(head.headline).toBe('No end-to-end test covers “Cancel an order”.');
    expect(head.rest).toBe('“Place an order” is covered only in part.');
    expect(head.reach.none.map((f) => f.id)).toEqual(e2eReach(model).none.map((f) => f.id));
  });

  it('counts when more than two flows are named', () => {
    const head = e2eHeadline(modelOf(sameDay()));
    expect(head.headline).toBe('No end-to-end test covers three of the four changed flows.');
  });
});

describe('contractHeadline', () => {
  it('names the one re-routed link that has no contract test', () => {
    const model = modelOf(shop());
    expect(contractHeadline(model, contractEvidence(model))).toBe(
      'The re-routed call “ProductPage” has no contract test.',
    );
  });

  it('names the one new link that has no contract test', () => {
    const model = modelOf(sameDay());
    expect(contractHeadline(model, contractEvidence(model))).toBe(
      'The new call “GET /api/slots” has no contract test.',
    );
    expect(evidenceLine(contractEvidence(model))).toBe(
      'Two contract tests cover two links between services.',
    );
  });

  it('is content when every link has a test, and counts the links', () => {
    const model = modelOf(orderNotes());
    const evidence = contractEvidence(model);
    expect(contractHeadline(model, evidence)).toBe(
      'Every new or re-routed call has a contract test.',
    );
    expect(evidenceLine(evidence)).toBe('Two contract tests cover three links between services.');
  });
});

describe('coverageHeadline', () => {
  it('names the change with unit tests only', () => {
    const head = coverageHeadline(modelOf(sameDay()));
    expect(head.headline).toBe('Every change has a test, but one has unit tests only.');
    expect(head.weakest?.kind).toBe('Unit tests only');
    expect(head.weakest?.ids).toEqual(['chg:product-same-day']);
  });

  it('says the thin spot in the flows when every change has an end-to-end test', () => {
    const model = modelOf(orderNotes());
    expect(coverageHeadline(model).headline).toBe(
      'Every change has a test, and each is covered end to end.',
    );
    const reach = e2eHeadline(model).reach;
    expect(coverageHeadline(model, { reach }).headline).toBe(
      'Every change has a test, but no end-to-end test covers “Cancel an order”.',
    );
  });

  it('adds the tests that never run what they prove', () => {
    const head = coverageHeadline(modelOf(sameDay()));
    expect(head.rest).toBe('One test claims a change but never runs its steps.');
  });
});
