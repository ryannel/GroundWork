// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import {
  deciding,
  firstSentenceMd,
  metaOf,
  optionsOf,
  tiesOf,
  titleOf,
  whenOf,
} from '@/application/plan-viz-decision';
import { shortDate, stateTone, stateWord } from '@/application/plan-viz-state';
import { DecisionCard } from '@/features/plan/viz/decisions/decision-card';

vi.mock('server-only', () => ({}));

afterEach(cleanup);

async function modelWithDecisions() {
  const { readPlan } = await import('@/infrastructure/plan-store');
  const loaded = await readPlan('alder-finch', 'delivery-promise');
  const plan = loaded.plan!;
  const team = plan.work_items![0]!.team;
  return derive({
    ...plan,
    decisions: [
      {
        id: 'dec:ship-it',
        title: 'Ship it **now**',
        status: 'accepted',
        decider: team,
        decided_on: '2020-03-04',
        reversibility: 'one-way',
        context: 'We need it soon. Nothing else is ready.',
        decision: 'Ship it.',
        consequences: 'Support carries the load.',
        options: [{ name: 'Wait', why_not: 'Too slow.' }],
      },
      {
        id: 'dec:later',
        title: 'Pick a colour',
        status: 'deferred',
        decide_by: '2099-01-02',
      },
      {
        id: 'dec:draft',
        title: 'Name it',
        status: 'proposed',
        decider: team,
        decide_by: '2001-05-06',
      },
    ],
    questions: [
      {
        id: 'q:why',
        question: 'Context here. Why is it slow?',
        status: 'open',
        decide_by: '2001-05-06',
      },
    ],
  });
}

describe('decision words', () => {
  it('words states and dates for the reader', () => {
    expect(stateWord('superseded')).toBe('replaced');
    expect(stateWord('open')).toBe('open');
    expect(stateTone('accepted')).toBe('added');
    expect(stateTone('nonsense')).toBe('neutral');
    const today = new Date('2026-06-01T00:00:00Z');
    expect(shortDate('2026-10-16', today)).toBe('16 Oct');
    expect(shortDate('2027-02-26', today)).toBe('26 Feb 2027');
    expect(shortDate('soon', today)).toBe('soon');
  });

  it('takes the first sentence and keeps its markdown', () => {
    expect(firstSentenceMd('A [[dec:x]] thing. And more.')).toBe('A [[dec:x]] thing.');
    expect(firstSentenceMd('No stop')).toBe('No stop');
    expect(firstSentenceMd()).toBe('');
  });

  it('says when each kind of decision stands', async () => {
    const model = await modelWithDecisions();
    const at = (id: string) => whenOf(deciding(model, id)!);
    expect(at('dec:ship-it')).toEqual({ label: 'on', date: '2020-03-04', pending: false });
    expect(at('dec:later')).toEqual({ label: 'revisit by', date: '2099-01-02', pending: false });
    expect(at('dec:draft')).toEqual({ label: 'by', date: '2001-05-06', pending: true });
  });

  it('flags a pending date that has passed', async () => {
    const model = await modelWithDecisions();
    const draft = metaOf(deciding(model, 'dec:draft')!, new Date('2026-06-01T00:00:00Z'));
    expect(draft.when?.late).toBe(true);
    expect(draft.verb).toBe('decides');
    const later = metaOf(deciding(model, 'dec:later')!, new Date('2026-06-01T00:00:00Z'));
    expect(later.when?.late).toBe(false);
    const done = metaOf(deciding(model, 'dec:ship-it')!);
    expect(done.verb).toBe('decided');
    expect(done.door).toBe('hard to reverse');
  });

  it('lists the chosen option first and the rest with why not', async () => {
    const model = await modelWithDecisions();
    const options = optionsOf(deciding(model, 'dec:ship-it')!);
    expect(options.map((o) => o.name)).toEqual(['Ship it now', 'Wait']);
    expect(options[1]?.why).toBe('Too slow.');
    expect(optionsOf(deciding(model, 'dec:later')!)).toEqual([]);
    expect(titleOf(deciding(model, 'q:why')!)).toBe('Why is it slow?');
  });

  it('finds what is tied to a decision', async () => {
    const model = await modelWithDecisions();
    const ties = tiesOf(model, deciding(model, 'dec:ship-it')!);
    expect(ties.risks).toEqual([]);
    expect(ties.answers).toEqual([]);
  });
});

describe('DecisionCard', () => {
  it('shows a settled decision without repeating its state', async () => {
    const model = await modelWithDecisions();
    const { container } = render(
      <DecisionCard e={deciding(model, 'dec:ship-it')!} model={model} />,
    );
    const text = container.textContent;
    expect(text).toContain('Ship it now');
    expect(text).toContain('We need it soon.');
    expect(text).not.toContain('Nothing else is ready');
    expect(text).toContain('Support carries the load.');
    expect(text).toContain('1 other option');
    expect(text).toContain('hard to reverse');
    expect(container.querySelector('[data-inspect="dec:ship-it"]')).not.toBeNull();
    expect(container.querySelector('time')?.getAttribute('datetime')).toBe('2020-03-04');
  });

  it('names a deferred state and a missed date', async () => {
    const model = await modelWithDecisions();
    const later = render(<DecisionCard e={deciding(model, 'dec:later')!} model={model} />);
    expect(later.container.textContent).toContain('deferred');
    expect(later.container.textContent).toContain('revisit by');
    cleanup();
    const draft = render(<DecisionCard e={deciding(model, 'dec:draft')!} model={model} />);
    expect(draft.container.textContent).toContain('overdue');
  });

  it('draws a question as a question', async () => {
    const model = await modelWithDecisions();
    const { container } = render(<DecisionCard e={deciding(model, 'q:why')!} model={model} />);
    expect(container.textContent).toContain('Why is it slow?');
    expect(container.querySelector('[data-inspect="q:why"]')).not.toBeNull();
  });
});
