import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';

import { useCanvasPinch } from './canvas/use-canvas-pinch';

interface Drag {
  readonly pointer: number;
  readonly x: number;
  readonly y: number;
  readonly left: number;
  readonly top: number;
  readonly moving: boolean;
}
interface DragHandlers {
  readonly handlePointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  readonly handlePointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  readonly handlePointerUp: (event?: PointerEvent<HTMLDivElement>) => void;
}
interface Viewport extends DragHandlers {
  readonly viewportRef: RefObject<HTMLDivElement | null>;
  readonly zoom: number;
  readonly changeZoom: (factor: number) => void;
  readonly handleFit: () => void;
}

/** A press only becomes a pan once it moves this far, so clicks on cards and lines stay clicks. */
const PAN_THRESHOLD = 4;

/**
 * Drag to pan. The pointer is captured only once a pan starts, and a move with no button held ends it,
 * so a release the page never saw cannot leave the canvas following the mouse.
 */
function useDrag(): DragHandlers {
  const dragRef = useRef<Drag | null>(null);
  const end = (element?: HTMLDivElement): void => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag === null || element === undefined) return;
    const { dataset } = element;
    delete dataset.panning;
    if (element.hasPointerCapture(drag.pointer)) element.releasePointerCapture(drag.pointer);
  };
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' || event.button !== 0 || !(event.target instanceof Element)) {
      return;
    }
    if (event.target.closest('button, a, [role="button"]')) return;
    const element = event.currentTarget;
    dragRef.current = {
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: element.scrollLeft,
      top: element.scrollTop,
      moving: false,
    };
  };
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    if (start?.pointer !== event.pointerId) return;
    const element = event.currentTarget;
    if ((event.buttons & 1) === 0) {
      end(element);
      return;
    }
    const dx = start.x - event.clientX;
    const dy = start.y - event.clientY;
    if (!start.moving) {
      if (Math.hypot(dx, dy) < PAN_THRESHOLD) return;
      dragRef.current = { ...start, moving: true };
      const { dataset } = element;
      dataset.panning = '';
      element.setPointerCapture(event.pointerId);
    }
    element.scrollLeft = start.left + dx;
    element.scrollTop = start.top + dy;
  };
  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp: (event) => {
      end(event?.currentTarget);
    },
  };
}

export function useExplorerViewport(
  width: number,
  height: number,
  options: boolean | { readonly fit: boolean; readonly minimumFit: number },
): Viewport {
  const { fit, minimumFit } =
    typeof options === 'boolean' ? { fit: options, minimumFit: 0.12 } : options;
  const viewportRef = useRef<HTMLDivElement>(null);
  const manualRef = useRef(false);
  const availableRef = useRef({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const handlers = useDrag();
  useEffect(() => {
    const element = viewportRef.current;
    const handleResize = () => {
      const available = element?.clientWidth ?? 0;
      const tall = window.innerHeight * 0.72;
      const viewportChanged =
        Math.abs(available - availableRef.current.width) > 0.5 ||
        Math.abs(tall - availableRef.current.height) > 0.5;
      availableRef.current = { width: available, height: tall };
      if (fit && !manualRef.current && viewportChanged && available > 0) {
        setZoom(Math.max(minimumFit, Math.min(1, available / width, tall / height)));
      }
    };
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(handleResize);
    if (element !== null) observer?.observe(element);
    return () => {
      observer?.disconnect();
    };
  }, [width, height, fit, minimumFit]);
  const handleFit = () => {
    const viewport = viewportRef.current;
    const available = viewport?.clientWidth ?? 0;
    const tall = window.innerHeight * 0.72;
    if (available > 0) setZoom(Math.max(0.01, Math.min(1, available / width, tall / height)));
    if (viewport !== null) {
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    }
    manualRef.current = false;
  };
  const changeZoom = (factor: number) => {
    manualRef.current = true;
    setZoom((current) => Math.max(0.01, Math.min(2, current * factor)));
  };
  useCanvasPinch(viewportRef, { zoom, changeZoom });
  return { viewportRef, zoom, changeZoom, handleFit, ...handlers };
}
