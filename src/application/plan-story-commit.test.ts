import { describe, expect, it } from 'vitest';

import {
  ORDER_NOTES_DONE,
  orderNotes,
  orderNotesUnfiled,
} from '@/../test/fixtures/acme/plans/chapters-order-notes';
import { sameDay, sameDayConfident } from '@/../test/fixtures/acme/plans/chapters-same-day';
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
import {
  hasCommitment,
  ratersLine,
  voteHead,
  voteRule,
} from '@/application/plan-story-commit-vote';
import { voteSummary } from '@/application/plan-viz-vote';
import type { Plan } from '@/domain/plan/plan.generated';

const PLANS: readonly (readonly [string, Plan])[] = [
  ['a draft with a low vote', sameDay()],
  ['a confident draft', sameDayConfident()],
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
    const model = modelOf(sameDayConfident());
    const ask = askOf(model);
    expect(ask.stage).toBe('draft');
    expect(ask.headline).toBe(
      'Catalogue, Web and Orders owe two answers and two decisions the plan waits on; the first is due 5 Jun.',
    );
  });

  it('puts a low vote before the owner’s approval', () => {
    const model = modelOf(sameDay());
    const ask = askOf(model);
    expect(ask.headline).toMatch(/^Payments is not confident \(2 of 5\)/u);
    expect(ask.lede).toBe(
      'A rating under 3 means the plan is rethought before its owner approves it.',
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

describe('the confidence ratings', () => {
  it('heads them by the state of the plan and says the rule once', () => {
    const model = modelOf(sameDay());
    const vote = voteSummary(model);
    expect(hasCommitment(model)).toBe(true);
    expect(voteHead(model, vote, false)).toBe('Confidence ratings');
    expect(voteRule(model, vote)).not.toContain('Below 3');
    expect(voteRule(model, vote)).toMatch(/^Each team building something rates from 1 to 5/u);
    expect(voteHead(model, vote, true)).toMatch(/^Confidence in /u);
  });

  it('says how many teams have rated when none is below 3', () => {
    const model = modelOf(sameDayConfident());
    const vote = voteSummary(model);
    expect(vote.low).toHaveLength(0);
    expect(voteHead(model, vote, false)).toMatch(
      /teams have rated their confidence, and none is below 3\.$/u,
    );
    expect(voteRule(model, vote)).toContain('Below 3, the plan is rethought.');
  });

  it('names the teams that rate', () => {
    const model = modelOf(sameDayConfident());
    expect(ratersLine(model, voteSummary(model))).toMatch(/^Teams that rate: .+\.$/u);
  });
});
