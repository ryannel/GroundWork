// What the system map is drawn from, and what it comes out as. The input is plain data (no model), so the map
// can lay itself out again in the browser when the reader changes what to show.

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

export interface MapServiceIn extends MapNodeIn {
  readonly system: string | null;
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
  readonly systems: readonly MapNodeIn[];
  readonly stores: readonly MapSatelliteIn[];
  readonly edges: readonly MapEdgeIn[];
  readonly steps: readonly MapStepIn[];
  readonly stages: readonly MapStageIn[];
  /** The stage column each service sits in, by its place in `stages`. */
  readonly stageOf: Readonly<Record<string, number>>;
  readonly refs: Readonly<Record<string, MapRefIn>>;
  /** The interface a `via` belongs to, where the model has one. */
  readonly interfaceOf: Readonly<Record<string, string>>;
  readonly labels: Readonly<Record<string, string>>;
  /** The team whose view it is: the rest are dimmed, its neighbours kept readable. */
  readonly lens: string | null;
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

export type LensState = 'on' | 'near' | 'off' | null;

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

export interface DrawnPart {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly tip: string;
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
  readonly parts: readonly DrawnPart[];
  /** A system folded to one card listing its parts. */
  readonly folded: boolean;
}

export interface DrawnLine {
  readonly key: string;
  readonly kind: LineKind;
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
  readonly stage: number;
  readonly id: string;
  readonly name: string;
  readonly tip: string;
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
  readonly services: number;
  readonly satellites: number;
}
