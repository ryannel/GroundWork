import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import type { Plan } from '@/domain/plan/plan.generated';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

/** mini.yaml plus a decision of every status and questions that cite and answer them. */
async function withRegister(): Promise<Plan> {
  const p = await loadFixture('mini.yaml');
  p.decisions = [
    ...(p.decisions ?? []),
    {
      id: 'dec:open',
      title: 'Open one',
      status: 'proposed',
      context: 'Needs the answer to [[q:side]].',
    },
    { id: 'dec:later', title: 'Later', status: 'deferred' },
    { id: 'dec:no', title: 'No', status: 'rejected' },
    { id: 'dec:old', title: 'Old', status: 'superseded' },
    { id: 'dec:loose', title: 'Loose', status: 'proposed' },
  ];
  p.questions = [
    ...(p.questions ?? []),
    {
      id: 'q:answered',
      question: 'Which version?',
      status: 'resolved',
      answer: 'v2',
      answered_by: 'dec:version-event',
    },
    { id: 'q:side', question: 'Side question?', status: 'open' },
    { id: 'q:done', question: 'Done?', status: 'resolved', answer: 'Yes' },
  ];
  return p;
}

describe('the decision register', () => {
  it('sorts decisions and questions into groups by what the plan rests on them', async () => {
    const m = derive(await withRegister());
    const groups = Object.fromEntries(
      m.decisionRegister().map((g) => [g.key, g.items.map((e) => e.id)]),
    );
    expect(groups.decided).toContain('dec:version-event');
    expect(groups.deferred).toEqual(['dec:later']);
    expect(groups.aside).toEqual(expect.arrayContaining(['dec:no', 'dec:old']));
    expect(groups.loose).toEqual(expect.arrayContaining(['dec:loose', 'q:side']));
    expect(groups.notes).toEqual(['q:done']);
    expect(groups.decide).toContain('q:trial-pause');
  });
  it('seats a question right after the decision that answers it', async () => {
    const m = derive(await withRegister());
    expect(m.answersOf('dec:version-event').map((q) => q.id)).toEqual(['q:answered']);
    const items = m.registerGroup('dec:version-event')?.items.map((e) => e.id) ?? [];
    expect(items[items.indexOf('dec:version-event') + 1]).toBe('q:answered');
    expect(m.registerGroup('q:answered')?.key).toBe('decided');
    expect(m.registerGroup('svc:subs')).toBeNull();
  });
  it('links a decision and a question that cite each other, either way', async () => {
    const m = derive(await withRegister());
    expect(m.bearsOn('dec:open')).toEqual(['q:side']);
    expect(m.bearsOn('q:side')).toEqual(['dec:open']);
    expect(m.bearsOn('dec:version-event')).toEqual([]);
    expect(m.bearsOn('q:answered')).toEqual([]);
    expect(m.bearsOn('svc:subs')).toEqual([]);
  });
  it('counts what rests on an open question', async () => {
    const m = derive(await withRegister());
    expect(m.weightOf('q:trial-pause').total).toBeGreaterThan(0);
    expect(m.weightOf('q:side').total).toBe(0);
    expect(m.questionState('q:trial-pause')).toBe('open');
    expect(m.questionState('q:done')).toBe('resolved');
  });
});
