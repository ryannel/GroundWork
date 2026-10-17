import type { Model } from '@/application/plan/derive';
import type { CachePath, CacheRow } from '@/application/plan/federation-cache';
import type { Added, Fetch, QueryPlan } from '@/application/plan/federation-plan-types';
import type { ResponsePolicy } from '@/application/plan/federation-policy';
import { prop, strings } from '@/application/plan/ids';

// What the waterfall reads from the model: the query plan, the cache path of each case, and the facts a headline needs.

export type WaterfallMode = 'asIs' | 'toBe';
export type WaterfallCase = 'hit' | 'miss' | 'cold';

export const modeKey = (mode?: string): WaterfallMode => (mode === 'asIs' ? 'asIs' : 'toBe');

/** The operation's query plan, or null when this side of the plan has no such operation. */
export function opPlan(model: Model, id: string, mode?: string): QueryPlan | null {
  const m = modeKey(mode);
  return model[m].get(id)?.$type === 'operation' ? model.queryPlan(id, m) : null;
}

/** One operation on one side of the plan. */
export interface OpAt {
  readonly id: string;
  readonly mode?: string | undefined;
}

export function opPath(model: Model, at: OpAt, kase: WaterfallCase): CachePath | null {
  const m = modeKey(at.mode);
  return model[m].get(at.id)?.$type === 'operation' ? model.cachePath(at.id, m, kase) : null;
}

export interface WaterfallFacts {
  readonly plan: QueryPlan | null;
  readonly policy: ResponsePolicy | null;
  readonly roundTrips: number;
  readonly fetches: number;
  readonly teams: number;
  /** A cache layer on its path has numbers; they belong to the layer, shared by every operation behind it. */
  readonly layerObserved: boolean;
  readonly layerHit: number | null;
  readonly layerCold: number | null;
  /** The layer that answers a hit, by id. */
  readonly hitLayer: string | null;
  /** Which layer that is: "edge", "gateway" or "cache". */
  readonly hitLayerName: string;
  /** The subgraph whose fetch takes longest, when the plan has measurements. */
  readonly slowest: {
    readonly subgraph: string;
    readonly ms: number;
    readonly via: boolean;
  } | null;
  readonly cacheLayers: number;
  readonly mutation: boolean;
}

function slowestOf(plan: QueryPlan | null, cold: CachePath | null): WaterfallFacts['slowest'] {
  let slowest: WaterfallFacts['slowest'] = null;
  for (const row of cold?.layers ?? []) {
    const fetch = plan?.fetches.find((x) => x.id === row.fetch);
    const ms = row.latency;
    if (row.layer !== 'subgraph' || fetch === undefined || ms === null) continue;
    if (slowest === null || ms > slowest.ms) {
      slowest = { subgraph: fetch.subgraph, ms, via: fetch.vias.length > 0 };
    }
  }
  return slowest;
}

type LayerFacts = Pick<
  WaterfallFacts,
  'layerObserved' | 'layerHit' | 'layerCold' | 'hitLayer' | 'hitLayerName' | 'cacheLayers'
>;

const outside = (path: CachePath | null): CacheRow[] =>
  (path?.layers ?? []).filter((l) => l.layer !== 'subgraph');

function layerFacts(hit: CachePath | null, cold: CachePath | null): LayerFacts {
  const outer = outside(hit).find((l) => l.state === 'hit');
  const layerHit = outer?.latency ?? null;
  const layerCold = outside(cold).find((l) => l.latency !== null)?.latency ?? null;
  return {
    layerObserved: layerHit !== null || layerCold !== null,
    layerHit,
    layerCold,
    hitLayer: outer?.store ?? null,
    hitLayerName: outer?.layer ?? 'cache',
    cacheLayers: outside(cold).length,
  };
}

/** The numbers a headline needs for one operation. */
export function waterfallFacts(model: Model, id: string, mode?: string): WaterfallFacts {
  const m = modeKey(mode);
  const plan = opPlan(model, id, m);
  const cold = opPath(model, { id, mode: m }, 'cold');
  return {
    ...layerFacts(opPath(model, { id, mode: m }, 'hit'), cold),
    plan,
    policy: plan === null ? null : model.responsePolicy(id, m),
    roundTrips: plan?.roundTrips ?? 0,
    fetches: plan?.fetches.length ?? 0,
    teams: plan?.teams.length ?? 0,
    slowest: slowestOf(plan, cold),
    mutation: plan?.kind === 'mutation',
  };
}

export interface RouterWhy {
  /** The tag beside the field: "for deliveryPromise" or "key". */
  readonly label: string;
  /** The sentence on hover. */
  readonly tip: string;
}

function askedFor(model: Model, plan: QueryPlan, added: Added): string | null {
  if (added.reason !== 'requires') return null;
  const asks = plan.selected
    .filter((x) => x.addedByRouter === null)
    .map((x) => model.get(x.field))
    .filter((e) => strings(prop(e, 'requires')).length > 0);
  const hit = asks.find((e) => strings(prop(e, 'requires')).includes(added.field)) ?? asks[0];
  const name = prop(hit, 'name');
  return typeof name === 'string' && name !== '' ? name : null;
}

/** Why the gateway added a selected path itself: for a field's @requires, or a key to find the next fetch. */
export function routerWhy(model: Model, plan: QueryPlan, path: string): RouterWhy | null {
  const added = plan.addedByRouter.find((x) => x.path === path);
  if (added === undefined) return null;
  const asker = askedFor(model, plan, added);
  return asker === null
    ? { label: 'key', tip: 'Added by the gateway to find the next fetch' }
    : { label: `for ${asker}`, tip: `Added by the gateway for ${asker}` };
}

/** The key a band's entity fetches are looked up by ("sku"). */
export function keyOf(model: Model, fetch: Fetch, mode?: string): string {
  const { keys } = model.fieldOwners(fetch.type, modeKey(mode));
  const key = keys.find((k) => k.in.includes(fetch.subgraph)) ?? keys[0];
  return key === undefined ? '' : key.fields.join(' + ');
}

export interface FetchField {
  readonly name: string;
  /** The field's id in the plan, when the path maps to one. */
  readonly field: string | null;
  readonly path: string;
}

/** The direct fields a fetch returns; container fields shown through their children are dropped. */
export function fieldsOfFetch(plan: QueryPlan, fetch: Fetch): FetchField[] {
  const byPath = new Map(plan.selected.map((s) => [s.path, s.field]));
  const base = fetch.path === '' ? 0 : fetch.path.split('.').length;
  const head = fetch.kind === 'root' ? 1 : base;
  const seen = new Map<string, FetchField>();
  for (const path of fetch.paths) {
    const segs = path.split('.');
    const name = segs[head];
    if (name === undefined || seen.has(name)) continue;
    const full = [...segs.slice(0, head), name].join('.');
    seen.set(name, { name, field: byPath.get(full) ?? null, path: full });
  }
  const first = fetch.paths[0];
  if (seen.size === 0 && first !== undefined) {
    const name = first.split('.').at(-1) ?? first;
    seen.set(name, { name, field: byPath.get(first) ?? null, path: first });
  }
  return [...seen.values()];
}
