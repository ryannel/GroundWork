import type { LinkKind } from './landscape-map-input';

export type BoxKind = 'actor' | 'domain' | 'frame' | 'system' | 'external';

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** One box on the canvas: a person, a folded domain, an open domain's frame, a system or an outside service. */
export interface LandNode extends Box {
  readonly id: string;
  readonly kind: BoxKind;
  readonly eyebrow: string;
  readonly name: string;
  readonly text: string | null;
  readonly href: string | null;
  /** Its team's colour slot, for a system; 0 when no team owns it. */
  readonly teamSlot: number;
  /** The colour slots of the teams inside a folded domain. */
  readonly dots: readonly number[];
  /** The domain a system or frame belongs to. */
  readonly domain: string | null;
}

/** The connections between two boxes, rolled up into one line. */
export interface LandLine {
  readonly id: string;
  readonly a: string;
  readonly b: string;
  /** The strongest kind on it, which sets how it is drawn. */
  readonly kind: LinkKind;
  readonly kinds: readonly LinkKind[];
  /** Something goes from a to b; from b to a. */
  readonly forward: boolean;
  readonly back: boolean;
  /** What it goes through: "Pricing API and catalog.events", or "… and 3 more". */
  readonly label: string;
  readonly d: string;
  /** Where its label sits, on the longest level stretch, and how long that stretch is; 0 when none is level. */
  readonly mx: number;
  readonly my: number;
  readonly room: number;
}

export interface LandDrawing {
  readonly width: number;
  readonly height: number;
  readonly nodes: readonly LandNode[];
  readonly lines: readonly LandLine[];
}
