import type { Model } from '@/application/plan/derive';
import type { Blast } from '@/application/plan/federation-blast';
import type { CacheRow } from '@/application/plan/federation-cache';
import type { Fetch, QueryPlan } from '@/application/plan/federation-plan-types';
import { prop } from '@/application/plan/ids';
import { chipInfo } from '@/application/plan-chips';
import type { FetchChange } from '@/application/plan-viz-waterfall-compare';
import { fieldsOfFetch, routerWhy } from '@/application/plan-viz-waterfall-facts';
import { humanBlast, ms, plural } from '@/application/plan-viz-waterfall-text';
import type {
  FetchBarView,
  FetchReadView,
  FetchRowView,
  Mark,
} from '@/application/plan-viz-waterfall-view';

/** The p50 a subgraph authors for one fetch to it, in ms. */
export function fetchMs(model: Model, f: Fetch): number | null {
  const n = prop(prop(model.get(f.subgraph), 'observed'), 'latency_ms');
  return typeof n === 'number' ? n : null;
}

export interface FetchContext {
  readonly plan: QueryPlan;
  readonly fstate: ReadonlyMap<string, 'run' | 'skipped'>;
  readonly dataRows: readonly CacheRow[];
  readonly entityRows: readonly CacheRow[];
  readonly blast: readonly Blast[];
  /** Null for every fetch unless all of them are measured. */
  readonly msOf: (f: Fetch) => number | null;
  readonly maxMs: number | null;
  readonly change: FetchChange | null;
  readonly lens: string | null;
  readonly compact: boolean;
  readonly cols: number;
}

const label = (model: Model, id: string): string => chipInfo(model, id).label;

function readsOf(f: Fetch, ctx: FetchContext): FetchReadView[] {
  const cacheIds = [...new Set(f.caches.map((c) => c.at))];
  const rows = ctx.dataRows.filter((x) => x.fetch === f.id);
  const viaSkipped = rows.some((x) => x.state === 'hit');
  const caches = cacheIds.map((store): FetchReadView => {
    const row = rows.find((x) => x.store === store);
    let mark: Mark | null = null;
    if (row?.state === 'hit') {
      const took = row.latency === null ? '' : ` ${ms(row.latency)}`;
      mark = { kind: 'hit', glyph: null, text: `hit${took}` };
    } else if (row?.state === 'miss') mark = { kind: 'miss', glyph: null, text: 'miss' };
    return { store, kind: 'cache', skipped: false, mark };
  });
  const vias = f.vias.map((v): FetchReadView => ({
    store: v.via,
    kind: 'via',
    skipped: viaSkipped,
    mark: null,
  }));
  const stores = [...new Set(f.reads.map((r) => r.store))].filter(
    (s): s is string => s !== null && !cacheIds.includes(s),
  );
  const plain = stores.map((store): FetchReadView => ({
    store,
    kind: 'store',
    skipped: viaSkipped,
    mark: null,
  }));
  return [...caches, ...vias, ...plain];
}

function batchOf(model: Model, f: Fetch): FetchRowView['batch'] {
  if (!f.list) return null;
  const name = label(model, f.type).replaceAll('`', '').toLowerCase();
  const item = name === '' ? 'items' : plural(name);
  if (f.batched) {
    return {
      text: `all the ${item} in 1 call`,
      title: `One call carries all the ${item}`,
      warn: false,
    };
  }
  if (f.nPlusOne) {
    return {
      text: `n queries inside ${label(model, f.subgraph)}`,
      title: `No batching: one query for each of the ${item}`,
      warn: true,
    };
  }
  return null;
}

function gateCacheOf(f: Fetch, ctx: FetchContext): Mark | null {
  const per = ctx.entityRows.flatMap((e) => e.perFetch ?? []).find((x) => x.fetch === f.id);
  if (per?.cacheable !== true) return null;
  if (per.state === 'hit') return { kind: 'hit', glyph: null, text: 'gateway cache hit' };
  if (per.state === 'miss') return { kind: 'miss', glyph: null, text: 'gateway cache miss' };
  return { kind: 'skip', glyph: null, text: 'not reached' };
}

function barOf(f: Fetch, state: 'run' | 'skipped', ctx: FetchContext): FetchBarView {
  const ownMs = ctx.msOf(f);
  const via = f.vias[0];
  const answered = ctx.dataRows.some((x) => x.fetch === f.id && x.state === 'hit');
  const share =
    ownMs !== null && ctx.maxMs !== null && ctx.maxMs > 0
      ? Math.max(8, Math.round((ownMs / ctx.maxMs) * 100))
      : null;
  return {
    depth: f.depth,
    cols: ctx.cols,
    share,
    ms: state === 'skipped' ? null : ownMs,
    calls: via?.to ?? null,
    callsSkipped: state === 'skipped' || answered,
    skipped: state === 'skipped',
  };
}

function lensOf(f: Fetch, lens: string | null): FetchRowView['lens'] {
  if (lens === null || f.team === null) return null;
  return f.team === lens ? 'mine' : 'faded';
}

/** One fetch: who runs it, what it returns, what it reads, what fails with it, and its bar. */
export function fetchRowView(model: Model, f: Fetch, ctx: FetchContext): FetchRowView {
  const { plan } = ctx;
  const state = ctx.fstate.get(f.id) ?? 'run';
  const blast = ctx.compact ? undefined : ctx.blast.find((x) => x.fetch === f.id);
  return {
    kind: 'fetch',
    key: `fetch:${f.id}${ctx.change?.kind === 'gone' ? ':gone' : ''}`,
    id: f.id,
    subgraph: f.subgraph,
    team: f.team,
    state,
    lens: lensOf(f, ctx.lens),
    change: ctx.change,
    fields: fieldsOfFetch(plan, f).map((x) => ({
      name: x.name,
      field: x.field,
      router: routerWhy(model, plan, x.path),
    })),
    batch: batchOf(model, f),
    gateCache: gateCacheOf(f, ctx),
    reads: readsOf(f, ctx),
    blast: blast === undefined ? null : humanBlast(blast.message),
    bar: barOf(f, state, ctx),
  };
}
