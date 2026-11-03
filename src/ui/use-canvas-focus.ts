import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';

import type { ConnectedCanvasFocus } from './connected-canvas-types';

interface Focused {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

function visibleViewport(element: HTMLDivElement): {
  readonly height: number;
  readonly top: number;
} {
  const top = element.getBoundingClientRect().top;
  const hidden = Math.max(0, -top);
  return {
    height: Math.max(
      1,
      Math.min(element.clientHeight - hidden, window.innerHeight - Math.max(0, top) - 24),
    ),
    top: hidden,
  };
}

function focusZoom(
  focus: ConnectedCanvasFocus,
  viewport: HTMLDivElement | null,
  zoom: number,
): number {
  if (viewport === null) return zoom;
  if (focus.fit === true) {
    return Math.max(
      focus.minimumZoom ?? 0.01,
      Math.min(
        focus.maximumZoom ?? zoom,
        (viewport.clientWidth - 96) / focus.width,
        (visibleViewport(viewport).height - 96) / focus.height,
      ),
    );
  }
  if (focus.readable === true) {
    return Math.max(
      focus.minimumZoom ?? 0.85,
      Math.min(1, (viewport.clientWidth - 48) / focus.width),
    );
  }
  return zoom;
}

/**
 * Centre a newly selected component; panning and fitting otherwise retain their own camera. When the
 * layout moves the same component, the view shifts with it so the reader's place stays put.
 */
export function useCanvasFocus(
  focus: ConnectedCanvasFocus | null | undefined,
  viewportRef: RefObject<HTMLDivElement | null>,
  camera: { readonly zoom: number; readonly changeZoom: (factor: number) => void },
): () => void {
  const { zoom, changeZoom } = camera;
  const focusedRef = useRef<Focused | null>(null);
  const initialFocusRef = useRef(true);
  const reveal = useCallback(() => {
    const element = viewportRef.current;
    if (focus === undefined || focus === null || element?.scrollTo === undefined) return;
    const visible =
      focus.fit === true ? visibleViewport(element) : { height: element.clientHeight, top: 0 };
    element.scrollTo({
      left: Math.max(
        0,
        focus.x * zoom - Math.max(24, (element.clientWidth - focus.width * zoom) / 2),
      ),
      top: Math.max(
        0,
        focus.y * zoom - visible.top - Math.max(24, (visible.height - focus.height * zoom) / 2),
      ),
      behavior: 'auto',
    });
  }, [focus, viewportRef, zoom]);
  useLayoutEffect(() => {
    if (focus === undefined || focus === null) {
      focusedRef.current = null;
      return;
    }
    const focused = focusedRef.current;
    if (focused?.id === focus.id) {
      const element = viewportRef.current;
      if (element !== null) {
        element.scrollLeft += (focus.x - focused.x) * zoom;
        element.scrollTop += (focus.y - focused.y) * zoom;
      }
      focusedRef.current = { id: focus.id, x: focus.x, y: focus.y };
      return;
    }
    const initial = initialFocusRef.current;
    initialFocusRef.current = false;
    if (initial && focus.revealViewport === true) {
      const surface = viewportRef.current?.parentElement ?? viewportRef.current;
      surface?.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
    const target = focusZoom(focus, viewportRef.current, zoom);
    if (Math.abs(zoom - target) > 0.000_001) {
      changeZoom(target / zoom);
      return;
    }
    focusedRef.current = { id: focus.id, x: focus.x, y: focus.y };
    reveal();
  }, [focus, reveal, zoom, changeZoom, viewportRef]);
  return reveal;
}
