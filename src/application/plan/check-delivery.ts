import type { Report } from '@/application/plan/check-context';
import type { Plan, Test, WorkItem } from '@/domain/plan/plan.generated';

/** Check 7: every change is proven by a test and delivered by a work item. */
function checkChangesCovered(plan: Plan, rep: Report): void {
  const tests = plan.tests ?? [];
  const items = plan.work_items ?? [];
  for (const [i, c] of (plan.changes ?? []).entries()) {
    if (!tests.some((t) => t.proves.includes(c.id))) {
      rep.strict(
        ['changes', i],
        `${c.id} has no test (no tests[].proves lists it); add a test with proves: [${c.id}]`,
      );
    }
    if (!items.some((w) => w.implements.includes(c.id))) {
      rep.strict(
        ['changes', i],
        `${c.id} has no work item (no work_items[].implements lists it); add it to a work item's implements`,
      );
    }
  }
}

function checkItemVerified(
  [i, w]: readonly [number, WorkItem],
  tests: ReadonlyMap<string, Test>,
  rep: Report,
): void {
  for (const [j, tid] of (w.verified_by ?? []).entries()) {
    const t = tests.get(tid);
    if (t !== undefined && !t.proves.some((c) => w.implements.includes(c))) {
      const changes = w.implements.length > 0 ? w.implements.join(', ') : 'none';
      rep.err(
        ['work_items', i, 'verified_by', j],
        `${tid} proves none of ${w.id}'s changes (${changes}); drop it from verified_by, or add the change to ${tid}.proves if it really proves it`,
      );
    }
  }
}

function checkItemsVerified(plan: Plan, rep: Report): void {
  const testById = new Map((plan.tests ?? []).map((t) => [t.id, t]));
  for (const [i, t] of (plan.tests ?? []).entries()) {
    if (t.proves.length === 0)
      rep.warn(['tests', i, 'proves'], `${t.id} proves no change; fill proves, or delete the test`);
  }
  for (const entry of (plan.work_items ?? []).entries()) {
    const [i, w] = entry;
    if (w.implements.length === 0) {
      rep.err(
        ['work_items', i, 'implements'],
        `${w.id} must implement at least one change; list the change(s) it delivers in implements`,
      );
    }
    checkItemVerified(entry, testById, rep);
  }
}

/** Elementary cycles in work item depends_on (each reported once). */
function findCycles(items: readonly WorkItem[]): string[][] {
  const deps = new Map(items.map((w) => [w.id, w.depends_on ?? []]));
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  const seen = new Set<string>();
  const visit = (id: string): void => {
    state.set(id, 1);
    stack.push(id);
    for (const d of deps.get(id) ?? []) {
      if (!deps.has(d)) continue;
      if (state.get(d) === 1) {
        const cyc = stack.slice(stack.indexOf(d));
        const key = cyc.toSorted((x, y) => x.localeCompare(y)).join(',');
        if (!seen.has(key)) {
          seen.add(key);
          cycles.push(cyc);
        }
      } else if (!state.has(d)) visit(d);
    }
    stack.pop();
    state.set(id, 2);
  };
  for (const id of deps.keys()) if (!state.has(id)) visit(id);
  return cycles;
}

function checkLaterMilestone(plan: Plan, rep: Report): void {
  const items = plan.work_items ?? [];
  const byId = new Map(items.map((w) => [w.id, w]));
  const msIndex = new Map((plan.milestones ?? []).map((m, i) => [m.id, i]));
  const rank = (w: WorkItem | undefined): number | undefined =>
    w?.milestone === undefined ? undefined : msIndex.get(w.milestone);
  for (const [i, w] of items.entries()) {
    for (const [j, dep] of (w.depends_on ?? []).entries()) {
      const d = byId.get(dep);
      const mine = rank(w);
      const theirs = rank(d);
      if (d !== undefined && mine !== undefined && theirs !== undefined && theirs > mine) {
        rep.err(
          ['work_items', i, 'depends_on', j],
          `${w.id} (${String(w.milestone)}) depends on ${dep}, which is in a later milestone (${String(d.milestone)}); move ${dep} earlier, ${w.id} later, or drop the dependency`,
        );
      }
    }
  }
}

/** Check 8: depends_on is acyclic and never points at a later milestone. */
function checkDependencies(plan: Plan, rep: Report): void {
  const items = plan.work_items ?? [];
  const wiIndex = new Map(items.map((w, i) => [w.id, i]));
  for (const cycle of findCycles(items)) {
    const first = cycle[0] ?? '';
    rep.err(
      ['work_items', wiIndex.get(first) ?? 0, 'depends_on'],
      `dependency cycle: ${[...cycle, first].join(' → ')}; drop one dependency, or split the item that both needs and is needed`,
    );
  }
  checkLaterMilestone(plan, rep);
}

/** Checks 7 and 8: changes are tested and implemented; work items are coherent and ordered. */
export function checkDelivery(plan: Plan, rep: Report): void {
  checkChangesCovered(plan, rep);
  checkItemsVerified(plan, rep);
  checkDependencies(plan, rep);
}
