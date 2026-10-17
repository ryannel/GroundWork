import type { FetchChange } from '@/application/plan-viz-waterfall-compare';
import type { RouterWhy, WaterfallCase } from '@/application/plan-viz-waterfall-facts';

// What a waterfall draws, as data: one row per cache layer, the gateway, each round trip, each fetch and the fill.

/** A small tag on a row: whether a layer answered, missed or was never reached. */
export interface Mark {
  readonly kind: 'hit' | 'miss' | 'skip' | 'blocked';
  /** A block character drawn before the text, which carries no meaning of its own. */
  readonly glyph: string | null;
  readonly text: string;
}

export type RowState = 'hit' | 'miss' | 'skipped' | 'blocked';

export type CacheWhy =
  | { readonly kind: 'private'; readonly field: string }
  | { readonly kind: 'text'; readonly text: string };

export interface CacheRowView {
  readonly kind: 'cache';
  readonly key: string;
  /** "edge", "gateway" or "data cache". */
  readonly layer: string;
  readonly state: RowState;
  readonly store: string;
  readonly why: CacheWhy | null;
  readonly meta: string;
  /** What each fetch's own cache did, for a gateway entity cache. */
  readonly per: readonly {
    readonly key: string;
    readonly text: string;
    readonly state: RowState;
  }[];
  readonly mark: Mark;
  /** "today" or "with this plan" in a comparison. */
  readonly note: string | null;
  /** Today's row, shown beside the plan's struck one. */
  readonly wasLive: boolean;
}

export interface HingeRowView {
  readonly kind: 'hinge';
  readonly key: string;
  readonly state: 'run' | 'skipped';
  readonly gateway: string;
  readonly team: string | null;
  readonly text: string;
}

export interface BandRowView {
  readonly kind: 'band';
  readonly key: string;
  readonly text: string;
  /** What a mutation's first round trip writes. */
  readonly writes: readonly string[];
}

export interface FillRowView {
  readonly kind: 'fill';
  readonly key: string;
  /** Innermost layer first. */
  readonly stores: readonly string[];
}

export interface FetchFieldView {
  readonly name: string;
  readonly field: string | null;
  readonly router: RouterWhy | null;
}

export interface FetchReadView {
  readonly store: string;
  readonly kind: 'cache' | 'via' | 'store';
  readonly skipped: boolean;
  readonly mark: Mark | null;
}

export interface FetchBarView {
  /** The round-trip column it sits in, counting from 1; the cache marks take column 0. */
  readonly depth: number;
  /** The columns the track has, cache marks included. */
  readonly cols: number;
  /** Its width as a share of the column, when the plan measured it. */
  readonly share: number | null;
  readonly ms: number | null;
  /** The subgraph its endpoint then calls, when it has a via. */
  readonly calls: string | null;
  readonly callsSkipped: boolean;
  readonly skipped: boolean;
}

export interface FetchRowView {
  readonly kind: 'fetch';
  readonly key: string;
  readonly id: string;
  readonly subgraph: string;
  readonly team: string | null;
  readonly state: 'run' | 'skipped';
  readonly lens: 'mine' | 'faded' | null;
  readonly change: FetchChange | null;
  readonly fields: readonly FetchFieldView[];
  readonly batch: { readonly text: string; readonly title: string; readonly warn: boolean } | null;
  readonly gateCache: Mark | null;
  readonly reads: readonly FetchReadView[];
  readonly blast: string | null;
  readonly bar: FetchBarView;
}

export type WaterfallRow = CacheRowView | HingeRowView | BandRowView | FetchRowView | FillRowView;

export interface WaterfallBodyView {
  readonly kase: WaterfallCase;
  readonly caption: string | null;
  readonly rows: readonly WaterfallRow[];
  readonly summary: string;
}

export interface WaterfallOptions {
  readonly mode?: 'asIs' | 'toBe' | undefined;
  /** The case to open on, when the path has it. */
  readonly kase?: string | null | undefined;
  /** Fetch rows only, plus the layer that answers; one case, no control. */
  readonly compact?: boolean | undefined;
  /** A flow step to take the case from. */
  readonly stepId?: string | null | undefined;
  /** The to-be plan against today's. */
  readonly diff?: boolean | undefined;
  /** A team id: its fetch rows keep the accent, the rest fade. */
  readonly lens?: string | null | undefined;
}
