import type { Model } from '@/application/plan/derive';
import type { GraphDiff } from '@/application/plan/federation-diff';
import { invalidators } from '@/application/plan/federation-policy';
import { parentOf } from '@/application/plan/ids';
import { type GraphMode, graphIn } from '@/application/plan-viz-graph-base';
import { keyText, secs } from '@/application/plan-viz-waterfall-text';
import type { SystemGraph } from '@/domain/plan/plan-graph';

// The caches on the graph's path as a table: layer, what it holds, for how long, one copy per what, and what empties
// it. With a graph diff the same rows read before and after.

export interface TtlItem {
  /** What the lifetime is for: a field or an operation; empty when it is the cache's own. */
  readonly label: string;
  readonly text: string;
  readonly override: boolean;
  readonly why: string;
}

export interface TtlLine {
  readonly item: TtlItem | null;
  /** Today's lifetime, struck, when the plan changes it or drops it. */
  readonly was: TtlItem | null;
  readonly isNew: boolean;
}

export interface BlockedLine {
  readonly operation: string;
  readonly field: string | null;
}

export interface CacheRowView {
  readonly id: string;
  readonly layer: 'edge' | 'gateway' | 'subgraph';
  readonly does: string;
  readonly status: 'new' | 'changed' | 'same';
  readonly team: string | null;
  readonly ttl: readonly TtlLine[];
  readonly key: string;
  /** Today's key when the plan changes it. */
  readonly keyWas: string | null;
  /** Events that empty it today, then the ones the plan adds. */
  readonly events: readonly string[];
  readonly eventsAdded: readonly string[];
  /** The steps that purge it, when no event leads to one. */
  readonly steps: readonly string[];
  /** The flow whose step purges it. */
  readonly purgeFlow: string | null;
  readonly purge: string;
  readonly blocked: readonly BlockedLine[];
}

const LADDER = { edge: 0, gateway: 1, subgraph: 2 } as const;

interface Facts {
  readonly id: string;
  readonly layer: CacheRowView['layer'];
  readonly does: string;
  readonly ttl: readonly TtlItem[];
  readonly key: string;
  readonly events: readonly string[];
  readonly steps: readonly string[];
  readonly purge: string;
  readonly blocked: readonly BlockedLine[];
}

function subgraphTtl(g: SystemGraph, store: string): TtlItem[] {
  const seen = new Set<string>();
  const items: TtlItem[] = [];
  for (const schema of g.schemas.filter((s) => s.kind === 'graph-type')) {
    for (const field of schema.fields) {
      const use = (field.cache ?? []).find((c) => c.at === store);
      if (use === undefined || seen.has(field.name)) continue;
      seen.add(field.name);
      const text = use.ttl === undefined ? '' : secs(use.ttl);
      items.push({ label: field.name, text, override: false, why: '' });
    }
  }
  return items;
}

function pathTtl(model: Model, store: string, mode: GraphMode): TtlItem[] {
  const items: TtlItem[] = [];
  for (const op of graphIn(model, mode).operations) {
    const row = model.cachePath(op.id, mode, 'cold').layers.find((l) => l.store === store);
    if (row?.why !== null || row.ttl === null) continue;
    items.push({
      label: model.label(op.id),
      text: secs(row.ttl),
      override: row.ttlSource === 'override',
      why: (row.reason ?? '').replaceAll('`', ''),
    });
  }
  return items;
}

function blockedBy(model: Model, store: string, mode: GraphMode): BlockedLine[] {
  const g = graphIn(model, mode);
  const node = g.get(store);
  if (node?.$type !== 'store' || node.layer !== 'edge') return [];
  return g.operations.flatMap((op) => {
    if (op.kind === 'mutation') return [];
    const policy = model.responsePolicy(op.id, mode);
    if (policy.scope !== 'private') return [];
    return [{ operation: op.id, field: policy.private[0]?.field ?? null }];
  });
}

const PER_ITEM: TtlItem = {
  label: '',
  text: 'per item: each lookup keeps its own lifetime',
  override: false,
  why: '',
};

function ttlOf(model: Model, store: string, mode: GraphMode): TtlItem[] {
  const g = graphIn(model, mode);
  const node = g.get(store);
  if (node?.$type !== 'store') return [];
  if (node.layer === 'subgraph') return subgraphTtl(g, store);
  if (node.granularity === 'entity') return [PER_ITEM];
  return pathTtl(model, store, mode);
}

function factsOf(model: Model, store: string, mode: GraphMode): Facts | null {
  const g = graphIn(model, mode);
  const node = g.get(store);
  if (node?.$type !== 'store' || node.layer === undefined) return null;
  const ttl = ttlOf(model, store, mode);
  const inv = invalidators(g, store);
  return {
    id: store,
    layer: node.layer,
    does: node.does ?? '',
    ttl,
    key: keyText(node.keyed_by),
    events: inv.messages.toSorted((a, b) => a.localeCompare(b)),
    steps: inv.steps,
    purge: node.purge ?? '',
    blocked: blockedBy(model, store, mode),
  };
}

function ttlLines(now: readonly TtlItem[], was: readonly TtlItem[] | null): TtlLine[] {
  if (was === null) return now.map((item) => ({ item, was: null, isNew: false }));
  const lines = now.map((item): TtlLine => {
    const before = was.find((w) => w.label === item.label);
    if (before === undefined) return { item, was: null, isNew: true };
    const same = before.text === item.text && before.override === item.override;
    return { item, was: same ? null : before, isNew: false };
  });
  const dropped = was.filter((w) => !now.some((x) => x.label === w.label));
  return [...lines, ...dropped.map((w): TtlLine => ({ item: null, was: w, isNew: false }))];
}

function statusOf(scope: {
  readonly was: Facts | null;
  readonly changed: boolean;
  readonly diff: boolean;
}) {
  if (scope.diff && scope.was === null) return 'new';
  return scope.changed ? 'changed' : 'same';
}

function rowOf(
  model: Model,
  now: Facts,
  scope: { readonly was: Facts | null; readonly changed: boolean; readonly diff: boolean },
): CacheRowView {
  const { was } = scope;
  const added = was === null ? [] : now.events.filter((e) => !was.events.includes(e));
  const flow = now.steps[0];
  return {
    id: now.id,
    layer: now.layer,
    does: now.does,
    status: statusOf(scope),
    team: model.ownerTeam(now.id),
    ttl: ttlLines(now.ttl, was?.ttl ?? null),
    key: now.key,
    keyWas: was !== null && was.key !== now.key ? was.key : null,
    events: added.length > 0 && was !== null ? was.events : now.events,
    eventsAdded: added,
    steps: now.steps,
    purgeFlow: flow === undefined ? null : (parentOf(flow) ?? null),
    purge: now.purge,
    blocked: now.blocked,
  };
}

/** The caches of a graph, outermost first; empty when it has none. `diff` is `model.graphDiff(graphId)`. */
export function cacheTable(
  model: Model,
  options: { readonly mode?: GraphMode; readonly diff?: GraphDiff | null } = {},
): CacheRowView[] {
  const diff = options.diff ?? null;
  const mode: GraphMode = diff === null ? (options.mode ?? 'asIs') : 'toBe';
  const stores = [...graphIn(model, mode).stores, ...(diff === null ? [] : model.asIs.stores)];
  const ids = [
    ...new Set(stores.filter((s) => s.kind === 'cache' && s.layer !== undefined).map((s) => s.id)),
  ];
  const rows: CacheRowView[] = [];
  for (const id of ids) {
    const now = factsOf(model, id, mode);
    if (now === null) continue;
    const was = diff === null ? null : factsOf(model, id, 'asIs');
    const changed = diff?.caches.some((c) => c.id === id) ?? false;
    rows.push(rowOf(model, now, { was, changed, diff: diff !== null }));
  }
  return rows.toSorted((a, b) => LADDER[a.layer] - LADDER[b.layer]);
}
