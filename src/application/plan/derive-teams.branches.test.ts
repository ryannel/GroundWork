import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import type { Plan } from '@/domain/plan/plan.generated';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

/**
 * mini.yaml where Subscriptions decides questions that point every which way: at a decision not in the plan, at a
 * proposed decision Billing owns (whose change reworks the cancel page), at work items, and from a risk.
 */
async function withQuestions(): Promise<Plan> {
  const p = await loadFixture('mini.yaml');
  p.screens = [{ id: 'scr:cancel', name: 'Cancel page', service: 'svc:web' }];
  p.flows = (p.flows ?? []).map((f) =>
    f.id === 'flow:cancel'
      ? {
          ...f,
          steps: f.steps.map((s) =>
            s.id === 'flow:cancel#request' ? { ...s, screen: 'scr:cancel' } : s,
          ),
        }
      : f,
  );
  p.decisions = [
    ...(p.decisions ?? []),
    { id: 'dec:pending', title: 'Reword the page', status: 'proposed', decider: 'team:billing' },
  ];
  p.changes = [
    ...(p.changes ?? []),
    {
      id: 'chg:page',
      title: 'Reword the cancel page',
      decisions: ['dec:pending'],
      ops: [{ modify: 'scr:cancel', set: { name: 'Cancel or pause' } }],
    },
  ];
  p.questions = [
    ...(p.questions ?? []),
    {
      id: 'q:settled',
      question: 'Settled?',
      decider: 'team:subs',
      status: 'resolved',
      answered_by: 'dec:ghost',
      blocks: ['chg:retire-email'],
    },
    {
      id: 'q:feeds',
      question: 'Feeds the page?',
      decider: 'team:subs',
      status: 'resolved',
      answer: 'See [[dec:pending]].',
    },
    {
      id: 'q:work',
      question: 'Which work?',
      decider: 'team:subs',
      status: 'open',
      blocks: ['wi:skip', 'wi:ghost'],
    },
  ];
  p.risks = [
    ...(p.risks ?? []),
    { id: 'risk:loose', statement: 'Nobody answers [[q:work]].', owner: 'team:subs' },
  ];
  return p;
}

describe('a team’s cut, from the questions it decides', () => {
  it('shows the screen a proposed decision it feeds would change, and the steps that show it', async () => {
    const cut = derive(await withQuestions()).teamCut('team:subs');
    expect([...cut.decides].toSorted((a, b) => a.localeCompare(b))).toEqual([
      'flow:cancel',
      'flow:cancel#request',
      'scr:cancel',
    ]);
    expect(cut.has('scr:cancel')).toBe(true);
  });

  it('takes in its questions, and risks it owns even with nothing they are about', async () => {
    const cut = derive(await withQuestions()).teamCut('team:subs');
    expect(cut.questions).toEqual(
      expect.arrayContaining(['q:trial-pause', 'q:settled', 'q:feeds', 'q:work']),
    );
    expect(cut.risks).toContain('risk:loose');
  });

  it('cuts a team that only meets a removed step through what it fans out to', async () => {
    const cut = derive(await withQuestions()).teamCut('team:web');
    expect(cut.flows).toContain('flow:cancel');
    expect(cut.steps).not.toContain('flow:cancel#legacy-email');
    expect(cut.decides.size).toBe(0);
  });

  it('cuts a plan with no questions or risks', async () => {
    const p = await loadFixture('mini.yaml');
    delete p.questions;
    delete p.risks;
    const cut = derive(p).teamCut('team:billing');
    expect(cut.questions).toEqual([]);
    expect(cut.risks).toEqual([]);
    expect(cut.changes).toContain('chg:skip-paused');
  });
});
