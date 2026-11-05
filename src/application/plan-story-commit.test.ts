import { describe, expect, it } from 'vitest';

import {
  ORDER_NOTES_DONE,
  orderNotes,
  orderNotesUnfiled,
} from '@/../test/fixtures/acme/plans/chapters-order-notes';
import { sameDay } from '@/../test/fixtures/acme/plans/chapters-same-day';
import { modelOf } from '@/../test/plan-kit';
import {
  choicesHeadline,
  choicesLede,
  choicesOf,
  registerGroups,
  restGroups,
  restHeadline,
  restLede,
  risksBySeverity,
  risksHeadline,
  risksLede,
} from '@/application/plan-story-commit';
import { askOf } from '@/application/plan-story-commit-ask';
import type { Plan } from '@/domain/plan/plan.generated';

const PLANS: readonly (readonly [string, Plan])[] = [
  ['a draft', sameDay()],
  ['an approved plan', orderNotesUnfiled()],
  ['a plan in delivery', orderNotes()],
];

describe('commit headlines', () => {
  it('names who still has to accept, not a card title', () => {
    const model = modelOf(sameDay());
    expect(choicesHeadline(model, choicesOf(model))).toBe(
      'Web and Orders still have to accept two choices; three of the plan’s choices would be hard to reverse once built.',
    );
    expect(choicesLede(choicesOf(model))).toBe(
      'Who must decide the rest, and by when, is on the last page.',
    );
  });

  it('says every choice is accepted once nothing is proposed', () => {
    const model = modelOf(orderNotes());
    expect(choicesHeadline(model, choicesOf(model))).toMatch(
      /^Every choice is accepted; the hardest to undo: /u,
    );
  });

  it('counts risks by how they are handled', () => {
    const model = modelOf(sameDay());
    const risks = risksBySeverity(model);
    expect(risksHeadline(model, risks)).toBe('Biggest risk: a courier misses the slot.');
    expect(risksLede(risks)).toMatch(
      /^Five risks, biggest first: two owned, one mitigated, one accepted as the price of a decision and one resolved\./u,
    );
  });

  it('says what is kept apart from the choices', () => {
    const model = modelOf(sameDay());
    const rest = restGroups(registerGroups(model));
    expect(restHeadline(rest)).toBe('Nothing else here blocks the plan.');
    expect(restLede(rest)).toBe(
      'One deferred, one loose end, one discovery note and two set aside. Kept here for the record.',
    );
  });

  it('counts what each team owes while the plan is a draft', () => {
    const model = modelOf(sameDay());
    const ask = askOf(model);
    expect(ask.stage).toBe('draft');
    expect(ask.headline).toBe(
      'Catalogue, Web and Orders owe two answers and two decisions the plan waits on; the first is due 5 Jun.',
    );
  });

  it('gives the approval date, then the delivery date', () => {
    expect(askOf(modelOf(orderNotes())).headline).toBe('Approved 25 Mar.');
    expect(askOf(modelOf(orderNotes(), { status: ORDER_NOTES_DONE })).headline).toBe(
      'Delivered 27 May.',
    );
  });

  it('says what else is open while the plan is a draft', () => {
    expect(askOf(modelOf(sameDay())).also.map((a) => [a.e.id, a.why])).toEqual([
      ['q:which-cities', 'settled with D3'],
      ['dec:badge-colour', 'nothing waits on it'],
    ]);
  });

  it.each(PLANS)('gives every other open item a reason in %s', (_, plan) => {
    const { also } = askOf(modelOf(plan));
    for (const { why } of also) expect(why).toMatch(/^(settled with D\d+|nothing waits on it)$/u);
  });
});
