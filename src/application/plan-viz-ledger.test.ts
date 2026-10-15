// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { healthTiles, ledgerGroups } from '@/application/plan-viz-ledger';
import {
  changeService,
  changeTargets,
  kindsUsed,
  ledgerRow,
  proofLine,
} from '@/application/plan-viz-ledger-row';

vi.mock('server-only', () => ({}));

async function load(slug = 'delivery-promise') {
  const { readPlan } = await import('@/infrastructure/plan-store');
  const loaded = await readPlan('alder-finch', slug);
  return derive(loaded.plan!);
}

describe('ledger rows', () => {
  it('describes a change by what it touches, proves and builds', async () => {
    const model = await load();
    const id = model.plan.changes![0]!.id;
    const row = ledgerRow(model, id, 1)!;
    expect(row.num).toBe(1);
    expect(row.targets.length).toBeGreaterThan(0);
    expect(row.targets.length).toBeLessThanOrEqual(3);
    expect(row.kinds.every((k) => k.n > 0)).toBe(true);
    expect(row.ops.length).toBeGreaterThan(0);
    expect(changeTargets(model, id)).toContain(row.targets[0]);
    expect(typeof changeService(model, id) === 'string' || changeService(model, id) === null).toBe(
      true,
    );
    expect(kindsUsed(model, [id]).length).toBeGreaterThan(0);
  });

  it('is null for a change that is not in the plan', async () => {
    expect(ledgerRow(await load(), 'chg:nope', 1)).toBeNull();
  });

  it('spells the proof out', () => {
    expect(proofLine(0, 0)).toBe('no test yet · no work item yet');
    expect(proofLine(2, 1)).toBe('2 tests · 1 work item');
  });
});

describe('ledger groups', () => {
  it('numbers every change once whichever way it is grouped', async () => {
    const model = await load();
    const total = model.plan.changes!.length;
    for (const groupBy of ['service', 'team', 'none'] as const) {
      const rows = ledgerGroups(model, { groupBy }).flatMap((g) => g.rows);
      expect(rows).toHaveLength(total);
      expect(new Set(rows.map((r) => r.num)).size).toBe(total);
    }
  });

  it('keeps one team’s changes behind a lens', async () => {
    const model = await load();
    const team = model.plan.teams[0]!.id;
    const kept = ledgerGroups(model, { groupBy: 'none', lens: team }).flatMap((g) => g.rows);
    expect(kept.length).toBeLessThanOrEqual(model.plan.changes!.length);
    expect(kept.every((r) => r.num >= 1)).toBe(true);
  });
});

describe('health tiles', () => {
  it('shows all seven, or only the ones asked for, in that order', async () => {
    const model = await load();
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
    const errors = healthTiles(model, ['errors'])[0]!;
    expect(errors.tone).toBe(errors.value > 0 ? 'bad' : 'good');
  });
});
