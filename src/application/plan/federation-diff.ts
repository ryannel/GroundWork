import type { Core } from '@/application/plan/derive-core';
import type { DiffEntry } from '@/application/plan/derive-diff';
import { memo, textOf } from '@/application/plan/derive-values';
import type { Federation, PlanSummary } from '@/application/plan/federation-model';
import { isRecord, prop } from '@/application/plan/ids';
import type { Field } from '@/domain/plan/plan.generated';

type Status = ReturnType<Core['status']>;
type SummaryKey = keyof PlanSummary;

interface Entry {
  readonly id: string;
  readonly status: Status;
}

export interface FieldChange {
  readonly id: string;
  readonly type: string;
  readonly status: Status;
  readonly subgraphs: { readonly before: readonly string[]; readonly after: readonly string[] };
  readonly moved: boolean;
  readonly override: Field['override'] | null;
  readonly usage: Field['usage'] | null;
  readonly summaries: readonly string[];
}

export interface OperationChange {
  readonly id: string;
  readonly status: Status;
  readonly before: PlanSummary | null;
  readonly after: PlanSummary | null;
  readonly changed: readonly SummaryKey[];
}

export interface CacheChange extends Entry {
  readonly summaries: readonly string[];
}

/** What a plan changes in one graph: subgraphs, types, fields, operations (by plan) and caches on its path. */
export interface GraphDiff {
  readonly graph: string;
  readonly subgraphs: readonly Entry[];
  readonly types: readonly Entry[];
  readonly fields: readonly FieldChange[];
  readonly operations: readonly OperationChange[];
  readonly caches: readonly CacheChange[];
}

interface Parts {
  readonly fed: Federation;
  readonly diff: (id: string) => DiffEntry[];
  readonly descendants: (id: string) => string[];
}

const SUMMARY_KEYS: SummaryKey[] = [
  'fetches',
  'roundTrips',
  'subgraphs',
  'maxAge',
  'scope',
  'cacheable',
];

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

interface Scope {
  readonly core: Core;
  readonly parts: Parts;
  readonly graphId: string;
  readonly changed: (id: string) => boolean;
}

const summariesOf = ({ parts }: Scope, id: string): string[] =>
  parts
    .diff(id)
    .filter((e) => e.target === id)
    .map((e) => e.summary);

function fieldsOf(env: Scope, typeIds: readonly string[]): FieldChange[] {
  const { core, parts, changed } = env;
  const out: FieldChange[] = [];
  for (const type of typeIds) {
    for (const id of parts.descendants(type).filter(changed)) {
      const sub = (g: Core['asIs']): string[] => {
        const n = g.get(id);
        return n?.$type === 'field' ? (n.subgraphs ?? []) : [];
      };
      const [before, after] = [sub(core.asIs), sub(core.toBe)];
      const now = core.toBe.get(id);
      const node = core.sys(id);
      out.push({
        id,
        type,
        status: core.status(id),
        subgraphs: { before, after },
        moved: core.asIs.has(id) && core.toBe.has(id) && !sameJson(before, after),
        override: now?.$type === 'field' ? (now.override ?? null) : null,
        usage: node?.$type === 'field' ? (node.usage ?? null) : null,
        summaries: summariesOf(env, id),
      });
    }
  }
  return out;
}

function operationsIn(env: Scope, opIds: readonly string[]): OperationChange[] {
  const { core, parts, changed } = env;
  const out: OperationChange[] = [];
  for (const id of opIds) {
    const before = parts.fed.planSummary(id, 'asIs');
    const after = parts.fed.planSummary(id, 'toBe');
    const keys =
      before !== null && after !== null
        ? SUMMARY_KEYS.filter((k) => !sameJson(after[k], before[k]))
        : [];
    if (changed(id) || keys.length > 0) {
      out.push({ id, status: core.status(id), before, after, changed: keys });
    }
  }
  return out;
}

/** Caches on the graph's path: owned by its gateway, or attached to one of its operations or fields. */
function cachesIn(env: Scope, attachers: readonly string[]): CacheChange[] {
  const { core, graphId, changed } = env;
  const gateway = prop(core.sys(graphId), 'gateway');
  const attached = (storeId: string): boolean =>
    attachers.some((x) =>
      [core.asIs.get(x), core.toBe.get(x)].some((n) =>
        (isRecord(n) && Array.isArray(n.cache) ? n.cache : []).some(
          (c) => isRecord(c) && c.at === storeId,
        ),
      ),
    );
  return core.unionIds
    .filter((id) => {
      const n = core.sys(id);
      const isCache = n?.$type === 'store' && n.kind === 'cache';
      return isCache && changed(id) && (textOf(n.owner) === gateway || attached(id));
    })
    .map((id) => ({ id, status: core.status(id), summaries: summariesOf(env, id) }));
}

export function createGraphDiff(core: Core, parts: Parts): (graphId: string) => GraphDiff {
  return memo((graphId: string): GraphDiff => {
    const env: Scope = {
      core,
      parts,
      graphId,
      changed: (id) => core.status(id) !== 'existing',
    };
    const inGraph = (id: string): boolean =>
      (textOf(prop(core.sys(id), 'graph')) ?? null) === graphId;
    const ofType = (type: string): readonly string[] =>
      core.unionIds.filter((id) => core.sys(id)?.$type === type && inGraph(id));
    const typeIds = ofType('schema').filter((id) => prop(core.sys(id), 'kind') === 'graph-type');
    const opIds = ofType('operation');
    return {
      graph: graphId,
      subgraphs: ofType('subgraph')
        .filter(env.changed)
        .map((id) => ({ id, status: core.status(id) })),
      types: typeIds.filter(env.changed).map((id) => ({ id, status: core.status(id) })),
      fields: fieldsOf(env, typeIds),
      operations: operationsIn(env, opIds),
      caches: cachesIn(env, [...opIds, ...typeIds.flatMap((t) => parts.descendants(t))]),
    };
  });
}
