import { applyOps } from '@/application/plan/apply-ops';
import { buildGraph, systemOf } from '@/application/plan/graph';
import { baseFanout } from '@/application/plan/graph-queries';
import { formatPath, planEntries } from '@/application/plan/ids';
import type {
  AppliedOps,
  Fanout,
  OpKind,
  OpRecord,
  PlanEntry,
  SystemGraph,
} from '@/domain/plan/plan-graph';
import type { PathSegment } from '@/domain/plan/plan-ids';
import type { Plan } from '@/domain/plan/plan.generated';

export interface Issue {
  readonly path: string;
  readonly message: string;
}

/** Everything the cross-reference checks share: the plan, both graphs and what the ledger did. */
export interface CheckContext {
  readonly plan: Plan;
  readonly asIs: SystemGraph;
  readonly toBe: SystemGraph;
  readonly applied: AppliedOps;
  readonly planEntities: ReadonlyMap<string, PlanEntry>;
  readonly planDupes: readonly {
    readonly id: string;
    readonly path: readonly PathSegment[];
    readonly first: readonly PathSegment[];
  }[];
  readonly addedBy: ReadonlyMap<string, OpRecord>;
  readonly removedBy: ReadonlyMap<string, OpRecord>;
  readonly deprecatedBy: ReadonlyMap<string, OpRecord>;
  readonly modsById: ReadonlyMap<string, readonly OpRecord[]>;
  readonly fanout: Fanout;
  readonly known: (id: string) => boolean;
}

/** Where checks report: errors, warnings, and `strict` (an error, or a warning while the plan is a draft). */
export interface Report {
  readonly errors: readonly Issue[];
  readonly warnings: readonly Issue[];
  readonly error: (segs: readonly PathSegment[], message: string) => void;
  readonly warn: (segs: readonly PathSegment[], message: string) => void;
  readonly strict: (segs: readonly PathSegment[], message: string) => void;
}

export function createReport(draft: boolean): Report {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const error: Report['error'] = (segs, message) => {
    errors.push({ path: formatPath(segs), message });
  };
  const warn: Report['warn'] = (segs, message) => {
    warnings.push({ path: formatPath(segs), message });
  };
  const warnDraft: Report['strict'] = (segs, message) => {
    warn(segs, `draft: ${message}`);
  };
  return { errors, warnings, error, warn, strict: draft ? warnDraft : error };
}

type Ledger = Pick<CheckContext, 'addedBy' | 'removedBy' | 'deprecatedBy' | 'modsById'>;

function indexLedger(records: readonly OpRecord[]): Ledger {
  const addedBy = new Map<string, OpRecord>();
  const removedBy = new Map<string, OpRecord>();
  const deprecatedBy = new Map<string, OpRecord>();
  const modsById = new Map<string, readonly OpRecord[]>();
  const indexers: Record<OpKind, (r: OpRecord, ok: boolean) => void> = {
    add(r) {
      for (const id of r.ids) if (!addedBy.has(id)) addedBy.set(id, r);
    },
    remove(r, ok) {
      if (ok) for (const id of r.ids) removedBy.set(id, r);
    },
    deprecate(r, ok) {
      if (ok && r.target !== null) deprecatedBy.set(r.target, r);
    },
    modify(r) {
      if (r.target !== null) modsById.set(r.target, [...(modsById.get(r.target) ?? []), r]);
    },
  };
  for (const r of records) {
    if (r.kind !== null) indexers[r.kind](r, r.problems.length === 0);
  }
  return { addedBy, removedBy, deprecatedBy, modsById };
}

function indexPlanEntities(plan: Plan) {
  const planEntities = new Map<string, PlanEntry>();
  const planDupes: CheckContext['planDupes'][number][] = [];
  for (const p of planEntries(plan)) {
    const first = planEntities.get(p.id);
    if (first === undefined) planEntities.set(p.id, p);
    else planDupes.push({ id: p.id, path: p.path, first: first.path });
  }
  return { planEntities, planDupes };
}

export function createContext(plan: Plan, fanout: Fanout = baseFanout): CheckContext {
  const asIs = buildGraph(systemOf(plan));
  const applied = applyOps(plan, plan.changes ?? []);
  const toBe = buildGraph(applied.system, applied.origins);
  const ledger = indexLedger(applied.records);
  const { planEntities, planDupes } = indexPlanEntities(plan);
  const known = (id: string): boolean =>
    asIs.has(id) || ledger.addedBy.has(id) || planEntities.has(id) || toBe.has(id);
  return { plan, asIs, toBe, applied, planEntities, planDupes, ...ledger, fanout, known };
}

/** A prop of an entity, and (when it is not just the prop's own key) where inside it to point. */
export type PropRef = string | { readonly prop: string; readonly rel: readonly PathSegment[] };

const propName = (ref: PropRef): string => (typeof ref === 'string' ? ref : ref.prop);
const propRel = (ref: PropRef): readonly PathSegment[] =>
  typeof ref === 'string' ? [ref] : ref.rel;

/**
 * Path to blame for a to-be entity prop: the last op that changed that prop, else the entity's
 * as-is position, else where it was added.
 */
export function blame(ctx: CheckContext, id: string, ref: PropRef): PathSegment[] {
  const prop = propName(ref);
  const mods = ctx.modsById.get(id) ?? [];
  for (const rec of mods.toReversed()) {
    const p = rec.props.find((x) => x.prop === prop);
    if (p !== undefined) return [...rec.path, p.change, prop];
  }
  const node = ctx.asIs.get(id) ?? ctx.toBe.get(id);
  return node === undefined ? [] : [...node.$path, ...propRel(ref)];
}

export const opRef = (rec: OpRecord): string => formatPath(rec.path);

/** Does record a come before record b in the ledger? */
export const ledgerBefore = (a: OpRecord, b: OpRecord): boolean =>
  a.changeIndex < b.changeIndex || (a.changeIndex === b.changeIndex && a.opIndex < b.opIndex);

/** Was the entity added or modified by the ledger (so its to-be node differs from as-is)? */
export const touched = (ctx: CheckContext, id: string): boolean =>
  ctx.addedBy.has(id) || ctx.modsById.has(id);

/** The path to report for a node: its own source path in the as-is, else the op that touched it. */
export function whereAt(
  at: { readonly ctx: CheckContext; readonly g: SystemGraph },
  node: { readonly id: string; readonly $path: readonly PathSegment[] },
  ref: PropRef,
): PathSegment[] {
  return at.g === at.ctx.asIs && !touched(at.ctx, node.id)
    ? [...node.$path, ...propRel(ref)]
    : blame(at.ctx, node.id, ref);
}

/** The as-is nodes of a kind, and the to-be nodes of that kind the ledger touched. */
export function scoped<N extends { readonly id: string }>(
  ctx: CheckContext,
  select: (g: SystemGraph) => readonly N[],
): { readonly g: SystemGraph; readonly list: readonly N[] }[] {
  return [
    { g: ctx.asIs, list: select(ctx.asIs) },
    { g: ctx.toBe, list: select(ctx.toBe).filter((x) => touched(ctx, x.id)) },
  ];
}
