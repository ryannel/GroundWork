import { describe, expect, it } from 'vitest';

import { dispatchDate } from '@/../test/fixtures/acme/plans/work-dispatch';
import { modelOf } from '@/../test/plan-kit';
import type { Decision, Question } from '@/domain/plan/plan.generated';

import {
  deciding,
  firstSentenceMd,
  isDecision,
  metaOf,
  numberOf,
  optionsOf,
  sayStateOnCard,
  stateOf,
  tiesOf,
  titleOf,
  whenOf,
} from './plan-viz-decision';

const decision = (extra: Partial<Decision> = {}): Decision => ({
  id: 'dec:price',
  title: 'Use **daily** prices',
  status: 'proposed',
  ...extra,
});
const question = (extra: Partial<Question> = {}): Question => ({
  id: 'q:price',
  question: 'Context first. Which price?',
  status: 'open',
  ...extra,
});
const today = new Date('2026-11-06T12:00:00Z');

describe('decision and question cards', () => {
  it('uses a plain decision title and the actual question, with or without a model', () => {
    expect(isDecision(decision())).toBe(true);
    expect(isDecision(question())).toBe(false);
    expect(titleOf(decision())).toBe('Use daily prices');
    expect(titleOf(question())).toBe('Which price?');
    const model = modelOf(dispatchDate());
    expect(titleOf(deciding(model, 'dec:days-not-dates')!, model)).toBe('Store days, not dates');
    expect(titleOf(deciding(model, 'q:which-regions')!, model)).toBe(
      'Which regions show a date first?',
    );
    expect(deciding(model, 'missing')).toBeUndefined();
    expect(numberOf(model, 'dec:days-not-dates')).toBe('D1');
  });
  it.each(['proposed', 'accepted', 'deferred', 'rejected', 'superseded'] as const)(
    'shows %s only when the group heading does not already say it',
    (status) => {
      const value = decision({ status });
      expect(stateOf(value)).toBe(status);
      expect(sayStateOnCard(value)).toBe(['deferred', 'rejected', 'superseded'].includes(status));
    },
  );
  it.each(['open', 'resolved'] as const)(
    'does not repeat the %s question group state',
    (status) => {
      expect(sayStateOnCard(question({ status }))).toBe(false);
    },
  );
  it('keeps markdown and references in the first sentence while normalising whitespace', () => {
    expect(firstSentenceMd('  A [[sch:price]] **value**.\n\n More follows! ')).toBe(
      'A [[sch:price]] **value**.',
    );
    expect(firstSentenceMd('Which price?\tOther question?')).toBe('Which price?');
    expect(firstSentenceMd('Use it! More.')).toBe('Use it!');
    expect(firstSentenceMd('  No\nstop ')).toBe('No stop');
    expect(firstSentenceMd()).toBe('');
  });
  it('distinguishes a due date, deferred revisit, past closed date and actual decision date', () => {
    expect(whenOf(decision())).toBeNull();
    expect(whenOf(decision({ decide_by: '2026-11-05' }))).toEqual({
      label: 'by',
      date: '2026-11-05',
      pending: true,
    });
    expect(whenOf(decision({ status: 'deferred', decide_by: '2026-11-05' }))).toEqual({
      label: 'revisit by',
      date: '2026-11-05',
      pending: false,
    });
    for (const status of ['rejected', 'superseded'] as const) {
      expect(whenOf(decision({ status, decide_by: '2026-11-05' }))).toEqual({
        label: 'was due',
        date: '2026-11-05',
        pending: false,
      });
    }
    expect(
      whenOf(decision({ status: 'accepted', decided_on: '2026-11-04', decide_by: '2026-11-05' })),
    ).toEqual({ label: 'on', date: '2026-11-04', pending: false });
    expect(whenOf(decision({ status: 'accepted', decide_by: '2026-11-05' }))).toBeNull();
    expect(whenOf(question({ status: 'resolved', decide_by: '2026-11-05' }))).toBeNull();
  });
  it('marks only overdue pending dates, retaining missing deciders and unknown reversibility', () => {
    expect(metaOf(decision(), today)).toEqual({
      decider: null,
      verb: 'decides',
      when: null,
      door: '',
    });
    expect(
      metaOf(
        decision({ decider: 'team:pricing', reversibility: 'one-way', decide_by: '2026-11-05' }),
        today,
      ),
    ).toEqual({
      decider: 'team:pricing',
      verb: 'decides',
      when: { label: 'by', date: '2026-11-05', pending: true, text: '5 Nov', late: true },
      door: 'hard to reverse',
    });
    expect(
      metaOf(
        decision({ reversibility: 'two-way', status: 'accepted', decided_on: '2026-11-05' }),
        today,
      ),
    ).toMatchObject({ verb: 'decided', door: 'easy to reverse', when: { late: false } });
    expect(metaOf(decision({ status: 'deferred', decide_by: '2026-11-05' }), today)).toMatchObject({
      verb: 'owns it',
      when: { late: false },
    });
    expect(metaOf(decision({ decide_by: '2026-11-06' }), today).when?.late).toBe(false);
    expect(metaOf(decision({ decide_by: '2026-11-07' }), today).when?.late).toBe(false);
    const noClock: { readonly today?: Date } = {};
    expect(metaOf(decision({ decide_by: '2026-11-05' }), noClock.today).when).toMatchObject({
      text: '5 Nov 2026',
      late: false,
    });
    expect(metaOf(question({ decide_by: '2026-11-05' }), today)).toMatchObject({
      verb: 'decides',
      door: '',
      when: { late: true },
    });
  });
  it('shows the chosen option first and retains a visible empty reason on an undocumented alternative', () => {
    const value = decision({
      options: [{ name: '**Weekly** prices', why_not: 'Too stale.' }, { name: '`Live` prices' }],
    });
    expect(optionsOf(value)).toEqual([
      { name: 'Use daily prices', chosen: true, why: '' },
      { name: 'Weekly prices', chosen: false, why: 'Too stale.' },
      { name: 'Live prices', chosen: false, why: '' },
    ]);
    expect(optionsOf(value, modelOf(dispatchDate()))).toEqual(optionsOf(value));
    expect(optionsOf(decision())).toEqual([]);
    expect(optionsOf(question())).toEqual([]);
  });
  it('separates accepted risks from other waiting work and includes questions answered by the decision', () => {
    const value = dispatchDate();
    value.risks = [
      { id: 'risk:price', statement: 'Prices lag.', accepted_by: 'dec:days-not-dates' },
      { id: 'risk:other', statement: 'Another risk.' },
    ];
    value.questions = [
      {
        id: 'q:answered',
        question: 'Which form?',
        status: 'resolved',
        answered_by: 'dec:days-not-dates',
      },
    ];
    const base = modelOf(value);
    const model = {
      ...base,
      weightOf: (id: string) => ({
        ...base.weightOf(id),
        ids: ['risk:price', 'wi:publish-v2'],
        notes: ['Waiting on the choice.'],
      }),
    };
    expect(tiesOf(model, deciding(model, 'dec:days-not-dates')!)).toEqual({
      risks: ['risk:price'],
      answers: ['q:answered'],
      waiting: ['wi:publish-v2'],
      notes: ['Waiting on the choice.'],
    });
    expect(tiesOf(model, question())).toEqual({
      risks: [],
      answers: [],
      waiting: ['risk:price', 'wi:publish-v2'],
      notes: ['Waiting on the choice.'],
    });
  });
});
