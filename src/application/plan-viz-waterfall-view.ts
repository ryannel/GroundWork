import type { FetchChange } from '@/application/plan-viz-waterfall-compare';
import type { RouterWhy, WaterfallCase } from '@/application/plan-viz-waterfall-facts';

// What a waterfall draws, as data: one row per cache layer, the gateway, each round trip, each fetch and the fill.

/** A small tag on a row: whether a layer answered, missed or was never reached. */
export interface Mark {
  kind: 'hit' | 'miss' | 'skip' | 'blocked';
  /** A block character drawn before the text, which carries no meaning of its own. */
  glyph: string | null;
  text: string;
}

export type RowState = 'hit' | 'miss' | 'skipped' | 'blocked';

export type CacheWhy = { kind: 'private'; field: string } | { kind: 'text'; text: string };

export interface CacheRowView {
  kind: 'cache';
  key: string;
  /** "edge", "gateway" or "data cache". */
  layer: string;
  state: RowState;
  store: string;
  why: CacheWhy | null;
  meta: string;
  /** What each fetch's own cache did, for a gateway entity cache. */
  per: { key: string; text: string; state: RowState }[];
  mark: Mark;
  /** "today" or "with this plan" in a comparison. */
  note: string | null;
  /** Today's row, shown beside the plan's struck one. */
  wasLive: boolean;
}

export interface HingeRowView {
  kind: 'hinge';
  key: string;
  state: 'run' | 'skipped';
  gateway: string;
  team: string | null;
  text: string;
}

export interface BandRowView {
  kind: 'band';
  key: string;
  text: string;
  /** What a mutation's first round trip writes. */
  writes: string[];
}

export interface FillRowView {
  kind: 'fill';
  key: string;
  /** Innermost layer first. */
  stores: string[];
}

export interface FetchFieldView {
  name: string;
  field: string | null;
  router: RouterWhy | null;
}

export interface FetchReadView {
  store: string;
  kind: 'cache' | 'via' | 'store';
  skipped: boolean;
  mark: Mark | null;
}

export interface FetchBarView {
  /** The round-trip column it sits in, counting from 1; the cache marks take column 0. */
  depth: number;
  /** The columns the track has, cache marks included. */
  cols: number;
  /** Its width as a share of the column, when the plan measured it. */
  share: number | null;
  ms: number | null;
  /** The subgraph its endpoint then calls, when it has a via. */
  calls: string | null;
  callsSkipped: boolean;
  skipped: boolean;
}

export interface FetchRowView {
  kind: 'fetch';
  key: string;
  id: string;
  subgraph: string;
  team: string | null;
  state: 'run' | 'skipped';
  lens: 'mine' | 'faded' | null;
  change: FetchChange | null;
  fields: FetchFieldView[];
  batch: { text: string; title: string; warn: boolean } | null;
  gateCache: Mark | null;
  reads: FetchReadView[];
  blast: string | null;
  bar: FetchBarView;
}

export type WaterfallRow = CacheRowView | HingeRowView | BandRowView | FetchRowView | FillRowView;

export interface WaterfallBodyView {
  kase: WaterfallCase;
  caption: string | null;
  rows: WaterfallRow[];
  summary: string;
}

export interface WaterfallOptions {
  mode?: 'asIs' | 'toBe' | undefined;
  /** The case to open on, when the path has it. */
  kase?: string | null | undefined;
  /** Fetch rows only, plus the layer that answers; one case, no control. */
  compact?: boolean | undefined;
  /** A flow step to take the case from. */
  stepId?: string | null | undefined;
  /** The to-be plan against today's. */
  diff?: boolean | undefined;
  /** A team id: its fetch rows keep the accent, the rest fade. */
  lens?: string | null | undefined;
}
