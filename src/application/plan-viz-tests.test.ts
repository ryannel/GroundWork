// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { shop } from '@/../test/federation-kit';
import { pauseOrders } from '@/../test/fixtures/acme/plans/pause-orders';
import { checkoutContracts } from '@/../test/fixtures/acme/plans/work-contracts';
import { dispatchDate } from '@/../test/fixtures/acme/plans/work-dispatch';
import { modelOf } from '@/../test/plan-kit';

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

const plans = [dispatchDate, checkoutContracts, shop, pauseOrders];

function notes(plan: () => Parameters<typeof modelOf>[0]) {
  const model = modelOf(plan());
  return gapNotes(model, levelStats(model)).map((n) => n.text);
}

describe('the test levels', () => {
  it('counts tests and changes per level, and shows the pyramid end-to-end first', () => {
    for (const plan of plans) {
      const model = modelOf(plan());
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

  it('notes the gaps each plan leaves', () => {
    expect(notes(dispatchDate)).toEqual([
      'no end-to-end test for 5 changes',
      '1 change has unit tests only',
    ]);
    expect(notes(checkoutContracts)).toEqual(['1 new link without a contract test']);
  });

  it('narrows to a team', () => {
    const model = modelOf(dispatchDate());
    expect(levelStats(model).m).toBe(6);
    expect(levelStats(model, 'team:orders').m).toBe(1);
    expect(provesWithoutWalking(model)).toEqual([
      { test: 'tst:shop-e2e', change: 'chg:shop-shows-date' },
      { test: 'tst:no-v1-left', change: 'chg:retire-v1' },
    ]);
    expect(provesWithoutWalking(model, 'team:orders')).toEqual([]);
  });

  it('describes a planned test and the places tests run', () => {
    const model = modelOf(dispatchDate());
    const info = testInfo(model, 'tst:dispatch-unit');
    expect(info.tip).toBe(
      'Planned unit test (no result yet) · A product saves its dispatch days · tst:dispatch-unit · runs in every build',
    );
    expect(info.label).toBe('planned unit test: A product saves its dispatch days');
    expect(testInfo(model, 'tst:nothing').name).toBe('tst:nothing');
    expect(runsLine(['ci'])).toBe('runs in every build');
    expect(runsLine(['ci', 'staging'])).toBe('runs on every build · staging');
  });
});

describe('the contracts', () => {
  it('pairs every contract test with the services it checks', () => {
    for (const plan of plans) {
      const model = modelOf(plan());
      const tests = (model.plan.tests ?? []).filter((t) => t.level === 'contract').map((t) => t.id);
      expect(new Set(contractPairs(model).map((p) => p.test))).toEqual(new Set(tests));
      const f = contractFindings(model);
      expect(f.rows.every((r) => r.cells.length === f.providers.length)).toBe(true);
      expect(f.missing).toHaveLength(changedLinksWithoutTest(model).length);
      expect(interfacePairs(model).every((p) => p.consumer !== '' && p.provider !== '')).toBe(true);
    }
  });

  it('finds the providers, the test that checks no call and the new link with no test', () => {
    const f = contractFindings(modelOf(checkoutContracts()));
    expect(f.providers).toEqual([
      'svc:shop-bff',
      'svc:order-api',
      'svc:payments',
      'svc:card-provider',
      'svc:search-api',
      'svc:products',
    ]);
    expect(f.orphans).toEqual(['tst:receipt-contract']);
    expect(f.missing).toMatchObject([
      { consumer: 'svc:payments', provider: 'svc:order-api', via: 'msg:order-placed' },
    ]);
  });

  it('says whether a link is a call or an event', () => {
    expect(linkWord('msg:a')).toBe('event');
    expect(linkWord('api:a')).toBe('call');
  });

  it('dims what is outside a team', () => {
    const f = contractFindings(modelOf(checkoutContracts()), 'team:payments');
    expect(f.rows.filter((r) => !r.dim).map((r) => r.consumer)).toEqual(['svc:payments']);
    expect(f.rows.filter((r) => r.dim)).toHaveLength(4);
  });
});
