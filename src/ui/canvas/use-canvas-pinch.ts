import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Anchor extends Point {
  readonly graphX: number;
  readonly graphY: number;
}

interface GestureEvent extends Event {
  readonly scale: number;
  readonly clientX: number;
  readonly clientY: number;
}

function isGesture(event: Event): event is GestureEvent {
  const scale = 'scale' in event && typeof event.scale === 'number';
  const point =
    'clientX' in event &&
    typeof event.clientX === 'number' &&
    'clientY' in event &&
    typeof event.clientY === 'number';
  return scale && point;
}

type ZoomAt = (factor: number, point: Point) => void;

interface GestureState {
  readonly isActive: () => boolean;
  readonly setActive: (value: boolean) => void;
}

function gestureHandlers(zoomAt: ZoomAt, active: GestureState): Record<string, EventListener> {
  let scale = 1;
  return {
    gesturestart: (event) => {
      if (!isGesture(event)) return;
      event.preventDefault();
      active.setActive(true);
      scale = event.scale;
    },
    gesturechange: (event) => {
      if (!isGesture(event)) return;
      event.preventDefault();
      if (active.isActive() && scale > 0) {
        zoomAt(event.scale / scale, { x: event.clientX, y: event.clientY });
      }
      scale = event.scale;
    },
    gestureend: (event) => {
      event.preventDefault();
      active.setActive(false);
    },
  };
}

function touchHandlers(zoomAt: ZoomAt, active: GestureState): Record<string, EventListener> {
  let distance: number | null = null;
  const end = (event: Event): void => {
    if (event instanceof TouchEvent) distance = touchPair(event.touches)?.distance ?? null;
  };
  return {
    touchstart: (event) => {
      if (!(event instanceof TouchEvent)) return;
      const pair = touchPair(event.touches);
      distance = pair?.distance ?? null;
      if (pair !== null) event.preventDefault();
    },
    touchmove: (event) => {
      if (!(event instanceof TouchEvent)) return;
      const pair = touchPair(event.touches);
      if (pair === null) return;
      event.preventDefault();
      if (!active.isActive() && distance !== null && distance > 0) {
        zoomAt(pair.distance / distance, pair.point);
      }
      distance = pair.distance;
    },
    touchend: end,
    touchcancel: end,
  };
}

function wheelHandler(
  zoomAt: ZoomAt,
  active: GestureState,
  element: HTMLDivElement,
): EventListener {
  return (event) => {
    if (!(event instanceof WheelEvent) || !event.ctrlKey) return;
    event.preventDefault();
    if (active.isActive()) return;
    let units = 1;
    if (event.deltaMode === 1) units = 16;
    if (event.deltaMode === 2) units = element.clientHeight;
    zoomAt(Math.exp(-event.deltaY * units * 0.01), { x: event.clientX, y: event.clientY });
  };
}

function touchPair(
  touches: TouchList,
): { readonly point: Point; readonly distance: number } | null {
  const first = touches[0];
  const second = touches[1];
  if (first === undefined || second === undefined) return null;
  return {
    point: { x: (first.clientX + second.clientX) / 2, y: (first.clientY + second.clientY) / 2 },
    distance: Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY),
  };
}

function listenPinch(element: HTMLDivElement, zoomAt: ZoomAt): () => void {
  let gestureActive = false;
  const active: GestureState = {
    isActive: () => gestureActive,
    setActive: (value) => {
      gestureActive = value;
    },
  };
  const handlers = Object.entries({
    ...gestureHandlers(zoomAt, active),
    ...touchHandlers(zoomAt, active),
    wheel: wheelHandler(zoomAt, active, element),
  });
  for (const [type, handler] of handlers) {
    element.addEventListener(type, handler, { passive: false });
  }
  return () => {
    for (const [type, handler] of handlers) element.removeEventListener(type, handler);
  };
}

/** Pinches zoom the drawing, not the page, around the gesture's centre. */
export function useCanvasPinch(
  viewportRef: RefObject<HTMLDivElement | null>,
  camera: { readonly zoom: number; readonly changeZoom: (factor: number) => void },
): void {
  const cameraRef = useRef(camera);
  const anchorRef = useRef<Anchor | null>(null);
  useLayoutEffect(() => {
    cameraRef.current = camera;
    const element = viewportRef.current;
    const anchor = anchorRef.current;
    const drawing = element?.querySelector('svg');
    if (element === null || drawing === null || drawing === undefined || anchor === null) return;
    const offset = Math.max(0, (element.clientWidth - drawing.getBoundingClientRect().width) / 2);
    element.scrollLeft = anchor.graphX * camera.zoom + offset - anchor.x;
    element.scrollTop = anchor.graphY * camera.zoom - anchor.y;
    anchorRef.current = null;
  }, [camera, viewportRef]);
  useEffect(() => {
    const element = viewportRef.current;
    if (element === null) {
      return () => {
        anchorRef.current = null;
      };
    }
    const zoomAt = (factor: number, point: Point): void => {
      if (!Number.isFinite(factor) || factor <= 0) return;
      const drawing = element.querySelector('svg');
      if (drawing === null) return;
      const { zoom, changeZoom } = cameraRef.current;
      const next = Math.max(0.01, Math.min(2, zoom * factor));
      if (Object.is(next, zoom)) return;
      const bounds = element.getBoundingClientRect();
      const offset = Math.max(0, (element.clientWidth - drawing.getBoundingClientRect().width) / 2);
      const x = point.x - bounds.left - element.clientLeft;
      const y = point.y - bounds.top - element.clientTop;
      const previous = anchorRef.current;
      anchorRef.current = {
        x,
        y,
        graphX:
          previous === null
            ? (element.scrollLeft + x - offset) / zoom
            : previous.graphX + (x - previous.x) / zoom,
        graphY:
          previous === null
            ? (element.scrollTop + y) / zoom
            : previous.graphY + (y - previous.y) / zoom,
      };
      cameraRef.current = { zoom: next, changeZoom };
      changeZoom(next / zoom);
    };
    return listenPinch(element, zoomAt);
  }, [viewportRef]);
}
