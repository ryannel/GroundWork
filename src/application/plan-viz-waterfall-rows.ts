import type { Model } from '@/application/plan/derive';
import type { CacheRow } from '@/application/plan/federation-cache';
import type { Fetch, QueryPlan } from '@/application/plan/federation-plan-types';
import type { ResponsePolicy } from '@/application/plan/federation-policy';
import type { PerFetch } from '@/application/plan/federation-tiers';
import { prop, strings } from '@/application/plan/ids';
import { keyOf, type WaterfallMode } from '@/application/plan-viz-waterfall-facts';
import { keyText, ms, secs } from '@/application/plan-viz-waterfall-text';
import type {
  BandRowView,
  CacheRowView,
  CacheWhy,
  FillRowView,
  HingeRowView,
  Mark,
} from '@/application/plan-viz-waterfall-view';
import { nameOf } from '@/application/plan-viz-waterfall-words';

const lat = (row: CacheRow): string => (row.latency === null ? '' : ` ${ms(row.latency)}`);

const NOT_REACHED = 'not reached';

/** The answer or miss mark of a cache row. */
function stateMark(row: CacheRow, partial: boolean): Mark {
  if (row.state === 'hit') {
    return { kind: 'hit', glyph: '█', text: `${partial ? 'answers some' : 'hit'}${lat(row)}` };
  }
  if (row.state === 'miss') return { kind: 'miss', glyph: '▌', text: 'miss' };
  if (row.state === 'blocked') return { kind: 'blocked', glyph: null, text: '✕ not cached' };
  return { kind: 'skip', glyph: null, text: NOT_REACHED };
}

function cacheMeta(row: CacheRow): string {
  const bits: string[] = [];
  if (row.granularity === 'entity') bits.push('cache per fetch');
  else if (row.ttl !== null) {
    const why = row.reason === null ? '' : `: ${row.reason.replaceAll('`', '')}`;
    const over = row.ttlSource === 'override' ? ` (overridden in the plan${why})` : '';
    bits.push(`cached for ${secs(row.ttl)}${over}`);
  }
  if (row.key !== null) bits.push(`one copy per ${keyText(row.key).split(' · ').join(', ')}`);
  const stale = row.stale?.while_revalidate;
  if (stale !== undefined) bits.push(`serves stale for ${secs(stale)} while it refreshes`);
  return bits.join(' · ');
}

/** A struck row says why in one sentence: the private field, or the layer's own reason. */
function whyBlocked(row: CacheRow, policy: ResponsePolicy | null): CacheWhy {
  const priv = policy?.private[0];
  const why = row.why ?? '';
  if (
    priv !== undefined &&
    policy?.scope === 'private' &&
    row.layer === 'edge' &&
    why.includes('private')
  ) {
    return { kind: 'private', field: priv.field };
  }
  const lead = why.replace(/^cannot (?:be )?cached:?\s*/iu, '');
  return { kind: 'text', text: lead === '' ? 'not cached' : `not cached: ${lead}` };
}

export interface CacheRowExtras {
  readonly policy: ResponsePolicy | null;
  readonly partial: boolean;
  readonly note?: string | null;
  readonly wasLive?: boolean;
}

const perText = (model: Model, x: PerFetch): string => {
  if (!x.cacheable) return `${nameOf(model, x.subgraph)} not cached`;
  return `${nameOf(model, x.subgraph)} ${x.state === 'skipped' ? NOT_REACHED : x.state}`;
};

export function cacheRowView(model: Model, row: CacheRow, extras: CacheRowExtras): CacheRowView {
  const blocked = row.state === 'blocked';
  const perFetch = row.granularity === 'entity' ? (row.perFetch ?? []) : [];
  return {
    kind: 'cache',
    key: `cache:${row.store}${extras.wasLive === true ? ':today' : ''}`,
    layer: row.layer === 'subgraph' ? 'data cache' : row.layer,
    state: row.state,
    store: row.store,
    why: blocked ? whyBlocked(row, extras.policy) : null,
    meta: blocked ? '' : cacheMeta(row),
    per: perFetch.map((x) => ({
      key: x.fetch,
      text: perText(model, x),
      state: x.state,
    })),
    mark: stateMark(row, extras.partial),
    note: extras.note ?? null,
    wasLive: extras.wasLive === true,
  };
}

export function hingeRowView(plan: QueryPlan, state: 'run' | 'skipped'): HingeRowView | null {
  if (plan.gateway === null) return null;
  return {
    kind: 'hinge',
    key: 'hinge',
    state,
    gateway: plan.gateway,
    team: plan.gatewayTeam,
    text: state === 'skipped' ? NOT_REACHED : 'splits the request across subgraphs',
  };
}

export interface Band {
  readonly depth: number;
  readonly fetches: readonly Fetch[];
  readonly id: string;
  readonly mode: WaterfallMode;
  readonly msOf: (f: Fetch) => number | null;
}

/** "round trip 2 · 3 in parallel · by key sku": one round trip's heading. */
export function bandRowView(model: Model, plan: QueryPlan, band: Band): BandRowView {
  const { depth, fetches: list } = band;
  const keys = [
    ...new Set(
      list
        .filter((f) => f.kind === 'entity' && !f.intermediate)
        .map((f) => keyOf(model, f, band.mode))
        .filter((k) => k !== ''),
    ),
  ];
  const parts = [`round trip ${String(depth)}`];
  if (list.length > 1) parts.push(`${String(list.length)} in parallel`);
  if (keys.length > 0) parts.push(`by key ${keys.join(', ')}`);
  const times = list.map((f) => band.msOf(f)).filter((x): x is number => x !== null);
  if (times.length === list.length && times.length > 0) {
    parts.push(`~${String(Math.max(...times))} ms, the slowest fetch in the band`);
  }
  const writes =
    plan.kind === 'mutation' && depth === 1 ? strings(prop(model.get(band.id), 'writes')) : [];
  return { kind: 'band', key: `band:${String(depth)}`, text: parts.join(' · '), writes };
}

/** One return arrow, innermost layer first. */
export function fillRowView(layers: readonly CacheRow[]): FillRowView | null {
  const stores = layers
    .filter((l) => l.fills)
    .map((l) => l.store)
    .toReversed();
  return stores.length === 0 ? null : { kind: 'fill', key: 'fill', stores };
}
