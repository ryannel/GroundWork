// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import type { PointerEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useExplorerViewport } from './use-explorer-viewport';

function pointer(element: HTMLDivElement, init: Partial<PointerEvent<HTMLDivElement>>) {
  return {
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    buttons: 1,
    clientX: 0,
    clientY: 0,
    target: element,
    currentTarget: element,
    ...init,
  } as PointerEvent<HTMLDivElement>;
}

function setup() {
  const element = document.createElement('div');
  const capture = vi.fn<(id: number) => void>();
  const release = vi.fn<(id: number) => void>();
  element.setPointerCapture = capture;
  element.releasePointerCapture = release;
  element.hasPointerCapture = () => true;
  const { result } = renderHook(() => useExplorerViewport(2000, 1500, false));
  return { element, capture, release, viewport: result };
}

describe('explorer viewport drag', () => {
  it('leaves a click alone until the pointer moves far enough to pan', () => {
    const { element, capture, viewport } = setup();
    act(() => {
      viewport.current.handlePointerDown(pointer(element, { clientX: 100, clientY: 100 }));
      viewport.current.handlePointerMove(pointer(element, { clientX: 102, clientY: 101 }));
    });
    expect(capture).not.toHaveBeenCalled();
    expect(element.dataset.panning).toBeUndefined();
    act(() => {
      viewport.current.handlePointerMove(pointer(element, { clientX: 60, clientY: 70 }));
    });
    expect(capture).toHaveBeenCalledWith(1);
    expect(element.dataset.panning).toBeDefined();
    expect(element.scrollLeft).toBe(40);
    expect(element.scrollTop).toBe(30);
  });

  it('stops panning when a move arrives with no button held', () => {
    const { element, release, viewport } = setup();
    act(() => {
      viewport.current.handlePointerDown(pointer(element, { clientX: 100, clientY: 100 }));
      viewport.current.handlePointerMove(pointer(element, { clientX: 60, clientY: 60 }));
      viewport.current.handlePointerMove(pointer(element, { buttons: 0, clientX: 0, clientY: 0 }));
    });
    expect(release).toHaveBeenCalledWith(1);
    expect(element.dataset.panning).toBeUndefined();
    expect(element.scrollLeft).toBe(40);
    act(() => {
      viewport.current.handlePointerMove(pointer(element, { clientX: -200, clientY: -200 }));
    });
    expect(element.scrollLeft).toBe(40);
  });

  it('ends the pan when the pointer is released or capture is lost', () => {
    const { element, viewport } = setup();
    act(() => {
      viewport.current.handlePointerDown(pointer(element, { clientX: 100, clientY: 100 }));
      viewport.current.handlePointerMove(pointer(element, { clientX: 80, clientY: 80 }));
      viewport.current.handlePointerUp(pointer(element, {}));
      viewport.current.handlePointerMove(pointer(element, { clientX: 0, clientY: 0 }));
    });
    expect(element.dataset.panning).toBeUndefined();
    expect(element.scrollLeft).toBe(20);
  });
});

it('allows a large expanded system to fit below the former 12% zoom floor', () => {
  const { result } = renderHook(() => useExplorerViewport(20_000, 5000, false));
  act(() => {
    result.current.changeZoom(0.04);
  });
  expect(result.current.zoom).toBeCloseTo(0.04);
  act(() => {
    result.current.changeZoom(1.2);
  });
  expect(result.current.zoom).toBeCloseTo(0.048);
});

it('fits when the canvas becomes visible or changes width, while preserving manual zoom', () => {
  let resize: () => void = vi.fn<() => void>();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe = vi.fn<() => void>();
      disconnect = vi.fn<() => void>();
    },
  );
  vi.stubGlobal('innerHeight', 1000);
  const element = document.createElement('div');
  let available = 0;
  vi.spyOn(element, 'clientWidth', 'get').mockImplementation(() => available);
  try {
    const { result } = renderHook(() => {
      const viewport = useExplorerViewport(2000, 1000, true);
      viewport.viewportRef.current = element;
      return viewport;
    });
    act(() => {
      resize();
      available = 800;
      resize();
    });
    expect(result.current.zoom).toBeCloseTo(0.4);
    act(() => {
      available = 600;
      resize();
    });
    expect(result.current.zoom).toBeCloseTo(0.3);
    act(() => {
      result.current.changeZoom(2);
    });
    act(() => {
      available = 400;
      resize();
    });
    expect(result.current.zoom).toBeCloseTo(0.6);
  } finally {
    vi.unstubAllGlobals();
  }
});
