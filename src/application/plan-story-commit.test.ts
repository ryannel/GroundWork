import { describe, expect, it, vi } from 'vitest';

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
import { PLANS } from '@/features/plan/chapters/chapter-kit';

vi.mock('server-only', () => ({}));

const { planData } = await import('@/infrastructure/plan-data');

async function modelOf(plan: string) {
  const data = await planData({ workspace: 'alder-finch', plan });
  if (data === null) throw new Error(`no ${plan}`);
  return data.model;
}

describe('commit headlines', () => {
  it('names who still has to accept, not a card title', async () => {
    const model = await modelOf('delivery-promise');
    expect(choicesHeadline(model, choicesOf(model))).toBe(
      'Product management and Pricing still have to accept two choices; four of the plan’s choices would be hard to reverse once built.',
    );
    expect(choicesLede(choicesOf(model))).toBe(
      'Who must decide the rest, and by when, is on the last page.',
    );
  });

  it('says every choice is accepted once nothing is proposed', async () => {
    const model = await modelOf('stock-reservation');
    expect(choicesHeadline(model, choicesOf(model))).toMatch(
      /^Every choice is accepted; the hardest to undo: /,
    );
  });

  it('counts risks by how they are handled', async () => {
    const model = await modelOf('delivery-promise');
    const risks = risksBySeverity(model);
    expect(risksHeadline(model, risks)).toBe(
      'Biggest risk: the promise is systematically wrong in one region.',
    );
    expect(risksLede(risks)).toMatch(
      /^Eight risks, biggest first: three owned, three mitigated, one accepted as the price of a decision and one resolved\./,
    );
  });

  it('says what is kept apart from the choices', async () => {
    const model = await modelOf('delivery-promise');
    const rest = restGroups(registerGroups(model));
    expect(restHeadline(rest)).toBe('Nothing else here blocks the plan.');
    expect(restLede(rest)).toBe(
      'One deferred, one loose end, one discovery note and two set aside. Kept here for the record.',
    );
  });

  it('counts what each team owes while the plan is a draft', async () => {
    const model = await modelOf('storefront-graph');
    const ask = askOf(model);
    expect(ask.stage).toBe('draft');
    expect(ask.headline).toBe(
      'Fulfilment, Pricing and Storefront owe five answers and one decision the plan waits on; the first is due 4 Nov.',
    );
  });

  it('puts a low vote before the owner’s approval', async () => {
    const model = await modelOf('delivery-promise');
    const ask = askOf(model);
    expect(ask.headline).toMatch(/^Legal is not confident \(2 of 5\)/);
    expect(ask.lede).toBe(
      'A rating under 3 means the plan is rethought before its owner approves it.',
    );
  });

  it('gives the approval date, then the delivery date', async () => {
    expect(askOf(await modelOf('invoice-vat-number')).headline).toBe('Approved 25 Sep.');
    expect(askOf(await modelOf('stock-reservation')).headline).toBe('Delivered 27 Aug.');
  });

  it.each(PLANS)('gives every other open item a reason in %s', async (plan) => {
    const { also } = askOf(await modelOf(plan));
    for (const { why } of also) expect(why).toMatch(/^(settled with D\d+|nothing waits on it)$/);
  });
});

describe('the confidence ratings', () => {
  it('heads them by the state of the plan and says the rule once', async () => {
    const model = await modelOf('delivery-promise');
    const vote = voteSummary(model);
    expect(hasCommitment(model)).toBe(true);
    expect(voteHead(model, vote, false)).toBe('Confidence ratings');
    expect(voteRule(model, vote)).not.toContain('Below 3');
    expect(voteRule(model, vote)).toMatch(/^Each team building something rates from 1 to 5/);
    expect(voteHead(model, vote, true)).toMatch(/^Confidence in /);
  });

  it('says how many teams have rated when none is below 3', async () => {
    const model = await modelOf('storefront-graph');
    const vote = voteSummary(model);
    expect(vote.low).toHaveLength(0);
    expect(voteHead(model, vote, false)).toMatch(
      /teams have rated their confidence, and none is below 3\.$/,
    );
    expect(voteRule(model, vote)).toContain('Below 3, the plan is rethought.');
  });

  it('names the teams that rate', async () => {
    const model = await modelOf('storefront-graph');
    expect(ratersLine(model, voteSummary(model))).toMatch(/^Teams that rate: .+\.$/);
  });
});
