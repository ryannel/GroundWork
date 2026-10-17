import { describe, expect, it, vi } from 'vitest';

import { newWarnings, stablePath } from '@/application/plan/baseline';
import { validatePlan } from '@/application/plan/validate-plan';
import type { Plan } from '@/domain/plan/plan.generated';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const at = (plan: Plan) => ({ plan, warnings: validatePlan(plan).warnings });

function change(p: Plan, id: string) {
  const found = p.changes?.find((c) => c.id === id);
  if (found === undefined) throw new Error(`no ${id}`);
  return found;
}

describe('warning baseline', () => {
  it('positions resolve to ids, and ops to what they target', async () => {
    const p = await loadFixture('mini.yaml');
    expect(stablePath(p, 'flows[0].steps[1].via')).toBe(
      'flows[flow:cancel].steps[flow:cancel#publish].via',
    );
    const ops = change(p, 'chg:status-event-v2').ops;
    const i = ops.findIndex((o) => 'deprecate' in o);
    expect(stablePath(p, `changes[1].ops[${String(i)}]`)).toBe(
      'changes[chg:status-event-v2].ops[deprecate msg:status-changed-v1]',
    );
    expect(stablePath(p, 'changes[99].ops[0]')).toBe('changes[99].ops[0]');
  });

  it('names an add op by what it adds', () => {
    const plan = {
      changes: [
        {
          id: 'chg:x',
          ops: [
            { add: 'flows', value: { id: 'flow:y' } },
            { add: 'schemas', into: 'sch:z', value: { name: 'extra' } },
            { add: 'schemas', value: {} },
            { other: 1 },
          ],
        },
      ],
    };
    expect(stablePath(plan, 'changes[0].ops[0]')).toBe('changes[chg:x].ops[add flow:y]');
    expect(stablePath(plan, 'changes[0].ops[1]')).toBe('changes[chg:x].ops[add sch:z.extra]');
    expect(stablePath(plan, 'changes[0].ops[2]')).toBe('changes[chg:x].ops[2]');
    expect(stablePath(plan, 'changes[0].ops[3]')).toBe('changes[chg:x].ops[3]');
  });

  it('reordering lists and inserting ops adds no new warnings', async () => {
    const base = await loadFixture('mini.yaml');
    expect(validatePlan(base).warnings).toHaveLength(1);
    const head = await loadFixture('mini.yaml');
    head.changes?.reverse();
    change(head, 'chg:status-event-v2').ops.reverse();
    const w = validatePlan(head).warnings;
    expect(w).toHaveLength(1);
    expect(newWarnings(at(base), at(head))).toEqual([]);
  });

  it('a new warning is reported even when an old one is fixed', async () => {
    const base = await loadFixture('mini.yaml');
    const head = await loadFixture('mini.yaml');
    head.tests = (head.tests ?? []).filter((t) => t.id !== 'tst:no-email');
    const fresh = newWarnings(at(base), at(head));
    expect(fresh.length).toBeGreaterThanOrEqual(1);
    const dupe = { path: 'x[0]', message: 'm' };
    expect(
      newWarnings({ plan: {}, warnings: [dupe] }, { plan: {}, warnings: [dupe, dupe] }),
    ).toHaveLength(1);
    const swapped = newWarnings(
      { plan: {}, warnings: [dupe, { path: 'y', message: 'n' }] },
      { plan: {}, warnings: [{ path: 'z', message: 'o' }] },
    );
    expect(swapped).toHaveLength(1);
  });
});
