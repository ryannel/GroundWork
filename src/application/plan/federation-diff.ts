import type { Core } from '@/application/plan/derive-core';
import type { DiffEntry } from '@/application/plan/derive-diff';
import { memo, str } from '@/application/plan/derive-values';
import type { Federation, PlanSummary } from '@/application/plan/federation-model';
import { isRecord, prop } from '@/application/plan/ids';
import type { Field } from '@/domain/plan/plan.generated';

type Status = ReturnType<Core['status']>;
type SummaryKey = keyof PlanSummary;

interface Entry {
  id: string;
  status: Status;
}

export interface FieldChange {
  id: string;
  type: string;
  status: Status;
  subgraphs: { before: string[]; after: string[] };
  moved: boolean;
  override: Field['override'] | null;
  usage: Field['usage'] | null;
  summaries: string[];
}

export interface OperationChange {
  id: string;
  status: Status;
  before: PlanSummary | null;
  after: PlanSummary | null;
  changed: SummaryKey[];
}

export interface CacheChange extends Entry {
  summaries: string[];
}

/** What a plan changes in one graph: subgraphs, types, fields, operations (by plan) and caches on its path. */
export interface GraphDiff {
  graph: string;
  subgraphs: Entry[];
  types: Entry[];
  fields: FieldChange[];
  operations: OperationChange[];
  caches: CacheChange[];
}

interface Parts {
  fed: Federation;
  diff: (id: string) => DiffEntry[];
  descendants: (id: string) => string[];
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
  core: Core;
  parts: Parts;
  graphId: string;
  changed: (id: string) => boolean;
}

const summariesOf = ({ parts }: Scope, id: string): string[] =>
  parts
    .diff(id)
    .filter((e) => e.target === id)
    .map((e) => e.summary);

function fieldsOf(env: Scope, typeIds: string[]): FieldChange[] {
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

function operationsIn(env: Scope, opIds: string[]): OperationChange[] {
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
function cachesIn(env: Scope, attachers: string[]): CacheChange[] {
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
      return (
        n?.$type === 'store' &&
        n.kind === 'cache' &&
        changed(id) &&
        (str(n.owner) === gateway || attached(id))
      );
    })
    .map((id) => ({ id, status: core.status(id), summaries: summariesOf(env, id) }));
}

export function createGraphDiff(core: Core, parts: Parts) {
  return memo((graphId: string): GraphDiff => {
    const env: Scope = {
      core,
      parts,
      graphId,
      changed: (id) => core.status(id) !== 'existing',
    };
    const inGraph = (id: string): boolean => (str(prop(core.sys(id), 'graph')) ?? null) === graphId;
    const ofType = (type: string): string[] =>
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
