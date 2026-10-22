// What the system map is drawn from, and what it comes out as. The input is plain data (no model), so the map
// can lay itself out again in the browser when the reader changes what to show.

import type { SystemTier } from '@/domain/workspace';

export type LineKind = 'api' | 'msg' | 'data';

export interface MapNodeIn {
  readonly id: string;
  readonly name: string;
  /** The kind of service (ui, job, external, service) or of store (database, cache, topic, queue …). */
  readonly kind: string;
  /** Its role in plain words; empty when none is recorded. */
  readonly does: string;
  readonly team: string | null;
  readonly teamSlot: number;
}

export interface MapSystemIn extends MapNodeIn {
  /** How many services it holds and how many stores and topics they own, across the whole model. */
  readonly parts?: number;
  readonly stores?: number;
  /** The domain it belongs to, by name, when that is not the one the map is about. */
  readonly place?: string;
}

export interface MapServiceIn extends MapNodeIn {
  readonly system: string | null;
  /** Plumbing such as feature flags or sign-in, which the map hides until the reader asks. */
  readonly infrastructure?: boolean;
}

export interface MapSatelliteIn extends MapNodeIn {
  readonly topic: boolean;
  readonly owner: string | null;
  /** The events a topic carries, by name. */
  readonly carries: readonly string[];
}

export interface MapEdgeIn {
  readonly kind: LineKind;
  readonly from: string;
  readonly to: string;
  readonly via: string | null;
  readonly steps: readonly string[];
  readonly read: boolean;
  readonly write: boolean;
}

export interface MapStepIn {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly via: string;
}

export interface MapStageIn {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly entries: readonly { readonly svc: string; readonly reads: readonly string[] }[];
}

export interface MapRefIn {
  readonly type: string;
  /** The service an interface belongs to. */
  readonly service: string | null;
  /** The interface an endpoint belongs to. */
  readonly parent: string | null;
  readonly topic: boolean;
}

export interface SystemMapInput {
  readonly services: readonly MapServiceIn[];
  readonly systems: readonly MapSystemIn[];
  readonly stores: readonly MapSatelliteIn[];
  readonly edges: readonly MapEdgeIn[];
  readonly steps: readonly MapStepIn[];
  readonly stages: readonly MapStageIn[];
  /** The stage column each service sits in, by its place in `stages`. */
  readonly stageOf: Readonly<Record<string, number>>;
  readonly refs: Readonly<Record<string, MapRefIn>>;
  /** The interface a `via` belongs to, where the model has one. */
  readonly interfaceOf: Readonly<Record<string, string>>;
  /** How each `via` travels, in words ("GraphQL query", "REST call"), where the model says. */
  readonly callWords?: Readonly<Record<string, string>>;
  /** What each `via` carries, as a noun ("Product", "Price changed"): the schema it answers with, else its name. */
  readonly carries?: Readonly<Record<string, string>>;
  readonly labels: Readonly<Record<string, string>>;
  /** The team whose view it is: the rest are dimmed, its neighbours kept readable. */
  readonly lens: string | null;
  /** The components and systems a scoped map is about: the rest are drawn as outside. Null for the whole map. */
  readonly focus: readonly string[] | null;
  /** The tier each system sits in, by `sys:` id, for a map read system by system; absent and each is back end. */
  readonly tiers?: Readonly<Record<string, SystemTier>>;
}

/** Which layers are drawn. */
export interface MapShow {
  readonly parts: boolean;
  readonly ifs: boolean;
  readonly topics: boolean;
  readonly stores: boolean;
}

export const SHOW_ALL: MapShow = { parts: true, ifs: true, topics: true, stores: true };
export const SHOW_OVERVIEW: MapShow = { parts: false, ifs: false, topics: false, stores: false };

/** How a card sits against the lens or the focus: `out` is a neighbour outside the focus. */
export type LensState = 'on' | 'near' | 'off' | 'out' | null;

export interface DrawnRow {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  /** The row's middle, down from the top of its card. */
  readonly cy: number;
  readonly tip: string;
  /** Which sides of the card a call lands on. */
  readonly landed: readonly ('L' | 'R')[];
}

export interface DrawnNode {
  readonly id: string;
  readonly kind: 'service' | 'system' | 'topic' | 'store';
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly head: number;
  readonly lines: readonly string[];
  readonly role: readonly string[];
  readonly nameEnd: number;
  readonly tx: number;
  readonly top: number;
  /** ui, job, external or service for a card; the store kind for a store. */
  readonly serviceKind: string;
  readonly teamSlot: number;
  readonly lens: LensState;
  readonly kinds: readonly LineKind[];
  readonly tip: string;
  readonly part: boolean;
  readonly compact: boolean;
  readonly external: boolean;
  /** The system this part sits in. */
  readonly system: string | null;
  /** The card a topic or store hangs under. */
  readonly host: string | null;
  readonly rows: readonly DrawnRow[];
  readonly more: {
    readonly count: number;
    readonly cy: number;
    readonly tip: string;
    readonly landed: readonly ('L' | 'R')[];
  } | null;
  /** How many parts a system has, open or folded. */
  readonly partCount: number;
  /** A system folded to one card. */
  readonly folded: boolean;
  /** A system card's foot: the team that owns it, and how big it is ("10 parts · 7 stores"). */
  readonly owner: string;
  readonly size: string;
}

export interface DrawnLine {
  readonly key: string;
  readonly kind: LineKind;
  /** Every kind the line carries; one line may hold a pair's calls, events and reads. */
  readonly kinds: readonly LineKind[];
  readonly a: string;
  readonly b: string;
  readonly hostA: string;
  readonly hostB: string;
  readonly d: string;
  readonly tx: number;
  readonly ty: number;
  readonly into: 1 | -1;
  readonly noted: boolean;
  readonly dim: boolean;
  /** What opens when the line is clicked. */
  readonly inspect: string;
  readonly label: string;
  /** A few words on the line saying what it carries, on a map read system by system; null elsewhere. */
  readonly tag: string | null;
  readonly tip: string;
}

export interface DrawnTrunk {
  readonly host: string;
  readonly unit: string;
  readonly node: string;
  readonly kind: LineKind;
  readonly d: string;
}

export interface DrawnBand {
  readonly x: number;
  readonly w: number;
  /** The stage's place in the plan, or null for a role a run of columns plays on a domain's map. */
  readonly stage: number | null;
  readonly id: string;
  readonly name: string;
  readonly tip: string;
}

/** The band beneath a domain's own systems that holds the systems of other domains. */
export interface DrawnOutside {
  readonly y: number;
  /** The name over each domain's run of cards in a column. */
  readonly heads: readonly { readonly x: number; readonly y: number; readonly name: string }[];
}

export interface InnerLine {
  readonly kind: LineKind;
  readonly a: string;
  readonly b: string;
  readonly hostA: string;
  readonly hostB: string;
}

export interface SystemMapDrawing {
  readonly w: number;
  readonly h: number;
  readonly columns: number;
  readonly nodes: readonly DrawnNode[];
  readonly lines: readonly DrawnLine[];
  /** Lines between a system's own parts: not drawn, but tracing a part still lights its partners. */
  readonly inner: readonly InnerLine[];
  readonly trunks: readonly DrawnTrunk[];
  readonly bands: readonly DrawnBand[];
  readonly outside: DrawnOutside | null;
  readonly services: number;
  readonly satellites: number;
}
