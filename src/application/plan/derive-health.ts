import type { Core } from '@/application/plan/derive-core';
import type { createCoverage } from '@/application/plan/derive-coverage';
import type { Delivery } from '@/application/plan/derive-delivery';
import type { Register } from '@/application/plan/derive-register';
import { memo } from '@/application/plan/derive-values';
import { parentOf, refsOf } from '@/application/plan/ids';
import type { Findings } from '@/application/plan/validate-plan';
import type { PlanNode } from '@/domain/plan/plan-graph';

const ORPHAN_TYPES = new Set([
  'service',
  'store',
  'schema',
  'endpoint',
  'message',
  'interface',
  'screen',
]);

interface HealthParts {
  register: Register;
  delivery: Delivery;
  coverage: ReturnType<typeof createCoverage>['coverage'];
  validation: () => Findings;
}

type Graph = Core['asIs'];

/** What a graph itself reaches: an interface through its endpoints, a graph's types and its gateway's GraphQL interface. */
function reachedInGraph(g: Graph, referenced: Set<string>): void {
  for (const i of g.interfaces) {
    if (i.endpoints.some((e) => referenced.has(e.id))) referenced.add(i.id);
  }
  for (const t of g.schemas) {
    if (t.kind === 'graph-type' && t.graph !== undefined && g.has(t.graph)) referenced.add(t.id);
  }
  for (const i of g.interfaces) {
    const served = g.graphs.some(
      (gr) => gr.gateway === i.service && g.operations.some((o) => o.graph === gr.id),
    );
    if (i.protocol === 'graphql' && served) referenced.add(i.id);
  }
}

/** Every id something points at, and the parent of each. */
function referencedIds(core: Core, register: Register): Set<string> {
  const referenced = new Set<string>();
  const note = (id: string | null | undefined): void => {
    if (typeof id !== 'string') return;
    referenced.add(id);
    const p = parentOf(id);
    if (p !== null && p !== '') referenced.add(p);
  };
  const noteRefs = (n: PlanNode | undefined): void => {
    if (n !== undefined) for (const r of refsOf(n.$type, n)) note(r.id);
  };
  for (const id of core.unionIds) noteRefs(core.sys(id));
  for (const pe of core.planIndex.values()) for (const r of refsOf(pe.$type, pe)) note(r.id);
  for (const r of core.records) {
    note(r.target);
    note(r.parent);
    note(r.replacedBy);
  }
  for (const id of register.citedBy.keys()) note(id);
  for (const g of [core.asIs, core.toBe]) reachedInGraph(g, referenced);
  return referenced;
}

/** Things nothing refers to, and the counts that say whether the plan is in shape. */
export function createHealth(core: Core, parts: HealthParts) {
  const { plan, records, changes, tests, workItems, unionIds, sys } = core;
  const { register, delivery, coverage, validation } = parts;

  const orphans = memo((): string[] => {
    const referenced = referencedIds(core, register);
    return unionIds.filter((id) => {
      const n = sys(id);
      return n !== undefined && ORPHAN_TYPES.has(n.$type) && !referenced.has(id);
    });
  });

  const health = memo(() => {
    const v = validation();
    const gaps = coverage().gaps;
    return {
      changes: changes.length,
      ops: records.length,
      tests: tests.length,
      workItems: workItems.length,
      untested: gaps.untested.length,
      provesWithoutWalking: gaps.provesWithoutWalking.length,
      connectionsWithoutContract: gaps.connectionsWithoutContract.length,
      orphans: orphans().length,
      orphanIds: orphans(),
      openQuestions: (plan.questions ?? []).filter((q) => register.questionState(q) === 'open')
        .length,
      overdueQuestions: delivery.questions.filter((q) => delivery.overdue(q.id)).length,
      errors: v.errors.length,
      warnings: v.warnings.length,
      ok: v.errors.length === 0,
    };
  });

  return { orphans, health };
}
