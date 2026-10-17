import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';

import { planBarOf } from './plan-bar';
import { outlineOf } from './plan-pages';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const at = { workspace: 'shop', slug: 'mini' };

describe('the plan bar', () => {
  it('names the stage, the teams and the version of a plan without a ledger', async () => {
    const plan = await loadFixture('mini.yaml');
    const model = derive(plan, {});
    const bar = planBarOf(model, outlineOf(model, at));
    expect(bar.stage).toEqual({ word: 'Draft', tone: 'neutral' });
    expect(bar.teams.map((t) => t.id)).toEqual(plan.teams.map((t) => t.id));
    expect(bar.versions).toEqual({ label: 'v1.0', items: [], historyHref: null });
  });

  it('lists the ledger newest first, with the one in force approved', async () => {
    const plan = await loadFixture('mini.yaml');
    plan.meta.status = 'review';
    plan.meta.version = '1.1';
    plan.meta.revisions = [
      { version: '0.9', status: 'approved', date: '2026-09-01' },
      { version: '1.0', status: 'approved', date: '2026-09-20', approved_on: '2026-09-22' },
      { version: '1.1', status: 'proposed', date: '2026-10-01', summary: 'Pause **sooner**' },
    ];
    const model = derive(plan, {});
    const bar = planBarOf(model, outlineOf(model, at));
    expect(bar.stage.word).toBe('In review');
    expect(bar.versions?.label).toBe('v1.1 proposed');
    expect(bar.versions?.historyHref).toBe('/shop/plans/mini/versions/history/');
    expect(bar.versions?.items.map((v) => [v.version, v.state])).toEqual([
      ['1.1', 'proposed'],
      ['1.0', 'approved'],
      ['0.9', 'superseded'],
    ]);
    expect(bar.versions?.items[0]).toMatchObject({
      summary: 'Pause sooner',
      href: '/shop/plans/mini/versions/v1.1/',
    });
    expect(bar.versions?.items[1]?.date).toMatch(/^22 Sep/u);
  });

  it('reads the old word committed as approved', async () => {
    const plan = await loadFixture('mini.yaml');
    plan.meta.status = 'committed';
    const model = derive(plan, {});
    expect(planBarOf(model, outlineOf(model, at)).stage).toEqual({
      word: 'Approved',
      tone: 'added',
    });
  });
});
