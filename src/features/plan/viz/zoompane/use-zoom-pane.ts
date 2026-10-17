import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  type Bounds,
  frameDiagram,
  isPartial,
  type PaneView,
  stepScale,
  type ZoomCommand,
  zoomAbout,
  zoomKey,
} from '@/application/plan-viz-zoompane';
import { openId } from '@/features/plan/inspector-history';

import { bindGestures } from './zoom-gestures';

export interface PaneSpec {
  readonly w: number;
  readonly h: number;
  readonly focus: Bounds | null;
  readonly readable: number;
  readonly minFit: number;
  readonly scroll: boolean;
}

interface Panel {
  readonly vw: number;
  readonly vh: number;
}

type Framed = 'auto' | 'fit' | 'focus';

/** The view a drawing opens in: whole when it is small, on the selection when whole would be unreadable. */
function autoView(spec: PaneSpec, panel: Panel, framed: Framed): PaneView {
  const { w, h, focus, readable, minFit } = spec;
  const whole = frameDiagram({ w, h, ...panel, minFit });
  if (framed === 'fit') return whole;
  const selected = frameDiagram({ w, h, ...panel, bounds: focus, readable, focus: focus !== null });
  return framed === 'focus' || (readable > 0 && whole.s < readable) ? selected : whole;
}

/** The panel's size, kept up to date while it is expanded. */
function usePanelSize(box: RefObject<HTMLDivElement | null>, active: boolean): Panel | null {
  const [panel, setPanel] = useState<Panel | null>(null);
  useLayoutEffect((): (() => void) | undefined => {
    const el = box.current;
    if (!active || el === null) return;
    const measure = (): void => {
      setPanel({ vw: el.clientWidth, vh: Math.max(1, el.clientHeight) });
    };
    measure();
    if (typeof ResizeObserver !== 'function') return;
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => {
      watch.disconnect();
    };
  }, [active, box]);
  return panel;
}

/** Puts the drawing where the view says; it is moved with the DOM because a style prop is not allowed. */
function useTransform(pan: RefObject<HTMLDivElement | null>, view: PaneView | null, drawn: Panel) {
  useLayoutEffect(() => {
    const el = pan.current;
    if (el === null) return;
    const to =
      view === null
        ? ''
        : `translate(${String(Math.round(view.x))}px, ${String(Math.round(view.y))}px) scale(${String(view.s)})`;
    el.style.setProperty('transform', to);
    el.style.setProperty('--zoom-w', `${String(drawn.vw)}px`);
    el.style.setProperty('--zoom-h', `${String(drawn.vh)}px`);
  }, [drawn.vh, drawn.vw, pan, view]);
}

interface KeyActions {
  readonly command: (command: ZoomCommand) => void;
  readonly close: () => void;
  readonly zoomable: boolean;
  readonly focusable: boolean;
}

/** + − 0 1 F zoom, Esc closes (unless the inspector is open: that closes first). */
function useZoomKeys(on: boolean, actions: KeyActions) {
  const { command, close, zoomable, focusable } = actions;
  useEffect((): (() => void) | undefined => {
    if (!on) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.altKey || event.metaKey || event.ctrlKey) return;
      if (
        event.target instanceof Element &&
        event.target.closest('input, textarea, select, [contenteditable]') !== null
      ) {
        return;
      }
      if (event.key === 'Escape') {
        if (openId() === null) close();
        return;
      }
      const c = zoomKey(event.key);
      if (c === null || !zoomable || (c === 'focus' && !focusable)) return;
      event.preventDefault();
      command(c);
    };
    globalThis.addEventListener('keydown', onKey, true);
    return () => {
      globalThis.removeEventListener('keydown', onKey, true);
    };
  }, [close, command, focusable, on, zoomable]);
}

export interface ZoomPaneState {
  readonly full: boolean;
  readonly view: PaneView | null;
  readonly partial: boolean;
  readonly toggle: (on: boolean) => void;
  readonly command: (command: ZoomCommand) => void;
}

/**
 * The state of a pan and zoom panel: whether it fills the screen, and where the drawing sits in it. The view is
 * worked out from the drawing, the panel and what the reader last asked for, so a redraw keeps a fitted or
 * focused view fitted or focused and a view the reader moved where they left it.
 */
export function useZoomPane(
  spec: PaneSpec,
  refs: {
    readonly box: RefObject<HTMLDivElement | null>;
    readonly pan: RefObject<HTMLDivElement | null>;
  },
): ZoomPaneState {
  const [full, setFull] = useState(false);
  const [framed, setFramed] = useState<Framed>('auto');
  const [moved, setMoved] = useState<PaneView | null>(null);
  const active = full && !spec.scroll;
  const panel = usePanelSize(refs.box, active);
  const view = active && panel !== null ? (moved ?? autoView(spec, panel, framed)) : null;
  const latest = useRef<PaneView | null>(null);
  useEffect(() => {
    latest.current = view;
  });
  useTransform(refs.pan, view, { vw: spec.w, vh: spec.h });
  useEffect((): (() => void) | undefined => {
    const el = refs.box.current;
    if (!active || el === null) return;
    return bindGestures(el, () => latest.current, setMoved);
  }, [active, refs.box]);

  const toggle = useCallback((on: boolean) => {
    setFull(on);
    setMoved(null);
    setFramed('auto');
  }, []);
  const close = useCallback(() => {
    toggle(false);
  }, [toggle]);
  const command = useCallback(
    (c: ZoomCommand) => {
      if (!full) toggle(true);
      if (c === 'fit' || c === 'focus') {
        setMoved(null);
        setFramed(c);
      } else if (view !== null && panel !== null) {
        setMoved(zoomAbout(view, stepScale(view, c), { x: panel.vw / 2, y: panel.vh / 2 }));
      }
    },
    [full, panel, toggle, view],
  );
  useZoomKeys(full, { command, close, zoomable: active, focusable: spec.focus !== null });
  const partial = view !== null && panel !== null && isPartial(view, spec, panel);
  return { full, view, partial, toggle, command };
}
