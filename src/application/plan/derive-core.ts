import { applyOps } from '@/application/plan/apply-ops';
import { str, uniq } from '@/application/plan/derive-values';
import { buildGraph, systemOf } from '@/application/plan/graph';
import { baseFanout } from '@/application/plan/graph-queries';
import { labelOf, planEntries, prop } from '@/application/plan/ids';
import type {
  Fanout,
  OpKind,
  OpRecord,
  PlanEntity,
  PlanNode,
  SystemGraph,
} from '@/domain/plan/plan-graph';
import type { EntityType, PathSegment } from '@/domain/plan/plan-ids';
import type {
  Change,
  Milestone,
  Plan,
  Question,
  Test,
  WorkItem,
} from '@/domain/plan/plan.generated';

/** A plan-level entity (outside the system graphs) with the `$`-props the model gives it. */
export type Indexed = PlanEntity & {
  $type: EntityType;
  $path: PathSegment[];
  /** The status the author wrote, when the model overrode it (a question answered by a decision). */
  $authoredStatus?: string;
};
export type Anything = PlanNode | Indexed;

export type ElementStatus = 'existing' | 'added' | 'modified' | 'deprecated' | 'removed';
type Changed = Exclude<ElementStatus, 'existing'>;

/** Which system a view reads: the to-be graph also serves the diff. */
export type GraphMode = 'asIs' | 'toBe';
export type Mode = GraphMode | 'diff';

export function modeOf(mode: string | undefined): Mode {
  if (mode === 'asIs' || mode === 'as-is' || mode === 'before' || mode === 'today') return 'asIs';
  return mode === 'diff' ? 'diff' : 'toBe';
}

const STATUS_RANK: Record<Exclude<Changed, 'added'>, number> = {
  modified: 1,
  deprecated: 2,
  removed: 3,
};

/** What the model reads from: both graphs, the op ledger and the plan-level entities. */
export interface Core {
  plan: Plan;
  asIs: SystemGraph;
  toBe: SystemGraph;
  records: OpRecord[];
  changes: Change[];
  tests: Test[];
  workItems: WorkItem[];
  milestones: Milestone[];
  planIndex: Map<string, Indexed>;
  /** System ids: as-is order first, then additions. */
  unionIds: string[];
  fanout: Fanout;
  graphOf: (mode: string | undefined) => SystemGraph;
  /** Any entity by id: to-be node, else as-is node (removed), else plan-level entity. */
  get: (id: string | null | undefined) => Anything | undefined;
  /** System node from the union of both graphs (to-be preferred). */
  sys: (id: string | null | undefined) => PlanNode | undefined;
  label: (id: string) => string;
  status: (id: string | null | undefined) => ElementStatus | null;
}

const isQuestion = (e: Indexed): e is Indexed & Question => e.$type === 'question';

/** What an answered question reads as, by its decision; undefined when it keeps what the author wrote. */
function answeredStatus(
  e: Question,
  index: ReadonlyMap<string, Indexed>,
): 'resolved' | 'open' | undefined {
  if (e.answered_by === undefined) return undefined;
  const by = prop(index.get(e.answered_by), 'status');
  if (by === undefined || by === 'rejected' || by === 'superseded') return undefined;
  return by === 'accepted' ? 'resolved' : 'open';
}

/** Plan entities by id. A question answered by a decision that is not yet accepted is still open. */
function indexPlan(plan: Plan): Map<string, Indexed> {
  const index = new Map<string, Indexed>();
  for (const p of planEntries(plan)) {
    if (!index.has(p.id)) index.set(p.id, { ...p.entity, $type: p.type, $path: p.path });
  }
  for (const e of index.values()) {
    const next = isQuestion(e) ? answeredStatus(e, index) : undefined;
    if (isQuestion(e) && next !== undefined && next !== e.status) {
      e.$authoredStatus = e.status;
      e.status = next;
    }
  }
  return index;
}

const KIND_STATUS: Record<Exclude<OpKind, 'add'>, Exclude<Changed, 'added'>> = {
  modify: 'modified',
  deprecate: 'deprecated',
  remove: 'removed',
};

/** The status an op gives an id that already has `cur`, or undefined when it stays as it is. */
function nextStatus(kind: OpKind, cur: Changed | undefined): Changed | undefined {
  if (kind === 'add') return cur === undefined ? 'added' : undefined;
  const next = KIND_STATUS[kind];
  if (cur === 'added') return next === 'removed' ? 'removed' : undefined;
  return cur === undefined || STATUS_RANK[next] > STATUS_RANK[cur] ? next : undefined;
}

function statusLedger(records: readonly OpRecord[]): Map<string, Changed> {
  const map = new Map<string, Changed>();
  for (const r of records) {
    if (r.kind === null) continue;
    for (const id of r.ids) {
      const next = nextStatus(r.kind, map.get(id));
      if (next !== undefined) map.set(id, next);
    }
  }
  return map;
}

/** An interface without a name reads as "Promise REST v1", never as its raw id. */
function interfaceLabel(get: Core['get'], n: Anything | undefined): string | undefined {
  const svc = str(prop(get(String(prop(n, 'service'))), 'name'));
  if (svc === undefined) return undefined;
  const proto = str(prop(n, 'protocol'));
  const ver = str(prop(n, 'version'));
  const base = `${svc} ${proto === undefined ? 'interface' : proto.toUpperCase()}`;
  return ver === undefined ? base : `${base} ${ver}`;
}

function labelling(get: Core['get']): Core['label'] {
  return (id) => {
    const n = get(id);
    const type = prop(n, '$type');
    const name = prop(n, 'name');
    const version = str(prop(n, 'version'));
    if (type === 'message' && version !== undefined && version !== '') {
      return `${String(name)} ${version}`;
    }
    if (type === 'interface' && (name === undefined || name === null || name === '')) {
      const label = interfaceLabel(get, n);
      if (label !== undefined) return label;
    }
    return labelOf(n, id);
  };
}

export function createCore(plan: Plan, fanout: Fanout = baseFanout): Core {
  const asIs = buildGraph(systemOf(plan));
  const applied = applyOps(plan, plan.changes);
  const toBe = buildGraph(applied.system, applied.origins);
  const records = applied.records.filter((r) => r.kind !== null && r.ids.length > 0);
  const planIndex = indexPlan(plan);
  const ledger = statusLedger(records);
  const get: Core['get'] = (id) =>
    id === null || id === undefined
      ? undefined
      : (toBe.get(id) ?? asIs.get(id) ?? planIndex.get(id));
  const sys: Core['sys'] = (id) =>
    id === null || id === undefined ? undefined : (toBe.get(id) ?? asIs.get(id));
  return {
    plan,
    asIs,
    toBe,
    records,
    changes: plan.changes ?? [],
    tests: plan.tests ?? [],
    workItems: plan.work_items ?? [],
    milestones: plan.milestones ?? [],
    planIndex,
    unionIds: uniq([...asIs.byId.keys(), ...toBe.byId.keys()]),
    fanout,
    graphOf: (mode) => (modeOf(mode) === 'asIs' ? asIs : toBe),
    get,
    sys,
    label: labelling(get),
    status: (id) => ledger.get(id ?? '') ?? (get(id) === undefined ? null : 'existing'),
  };
}
