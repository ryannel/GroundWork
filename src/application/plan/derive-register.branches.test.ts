import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import type { Plan } from '@/domain/plan/plan.generated';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const EXECUTION = {
  summary: 'Built behind [[dec:switch]], see the flag.',
  paths: [
    {
      name: 'Happy',
      steps: [
        { label: 'One', detail: 'Start' },
        { label: 'Two', detail: 'End' },
      ],
    },
  ],
  caveats: [
    'Waits on [[dec:switch|the switch]] and **[[q:side]]**.',
    'Only `[[dec:switch]]` decides this.',
    'Holds until [[q:side]] is asked.',
    'Both [[q:side]] and [[dec:switch]].',
  ],
} satisfies NonNullable<Plan['execution']>;

/** mini.yaml with caveats, non-goals and a register that cites itself from odd places. */
async function withCitations(): Promise<Plan> {
  const p = await loadFixture('mini.yaml');
  p.execution = EXECUTION;
  p.problem.non_goals = ['Nothing that needs [[q:side]]'];
  p.problem.why = 'Because of [[dec:switch]].';
  p.decisions = [
    ...(p.decisions ?? []),
    {
      id: 'dec:switch',
      title: 'Flip a switch',
      status: 'proposed',
      decision: 'We flip [[dec:switch]] when ready.',
    },
  ];
  p.questions = [
    ...(p.questions ?? []),
    { id: 'q:side', question: 'Side question?', status: 'open' },
    {
      id: 'q:blocking-resolved',
      question: 'Settled and blocking?',
      status: 'resolved',
      blocks: ['chg:pause-api'],
    },
    {
      id: 'q:answered-by-change',
      question: 'Answered by a change?',
      status: 'open',
      answered_by: 'chg:pause-api',
    },
  ];
  return p;
}

describe('the decision register, from caveats and odd citations', () => {
  it('reads each caveat in plain words, naming the entry itself as this decision or question', async () => {
    const m = derive(await withCitations());
    const decision = m.weightOf('dec:switch').notes;
    expect(decision).toEqual([
      'a caveat in how it gets built',
      'the caveat “Only this decision decides this.”',
      'the caveat “Both Side question? and this decision.”',
    ]);
    const question = m.weightOf('q:side').notes;
    expect(question).toContain('the caveat “Waits on the switch and this question.”');
    expect(question).toContain('the caveat “Holds until this question is asked.”');
    expect(question).toContain('a non-goal');
  });

  it('weighs a decision by its notes only, not by citing itself or the problem', async () => {
    const m = derive(await withCitations());
    const w = m.weightOf('dec:switch');
    expect(w.ids).toEqual([]);
    expect(w.total).toBe(w.notes.length);
    expect(m.registerGroup('dec:switch')?.key).toBe('decide');
  });

  it('settles a resolved question that blocks a change, and keeps one answered by a non-decision in play', async () => {
    const m = derive(await withCitations());
    expect(m.registerGroup('q:blocking-resolved')?.key).toBe('decided');
    expect(m.registerGroup('q:answered-by-change')?.key).toBe('loose');
  });

  it('works out a question state from the plan, the object given, or open', async () => {
    const m = derive(await withCitations());
    expect(m.questionState({ id: 'q:blocking-resolved', status: 'open' })).toBe('resolved');
    expect(m.questionState({ id: 'q:nowhere', status: 'resolved' })).toBe('resolved');
    expect(m.questionState({ status: 'resolved' })).toBe('resolved');
    expect(m.questionState({})).toBe('open');
    expect(m.questionState('q:nowhere')).toBe('open');
  });

  it('copes with a plan that has decisions but no risks or questions', async () => {
    const p = await loadFixture('mini.yaml');
    delete p.risks;
    delete p.questions;
    const m = derive(p);
    expect(m.weightOf('dec:version-event').ids).toContain('chg:status-event-v2');
    expect(m.bearsOn('dec:version-event')).toEqual([]);
    expect(m.answersOf('dec:version-event')).toEqual([]);
    expect(m.registerGroup('dec:version-event')?.key).toBe('decided');
  });

  it('builds a register of questions alone when the plan has no decisions', async () => {
    const p = await loadFixture('mini.yaml');
    delete p.decisions;
    const m = derive(p);
    expect(m.registerGroup('q:trial-pause')?.key).toBe('decide');
    expect(m.decisionRegister().flatMap((g) => g.items.map((e) => e.id))).toEqual([
      'q:trial-pause',
    ]);
  });
});
