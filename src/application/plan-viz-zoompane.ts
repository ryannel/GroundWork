/** A rectangle in drawing coordinates. */
export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where the drawing sits in its panel: a scale and an offset in panel pixels. */
export interface PaneView {
  s: number;
  x: number;
  y: number;
  /** Framed to show the whole drawing. */
  fit: boolean;
  /** Framed on the selected interaction. */
  focus: boolean;
}

export interface Framing {
  /** The drawn size. */
  w: number;
  h: number;
  /** The panel's size. */
  vw: number;
  vh: number;
  /** What the selected interaction takes up; null when nothing is selected. */
  bounds?: Bounds | null;
  /** Large drawings frame the selection at no less than this scale. */
  readable?: number;
  focus?: boolean;
  /** The smallest scale Fit may use. */
  minFit?: number;
}

export type ZoomCommand = 'in' | 'out' | 'reset' | 'fit' | 'focus';

export const ZOOM_MIN = 0.15;
export const ZOOM_MAX = 3;
const PADDING = 24;
const WHOLE_MAX = 1.25;
const STEP_IN = 1.25;
const STEP_OUT = 0.8;
const NOTCH_CAP = 40;
const LINE_HEIGHT_PX = 20;

const clampZoom = (s: number): number => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, s));

function centred(offset: number, size: number, room: { viewport: number; scale: number }): number {
  const { viewport, scale } = room;
  const drawn = size * scale;
  if (drawn <= viewport) return (viewport - drawn) / 2;
  return Math.max(viewport - drawn - PADDING, Math.min(PADDING, offset));
}

/**
 * Frame either the whole drawing or the selected interaction. A readable minimum can make a very wide
 * interaction partial; it never silently shrinks its labels.
 */
export function frameDiagram(framing: Framing): PaneView {
  const { w, h, vw, vh, bounds = null, readable = 0, focus = false, minFit = 0 } = framing;
  const roomW = Math.max(1, vw - 2 * PADDING);
  const roomH = Math.max(1, vh - 2 * PADDING);
  const whole = Math.max(minFit, Math.min(WHOLE_MAX, roomW / w, roomH / h));
  if (!focus || bounds === null) {
    return {
      s: whole,
      x: (vw - w * whole) / 2,
      y: Math.max(16, (vh - h * whole) / 2),
      fit: true,
      focus: false,
    };
  }
  const fitW = roomW / Math.max(1, bounds.w);
  const fitH = roomH / Math.max(1, bounds.h);
  const s = Math.max(readable, Math.min(WHOLE_MAX, fitW, fitH));
  return {
    s,
    x: centred(vw / 2 - (bounds.x + bounds.w / 2) * s, w, { viewport: vw, scale: s }),
    y: centred(vh / 2 - (bounds.y + bounds.h / 2) * s, h, { viewport: vh, scale: s }),
    fit: false,
    focus: true,
  };
}

/** Zoom to a scale, keeping the point under `at` where it is. */
export function zoomAbout(view: PaneView, scale: number, at: { x: number; y: number }): PaneView {
  const s = clampZoom(scale);
  return {
    s,
    x: at.x - (at.x - view.x) * (s / view.s),
    y: at.y - (at.y - view.y) * (s / view.s),
    fit: false,
    focus: false,
  };
}

/** The scale one wheel event asks for: a pinch arrives in small steps, a mouse notch is capped near 1.7×. */
export function wheelScale(view: PaneView, deltaY: number, lines: boolean): number {
  const delta = Math.max(-NOTCH_CAP, Math.min(NOTCH_CAP, deltaY * (lines ? LINE_HEIGHT_PX : 1)));
  return view.s * 2 ** (-delta * 0.02);
}

/** The scale a zoom button or key asks for, about the middle of the panel. */
export function stepScale(view: PaneView, command: 'in' | 'out' | 'reset'): number {
  if (command === 'reset') return 1;
  return view.s * (command === 'in' ? STEP_IN : STEP_OUT);
}

/** Moved by a drag or a scroll: no longer fitted or focused. */
export const panned = (view: PaneView, x: number, y: number): PaneView => ({
  ...view,
  x,
  y,
  fit: false,
  focus: false,
});

/** Does the panel leave part of the drawing out of sight? */
export function isPartial(
  view: PaneView,
  drawn: { w: number; h: number },
  panel: { vw: number; vh: number },
): boolean {
  return !(
    view.x >= -1 &&
    view.y >= -1 &&
    view.x + drawn.w * view.s <= panel.vw + 1 &&
    view.y + drawn.h * view.s <= panel.vh + 1
  );
}

export const zoomPercent = (view: PaneView | null): string =>
  `${String(Math.round((view?.s ?? 1) * 100))}%`;

const KEYS: Readonly<Record<string, ZoomCommand>> = {
  '+': 'in',
  '=': 'in',
  '-': 'out',
  _: 'out',
  '0': 'fit',
  '1': 'reset',
  f: 'focus',
  F: 'focus',
};

/** The zoom command a key stands for, if any. */
export const zoomKey = (key: string): ZoomCommand | null => KEYS[key] ?? null;

/** Which edges of a sideways-scrolling panel have more behind them. */
export function scrollCue(box: { scrollLeft: number; scrollWidth: number; clientWidth: number }): {
  more: boolean;
  left: boolean;
  right: boolean;
} {
  const more = box.scrollWidth - box.clientWidth > 4;
  return {
    more,
    left: more && box.scrollLeft > 4,
    right: more && box.scrollLeft + box.clientWidth < box.scrollWidth - 4,
  };
}
