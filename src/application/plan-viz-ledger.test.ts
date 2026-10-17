// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { dispatchDate } from '@/../test/fixtures/acme/plans/work-dispatch';
import { modelOf } from '@/../test/plan-kit';
import { healthTiles, keepersOf, ledgerGroups } from '@/application/plan-viz-ledger';
import {
  changeService,
  changeTargets,
  kindsUsed,
  ledgerRow,
  proofLine,
} from '@/application/plan-viz-ledger-row';

const load = () => modelOf(dispatchDate());

describe('ledger rows', () => {
  it('describes a change by what it touches, proves and builds', () => {
    const model = load();
    const id = 'chg:dispatch-field';
    const row = ledgerRow(model, id, 1)!;
    expect(row.number).toBe(1);
    expect(row.title).toBe('Products carry the days until dispatch');
    expect(row.targets).toEqual(['sch:product', 'flow:publish-product']);
    expect(row.teams).toEqual(['team:catalogue']);
    expect(row.kinds).toEqual([
      { kind: 'add', n: 1 },
      { kind: 'modify', n: 2 },
    ]);
    expect(row.ops.map((o) => o.text)).toEqual([
      'dispatch_days int',
      'price_cents required: true → false',
      'what it does: (none) → The merchandiser enters the dispatch days with the price.',
    ]);
    expect(row.tests).toEqual(['tst:dispatch-unit']);
    expect(row.items).toEqual(['wi:dispatch-field']);
    expect(row.decisions).toEqual(['dec:days-not-dates']);
    expect(changeTargets(model, id)).toEqual(row.targets);
    expect(changeService(model, id)).toBe('svc:products');
    expect(kindsUsed(model, [id])).toEqual(['add', 'modify']);
  });

  it('is null for a change that is not in the plan', () => {
    expect(ledgerRow(load(), 'chg:nope', 1)).toBeNull();
  });

  it('spells the proof out', () => {
    expect(proofLine(0, 0)).toBe('no test yet · no work item yet');
    expect(proofLine(2, 1)).toBe('2 tests · 1 work item');
  });
});

describe('ledger groups', () => {
  it('numbers every change once whichever way it is grouped', () => {
    const model = load();
    const total = model.plan.changes!.length;
    expect(total).toBe(6);
    expect(ledgerGroups(model, { groupBy: 'service' }).map((g) => g.rows.length)).toEqual([
      3, 1, 1, 1,
    ]);
    for (const groupBy of ['service', 'team', 'none'] as const) {
      const rows = ledgerGroups(model, { groupBy }).flatMap((g) => g.rows);
      expect(rows).toHaveLength(total);
      expect(new Set(rows.map((r) => r.number)).size).toBe(total);
    }
  });

  it('keeps one team’s changes behind a lens', () => {
    const model = load();
    const kept = ledgerGroups(model, { groupBy: 'none', lens: 'team:orders' }).flatMap(
      (g) => g.rows,
    );
    expect(kept.map((r) => [r.number, r.id])).toEqual([[4, 'chg:orders-read-dispatch']]);
  });

  it('names the teams whose lens keeps each change, as the lens itself does', () => {
    const model = load();
    const keepers = keepersOf(model);
    for (const team of model.plan.teams.map((t) => t.id)) {
      const kept = ledgerGroups(model, { groupBy: 'none', lens: team }).flatMap((g) => g.rows);
      const named = (model.plan.changes ?? []).filter((c) => keepers(c.id).includes(team));
      expect(named.map((c) => c.id)).toEqual(kept.map((r) => r.id));
    }
    expect(keepers('chg:orders-read-dispatch')).toContain('team:orders');
  });
});

describe('health tiles', () => {
  it('shows all seven, or only the ones asked for, in that order', () => {
    const model = load();
    expect(healthTiles(model).map((t) => t.key)).toEqual([
      'changes',
      'tests',
      'issues',
      'untested',
      'orphans',
      'questions',
      'errors',
    ]);
    expect(healthTiles(model, ['errors', 'changes']).map((t) => t.key)).toEqual([
      'errors',
      'changes',
    ]);
    expect(healthTiles(model).map((t) => [t.key, t.value, t.tone])).toEqual([
      ['changes', 6, 'plain'],
      ['tests', 5, 'plain'],
      ['issues', 6, 'plain'],
      ['untested', 0, 'good'],
      ['orphans', 2, 'warn'],
      ['questions', 1, 'warn'],
      ['errors', 0, 'good'],
    ]);
    expect(healthTiles(model, ['orphans'])[0]!.ids).toEqual([
      'api:products-get',
      'api:orders-cancel',
    ]);
  });
});
