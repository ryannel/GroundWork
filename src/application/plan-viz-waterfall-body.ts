import type { Model } from '@/application/plan/derive';
import type { CachePath, CacheRow } from '@/application/plan/federation-cache';
import type { Fetch, QueryPlan } from '@/application/plan/federation-plan-types';
import { prop } from '@/application/plan/ids';
import { compare, type Comparison } from '@/application/plan-viz-waterfall-compare';
import {
  modeKey,
  opPath,
  opPlan,
  waterfallFacts,
  type OpAt,
  type WaterfallCase,
  type WaterfallFacts,
  type WaterfallMode,
} from '@/application/plan-viz-waterfall-facts';
import { fetchMs, fetchRowView, type FetchContext } from '@/application/plan-viz-waterfall-fetch';
import {
  bandRowView,
  cacheRowView,
  fillRowView,
  hingeRowView,
} from '@/application/plan-viz-waterfall-rows';
import { ms } from '@/application/plan-viz-waterfall-text';
import type {
  CacheRowView,
  WaterfallBodyView,
  WaterfallOptions,
  WaterfallRow,
} from '@/application/plan-viz-waterfall-view';
import {
  captionText,
  landingCase,
  summaryText,
  waterfallCases,
  type CaseChoice,
} from '@/application/plan-viz-waterfall-words';

interface Build {
  readonly id: string;
  readonly mode: WaterfallMode;
  readonly compact: boolean;
  readonly diff: boolean;
  readonly lens: string | null;
  readonly plan: QueryPlan;
  readonly cp: CachePath;
  readonly facts: WaterfallFacts;
  readonly cmp: Comparison | null;
}

function todayRow(model: Model, b: Build, r: CacheRow): CacheRowView | null {
  if (!b.diff || r.state !== 'blocked' || b.cmp?.before === null || b.cmp === null) return null;
  const was = opPath(model, { id: b.id, mode: 'asIs' }, b.cp.case)?.layers.find(
    (x) => x.store === r.store,
  );
  if (was === undefined || was.state === 'blocked') return null;
  const live = { ...was, state: 'miss' } satisfies CacheRow;
  const extras = { policy: b.cmp.before.policy, partial: false, note: 'today', wasLive: true };
  return cacheRowView(model, live, extras);
}

function cacheRows(model: Model, b: Build): WaterfallRow[] {
  const rows: WaterfallRow[] = [];
  for (const r of b.cp.layers.filter((l) => l.layer !== 'subgraph')) {
    if (b.compact && r.state !== 'hit') continue;
    const today = todayRow(model, b, r);
    if (today !== null) rows.push(today);
    const partial = r.store === b.cp.partial;
    const note = today === null ? null : 'with this plan';
    rows.push(cacheRowView(model, r, { policy: b.facts.policy, partial, note }));
  }
  return rows;
}

function fetchContext(model: Model, b: Build): FetchContext {
  const measured =
    b.plan.fetches.length > 0 && b.plan.fetches.every((f) => fetchMs(model, f) !== null);
  const all = b.plan.fetches.map((f) => fetchMs(model, f)).filter((x): x is number => x !== null);
  const edgeLike = b.cp.layers.filter((l) => l.layer !== 'subgraph');
  return {
    fstate: new Map(b.cp.fetches.map((f) => [f.id, f.state])),
    dataRows: b.cp.layers.filter((l) => l.layer === 'subgraph'),
    entityRows: edgeLike.filter((l) => l.granularity === 'entity'),
    blast: model.blastRadius(b.id, b.mode),
    msOf: measured ? (f: Fetch) => fetchMs(model, f) : () => null,
    maxMs: measured ? Math.max(...all) : null,
    change: null,
    lens: b.lens,
    compact: b.compact,
    cols: Math.max(1, b.plan.roundTrips) + 1,
    plan: b.plan,
  };
}

function byDepth(fetches: readonly Fetch[]): [number, Fetch[]][] {
  const groups = new Map<number, Fetch[]>();
  for (const f of fetches) groups.set(f.depth, [...(groups.get(f.depth) ?? []), f]);
  return [...groups].toSorted((a, b) => a[0] - b[0]);
}

function fetchRows(model: Model, b: Build): WaterfallRow[] {
  const ctx = fetchContext(model, b);
  const rows: WaterfallRow[] = [];
  for (const [depth, fetches] of byDepth(b.plan.fetches)) {
    if (!b.compact) {
      rows.push(
        bandRowView(model, b.plan, { depth, fetches, id: b.id, mode: b.mode, msOf: ctx.msOf }),
      );
    }
    for (const f of fetches) {
      rows.push(fetchRowView(model, f, { ...ctx, change: b.cmp?.changes.get(f.id) ?? null }));
    }
  }
  const before = b.cmp?.before;
  if (before === undefined || before === null) return rows;
  const gone = {
    ...ctx,
    plan: before.plan,
    fstate: new Map<string, 'run' | 'skipped'>(),
    blast: [],
    change: { kind: 'gone' },
  } satisfies FetchContext;
  return [...rows, ...(b.cmp?.gone ?? []).map((f) => fetchRowView(model, f, gone))];
}

function hingeRows(b: Build): WaterfallRow[] {
  if (b.compact) return [];
  const answer = b.cp.layers.find((l) => l.store === b.cp.answeredBy);
  const skipped = answer?.layer === 'edge' && answer.granularity !== 'entity';
  const hinge = hingeRowView(b.plan, skipped ? 'skipped' : 'run');
  return hinge === null ? [] : [hinge];
}

interface Wanted {
  readonly id: string;
  readonly kase: WaterfallCase;
  readonly mode: WaterfallMode;
  readonly compact: boolean;
  readonly diff: boolean;
  readonly lens: string | null;
}

function bodyView(model: Model, o: Wanted): WaterfallBodyView | null {
  const { id, kase } = o;
  const plan = opPlan(model, id, o.mode);
  const cp = opPath(model, { id, mode: o.mode }, kase);
  if (plan === null || cp === null) return null;
  const facts = waterfallFacts(model, id, o.mode);
  const cmp = o.diff ? compare(model, id, plan) : null;
  const b: Build = { ...o, plan, cp, facts, cmp };
  const fill = o.compact ? null : fillRowView(cp.layers);
  const rows = [
    ...cacheRows(model, b),
    ...hingeRows(b),
    ...fetchRows(model, b),
    ...(fill === null ? [] : [fill]),
  ];
  const hasCache = cp.layers.some((l) => l.layer !== 'subgraph');
  return {
    kase,
    caption: !o.compact && hasCache ? captionText(model, cp) : null,
    rows,
    summary: summaryText(model, { facts, cp, before: cmp?.before ?? null }),
  };
}

export interface WaterfallView {
  readonly id: string;
  readonly compact: boolean;
  readonly diff: boolean;
  readonly mutation: boolean;
  readonly title: string;
  readonly note: string | null;
  /** The layer's measured averages, which belong to the layer rather than the operation. */
  readonly times: { readonly text: string; readonly title: string } | null;
  readonly cases: readonly CaseChoice[];
  readonly withControl: boolean;
  /** The case it opens on. */
  readonly landing: WaterfallCase;
  readonly bodies: readonly WaterfallBodyView[];
}

function timesOf(facts: WaterfallFacts): WaterfallView['times'] {
  if (!facts.layerObserved) return null;
  const parts = [
    facts.layerHit === null ? null : `hit ${ms(facts.layerHit)}`,
    facts.layerCold === null ? null : `miss ${ms(facts.layerCold)}`,
  ].filter((x): x is string => x !== null);
  return {
    text: `${facts.hitLayerName} cache averages: ${parts.join(' · ')}`,
    title: 'Measured on the layer, for every operation behind it',
  };
}

function titleOf(diff: boolean, mutation: boolean): string {
  if (diff) return 'Who answers, with this plan';
  return mutation ? 'What it writes, and who answers' : 'Who answers, and how long each takes';
}

const stepCase = (model: Model, stepId: string | null | undefined): string | null => {
  const kase = stepId === null || stepId === undefined ? null : prop(model.get(stepId), 'case');
  return typeof kase === 'string' ? kase : null;
};

interface Shown {
  readonly withControl: boolean;
  readonly landing: WaterfallCase;
  readonly cases: readonly WaterfallCase[];
}

/** Which cases get a body: all of them under the control, else the one the reader lands on (or the cold path). */
function shownOf(model: Model, at: OpAt, opts: WaterfallOptions): Shown {
  const { id, mode } = at;
  const choices = waterfallCases(model, id, mode);
  const compact = opts.compact === true;
  const mutation = opPlan(model, id, mode)?.kind === 'mutation';
  const landing = landingCase(choices, opts.kase ?? stepCase(model, opts.stepId));
  const withControl = !compact && opts.diff !== true && choices.length > 1 && !mutation;
  if (withControl) return { withControl, landing, cases: choices.map((c) => c.kase) };
  const only = compact ? landing : 'cold';
  return { withControl, landing: only, cases: [only] };
}

/** Everything a waterfall draws for one operation, or null when this side of the plan has no such operation. */
export function waterfallView(
  model: Model,
  id: string,
  opts: WaterfallOptions = {},
): WaterfallView | null {
  const mode = modeKey(opts.mode);
  const plan = opPlan(model, id, mode);
  if (plan === null) return null;
  const compact = opts.compact === true;
  const diff = opts.diff === true;
  const mutation = plan.kind === 'mutation';
  const shown = shownOf(model, { id, mode }, opts);
  const o = { id, mode, compact, diff, lens: opts.lens ?? null };
  return {
    id,
    compact,
    diff,
    mutation,
    title: titleOf(diff, mutation),
    note: mutation ? 'mutations are never cached' : null,
    times: timesOf(waterfallFacts(model, id, mode)),
    cases: waterfallCases(model, id, mode),
    withControl: shown.withControl,
    landing: shown.landing,
    bodies: shown.cases.flatMap((kase) => bodyView(model, { ...o, kase }) ?? []),
  };
}
