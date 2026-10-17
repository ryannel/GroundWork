import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { issueMarkdown, issueSections } from '@/application/plan/issues';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const model = async () => derive(await loadFixture('mini.yaml'));

describe('issueMarkdown', () => {
  it('lays a work item out in the built-in task template', async () => {
    const md = issueMarkdown(await model(), 'wi:pause-endpoint');
    expect(
      md.startsWith('### Summary\n\nBuild POST /subscriptions/{id}/pause (`api:subs-pause`)'),
    ).toBe(true);
    expect(md).toContain('- [ ] status: enum(active, cancelled) → enum(active, paused, cancelled)');
    expect(md).toContain('Pause contract');
    expect(md).toContain('Given an active sub');
    expect([...md.matchAll(/^### (.+)$/gmu)].map((m) => m[1])).toEqual([
      'Summary',
      'Why',
      'How',
      'Acceptance Criteria',
      'Notes/Risks',
    ]);
  });

  it('lists the questions an item waits on, once, and marks them overdue after their date', async () => {
    const m = await model();
    const md = issueMarkdown(m, 'wi:pause-endpoint', { today: '2026-10-09' });
    expect(md).toContain(
      '#### Waits on\n\n- [ ] Can trials pause? (`q:trial-pause`) — Subscriptions · decide by 2026-10-10\n',
    );
    expect(md).not.toContain('Open question: Can trials pause');
    expect(issueMarkdown(m, 'wi:pause-endpoint', { today: '2026-10-11' })).toContain(
      'decide by 2026-10-10 (**overdue**)',
    );
  });

  it('lists what an item depends on', async () => {
    const md = issueMarkdown(await model(), 'wi:retire');
    expect(md).toContain('#### Depends on\n\n- [ ] Billing consumes v2 (`wi:billing-v2`)');
  });

  it('says so when no tests verify the item, and is empty for an unknown item', async () => {
    const m = await model();
    expect(issueSections(m, 'wi:retire')?.acceptance).toBe(
      '- [ ] _No tests listed in verified_by_',
    );
    expect(issueSections(m, 'wi:nope')).toBeNull();
    expect(issueMarkdown(m, 'wi:nope')).toBe('');
  });

  it('fills a template passed in', async () => {
    const md = issueMarkdown(await model(), 'wi:retire', {
      template: { fields: [{ id: 'what', label: 'What', required: true }] },
    });
    expect(md.startsWith('### What\n\n')).toBe(true);
  });

  it('links the decisions, open questions and risks around the item it implements', async () => {
    const plan = await loadFixture('mini.yaml');
    const wi = plan.work_items?.find((w) => w.id === 'wi:pause-endpoint');
    const change = plan.changes?.find((c) => c.id === wi?.implements[0]);
    if (wi === undefined || change === undefined) throw new Error('fixture changed');
    Object.assign(change, { decisions: ['dec:links'] });
    plan.decisions = [
      ...(plan.decisions ?? []),
      { id: 'dec:links', title: 'Keep links', status: 'accepted' },
    ];
    plan.questions = [
      ...(plan.questions ?? []),
      { id: 'q:links', question: 'Which links?', status: 'open', blocks: [change.id] },
    ];
    plan.risks = [
      ...(plan.risks ?? []),
      { id: 'risk:links', statement: 'Links rot', about: [change.id] },
    ];
    const md = issueMarkdown(derive(plan), wi.id, { today: '2026-10-09' });
    expect(md).toContain('- Decision: Keep links (`dec:links`, accepted)');
    expect(md).toContain('- Risk: Links rot (`risk:links`)');
    expect(md).toContain('- Plan: ');
  });

  it('turns citations in prose into labels and says who is waiting on whom', async () => {
    const plan = await loadFixture('mini.yaml');
    const wi = plan.work_items?.find((w) => w.id === 'wi:pause-endpoint');
    const q = plan.questions?.find((x) => x.id === 'q:trial-pause');
    if (wi === undefined || q === undefined) throw new Error('fixture changed');
    wi.body = 'Build [[api:subs-pause]] now.';
    delete q.decider;
    delete q.decide_by;
    const md = issueMarkdown(derive(plan), wi.id);
    expect(md).toContain('Build ');
    expect(md).not.toContain('[[');
    expect(md).toContain('— no decider · no decide-by date');
  });
});
