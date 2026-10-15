// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  type Choices,
  choicesHeadline,
  choicesLede,
  choicesOf,
  itemCount,
  type RegisterGroup,
  restGroups,
  restHeadline,
  restLede,
  risksBySeverity,
  risksHeadline,
  risksLede,
} from '@/application/plan-story-commit';
import type { Decision, Risk } from '@/domain/plan/plan.generated';

vi.mock('server-only', () => ({}));

const { planData } = await import('@/infrastructure/plan-data');

async function modelOf(plan: string) {
  const data = await planData({ workspace: 'alder-finch', plan });
  if (data === null) throw new Error(`no ${plan}`);
  return data.model;
}

const model = await modelOf('delivery-promise');
const all = choicesOf(model);
const [first] = [...all.proposed, ...all.accepted];
if (first === undefined) throw new Error('delivery-promise has no decisions');
const none: Choices = { proposed: [], accepted: [], answered: [] };
type Edit<T> = { readonly [K in keyof T]?: T[K] | undefined };
const defined = <T extends object>(base: T, edit: Edit<T>): T =>
  Object.fromEntries(Object.entries({ ...base, ...edit }).filter(([, v]) => v !== undefined)) as T;
const decision = (edit: Edit<Decision>): Decision => defined(first, edit);
const [risk] = risksBySeverity(model);
if (risk === undefined) throw new Error('delivery-promise has no risks');
const riskOf = (edit: Edit<Risk>): Risk => defined(risk, edit);

describe('the choices headline', () => {
  it('says when no decision is recorded', () => {
    expect(choicesHeadline(model, none)).toBe('No decisions recorded yet.');
    expect(choicesLede(none)).toBe('');
  });

  it('turns a lone accepted choice that opens with a verb into what was decided', () => {
    const only = decision({ title: 'Use carrier cut-offs.', decider: undefined });
    expect(choicesHeadline(model, { ...none, accepted: [only] })).toBe(
      'The plan’s owner decided to use carrier cut-offs.',
    );
  });

  it('quotes the decision when the title does not open with a verb', () => {
    const only = decision({
      title: 'Cut-off source',
      decision: 'Carriers publish their own cut-offs. Nothing else.',
      decider: undefined,
    });
    expect(choicesHeadline(model, { ...none, accepted: [only] })).toBe(
      'The plan’s owner decided: carriers publish their own cut-offs.',
    );
  });

  it('gives the date when the decision only repeats the title', () => {
    const only = decision({
      title: 'Cut-off source',
      decision: 'Cut-off source.',
      decider: undefined,
      decided_on: '2026-09-03',
    });
    expect(choicesHeadline(model, { ...none, accepted: [only] })).toMatch(
      /^The plan’s owner made this choice on .+\.$/,
    );
    const undated = decision({
      title: 'Cut-off source',
      decision: '',
      decider: undefined,
      decided_on: undefined,
    });
    expect(choicesHeadline(model, { ...none, accepted: [undated] })).toBe(
      'The plan’s owner made this choice.',
    );
  });

  it('says every choice is accepted, naming none when all can be undone', () => {
    const two = [
      decision({ id: 'D1', reversibility: 'two-way' }),
      decision({ id: 'D2', reversibility: 'two-way' }),
    ];
    expect(choicesHeadline(model, { ...none, accepted: two })).toBe('Every choice is accepted.');
  });

  it('counts unowned proposals without naming a team', () => {
    const one = decision({ decider: undefined, reversibility: 'one-way' });
    expect(choicesHeadline(model, { ...none, proposed: [one] })).toBe(
      'One choice still has to be accepted; it would be hard to reverse once built.',
    );
    const both = [one, decision({ id: 'D9', decider: undefined, reversibility: 'one-way' })];
    expect(choicesHeadline(model, { ...none, proposed: both })).toBe(
      'Two choices still have to be accepted; both would be hard to reverse once built.',
    );
  });

  it('says how many accepted choices are hard to undo', () => {
    const accepted = [decision({ reversibility: 'one-way' })];
    expect(choicesLede({ ...none, accepted })).toBe('One would be hard to reverse once built.');
  });
});

describe('the risks headline', () => {
  it('says when no risk is recorded', () => {
    expect(risksHeadline(model, [])).toBe('No risks recorded.');
    expect(risksLede([])).toBe('');
  });

  it('gives the only risk’s handling and owner', () => {
    expect(risksHeadline(model, [riskOf({ owner: undefined, roam: 'owned' })])).toBe(
      'The one risk is open, and nobody owns it.',
    );
  });

  it('says when every risk is resolved', () => {
    const rs = [riskOf({ roam: 'resolved' }), riskOf({ id: 'R9', roam: 'resolved' })];
    expect(risksHeadline(model, rs)).toBe('All two risks are resolved.');
    expect(risksLede(rs)).toBe(
      'Two risks, biggest first: two resolved. The grid places each risk by likelihood and impact.',
    );
  });
});

describe('the rest of the register', () => {
  it('fills in empty groups and says nothing is left to track', () => {
    const rest = restGroups([]);
    expect(rest.map((g) => g.key)).toEqual(['deferred', 'loose', 'notes', 'aside']);
    expect(restHeadline(rest)).toBe('Nothing else to track.');
    expect(restLede(rest)).toBe('');
  });

  it('names a group it has no word for by its key', () => {
    const odd: RegisterGroup = { key: 'odd', label: 'Odd', note: '', items: [first] };
    expect(restLede([odd])).toBe('One odd. Kept here for the record.');
    expect(itemCount(2)).toMatch(/items/);
  });
});
