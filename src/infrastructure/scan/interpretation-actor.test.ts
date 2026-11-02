import { describe, expect, it, vi } from 'vitest';

import { interpretationFixture } from '@/../test/scan-interpretation-kit';

import { interpretationValidator } from './interpretation-format';

vi.mock(import('server-only'), () => ({}));

describe('grounded capabilities with unknown actors', () => {
  it('retains supported actions and journeys without inventing an actor claim', async () => {
    const { document, inputs } = interpretationFixture();
    document.claims = document.claims.filter(
      (claim) => !['actor', 'relationship'].includes(claim.kind),
    );
    for (const claim of document.claims) {
      if (claim.kind === 'action' || claim.kind === 'journey') {
        claim.actor = null;
        claim.limitations.push('The actor is not established by the inspected handler.');
      }
    }
    document.attempts = document.attempts.map((attempt) =>
      ['actor', 'relationship'].includes(attempt.area)
        ? {
            ...attempt,
            outcome: 'insufficient_context',
            claim_ids: [],
            reason: 'No supported actor or relationship was found.',
          }
        : attempt,
    );
    const validate = await interpretationValidator(inputs);
    expect(validate(document).claims.map((claim) => claim.kind)).toEqual([
      'purpose',
      'action',
      'journey',
    ]);
    expect(
      validate(document)
        .claims.filter((claim) => claim.kind === 'action' || claim.kind === 'journey')
        .every((claim) => claim.actor === null),
    ).toBe(true);
  });
  it.each(['inferred:purpose', 'inferred:missing'])(
    'rejects non-null actor reference %s',
    async (actor) => {
      const { document, inputs } = interpretationFixture();
      const action = document.claims.find((claim) => claim.kind === 'action')!;
      action.actor = actor;
      const validate = await interpretationValidator(inputs);
      expect(() => validate(document)).toThrow('actor must reference an actor claim');
    },
  );
  it('requires an explicit actor field even when its value can be unknown', async () => {
    const { document, inputs } = interpretationFixture();
    const claims = document.claims.map((claim) =>
      claim.kind === 'action'
        ? Object.fromEntries(Object.entries(claim).filter(([key]) => key !== 'actor'))
        : claim,
    );
    const validate = await interpretationValidator(inputs);
    expect(() => validate({ ...document, claims })).toThrow("required property 'actor'");
  });
});
