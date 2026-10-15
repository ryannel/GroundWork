// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';

import { contractFindings } from './plan-viz-contract-matrix';
import {
  changedLinksWithoutTest,
  contractPairs,
  interfacePairs,
  linkWord,
} from './plan-viz-contracts';
import {
  gapNotes,
  levelStats,
  provesWithoutWalking,
  pyramidRows,
  runsLine,
  testInfo,
} from './plan-viz-tests';

vi.mock('server-only', () => ({}));

const { readPlan } = await import('@/infrastructure/plan-store');

async function modelOf(slug: string) {
  const loaded = await readPlan('alder-finch', slug);
  return derive(loaded.plan!);
}

const slugs = ['delivery-promise', 'stock-reservation', 'storefront-graph', 'invoice-vat-number'];

describe('the test levels', () => {
  it('counts tests and changes per level, and shows the pyramid end-to-end first', async () => {
    for (const slug of slugs) {
      const model = await modelOf(slug);
      const st = levelStats(model);
      expect(st.m).toBe(model.coverage().rows.length);
      const rows = pyramidRows(model, st);
      expect(rows.map((r) => r.level)).toEqual(st.levels.toReversed());
      expect(rows.reduce((n, r) => n + r.tests, 0)).toBe(st.tests.length);
      for (const r of rows) {
        expect(r.width).toBe(r.tests === 0 ? 0 : Math.max(8, r.width));
        expect(r.width).toBeLessThanOrEqual(100);
      }
      expect(gapNotes(model, st).every((n) => n.count > 0)).toBe(true);
    }
  });

  it('narrows to a team', async () => {
    const model = await modelOf('delivery-promise');
    const team = model.plan.teams[0]!.id;
    const st = levelStats(model, team);
    expect(st.m).toBeLessThanOrEqual(levelStats(model).m);
    expect(provesWithoutWalking(model, team).length).toBeLessThanOrEqual(
      provesWithoutWalking(model).length,
    );
  });

  it('describes a planned test and the places tests run', async () => {
    const model = await modelOf('delivery-promise');
    const test = model.plan.tests![0]!;
    const info = testInfo(model, test.id);
    expect(info.tip).toContain('Planned');
    expect(info.tip).toContain(test.id);
    expect(info.label).toContain('planned');
    expect(testInfo(model, 'tst:nothing').name).toBe('tst:nothing');
    expect(runsLine(['ci'])).toBe('runs in every build');
    expect(runsLine(['ci', 'staging'])).toBe('runs on every build · staging');
  });
});

describe('the contracts', () => {
  it('pairs every contract test with the services it checks', async () => {
    for (const slug of slugs) {
      const model = await modelOf(slug);
      const tests = (model.plan.tests ?? []).filter((t) => t.level === 'contract').map((t) => t.id);
      expect(new Set(contractPairs(model).map((p) => p.test))).toEqual(new Set(tests));
      const f = contractFindings(model);
      expect(f.rows.every((r) => r.cells.length === f.providers.length)).toBe(true);
      expect(f.missing).toHaveLength(changedLinksWithoutTest(model).length);
      expect(interfacePairs(model).every((p) => p.consumer !== '' && p.provider !== '')).toBe(true);
    }
  });

  it('says whether a link is a call or an event', () => {
    expect(linkWord('msg:a')).toBe('event');
    expect(linkWord('api:a')).toBe('call');
  });

  it('dims what is outside a team', async () => {
    const model = await modelOf('delivery-promise');
    const f = contractFindings(model, model.plan.teams[0]!.id);
    expect(f.rows.every((r) => typeof r.dim === 'boolean')).toBe(true);
  });
});
