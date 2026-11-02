import { describe, expect, it, vi } from 'vitest';

import { interpretationFixture } from '@/../test/scan-interpretation-kit';

import { interpretationValidator } from './interpretation-format';

vi.mock(import('server-only'), () => ({}));

describe('honest unknown interpretation metadata', () => {
  it('retains actual author identities while accepting historical unknown authors', async () => {
    const { document, inputs } = interpretationFixture();
    const validate = await interpretationValidator(inputs);
    expect(validate(document).runs[0]!.author_ids).toBeUndefined();
    document.runs[0]!.author_ids = ['author:actual'];
    expect(validate(document).runs[0]!.author_ids).toEqual(['author:actual']);
    for (const authors of [[], [''], ['author:actual', 'author:actual']]) {
      const runs = [{ ...document.runs[0]!, author_ids: authors }];
      expect(() => validate({ ...document, runs })).toThrow('ScanInterpretation');
    }
  });
  it.each([
    [null, null],
    [null, '2026-10-25T12:01:00Z'],
    ['2026-10-25T12:00:00Z', null],
  ])('accepts unavailable execution times %s and %s', async (started, finished) => {
    const { document, inputs } = interpretationFixture();
    const run = document.runs[0]!;
    run.started_at = started;
    run.finished_at = finished;
    run.method =
      'Genuine model interpretation of the supplied pinned context; actual execution timing was not retained. Null fields are unknown, not serialisation timestamps.';
    const actor = document.claims.find((claim) => claim.kind === 'actor')!;
    actor.actor_type = 'unknown';
    actor.goal = null;
    actor.limitations.push('The supplied evidence does not establish an actor category or goal.');
    const validate = await interpretationValidator(inputs);
    expect(validate(document).runs[0]).toMatchObject({
      started_at: started,
      finished_at: finished,
    });
    expect(validate(document).claims.find((claim) => claim.kind === 'actor')).toMatchObject({
      actor_type: 'unknown',
      goal: null,
    });
  });

  it('still rejects reversed known execution times', async () => {
    const { document, inputs } = interpretationFixture();
    document.runs[0]!.finished_at = '2026-10-25T11:59:00Z';
    const validate = await interpretationValidator(inputs);
    expect(() => validate(document)).toThrow('finishes before it starts');
  });

  it.each(['started_at', 'finished_at'])('still requires the %s field', async (field) => {
    const { document, inputs } = interpretationFixture();
    const validate = await interpretationValidator(inputs);
    const run = { ...document.runs[0] };
    Reflect.deleteProperty(run, field);
    expect(() => validate({ ...document, runs: [run] })).toThrow(`required property '${field}'`);
  });

  it('still requires actor goal to be explicitly known or unknown', async () => {
    const { document, inputs } = interpretationFixture();
    const validate = await interpretationValidator(inputs);
    const claims = document.claims.map((claim) =>
      claim.kind === 'actor'
        ? Object.fromEntries(Object.entries(claim).filter(([key]) => key !== 'goal'))
        : claim,
    );
    expect(() => validate({ ...document, claims })).toThrow("required property 'goal'");
  });

  it.each(['started_at', 'finished_at'])('rejects malformed non-null %s', async (field) => {
    const { document, inputs } = interpretationFixture();
    const validate = await interpretationValidator(inputs);
    expect(() =>
      validate({ ...document, runs: [{ ...document.runs[0], [field]: 'unknown' }] }),
    ).toThrow('date-time');
  });
});
