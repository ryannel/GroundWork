// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ConnectedCanvasFocus } from './connected-canvas-types';
import { useCanvasFocus } from './use-canvas-focus';

function viewport() {
  const element = document.createElement('div');
  Object.defineProperties(element, {
    clientWidth: { value: 1000 },
    clientHeight: { value: 600 },
  });
  const scrollTo = vi.fn<(options?: ScrollToOptions) => void>();
  element.scrollTo = (options?: ScrollToOptions | number) => {
    if (typeof options !== 'number') scrollTo(options);
  };
  return { current: element, scrollTo };
}

describe('canvas focus', () => {
  const focus: ConnectedCanvasFocus = {
    id: 'offers',
    x: 400,
    y: 300,
    width: 900,
    height: 700,
    readable: true,
  };

  it('opens a system at reading size before centring it', () => {
    const ref = viewport();
    const changeZoom = vi.fn<(factor: number) => void>();
    const { rerender } = renderHook(
      ({ zoom }) => ({ reveal: useCanvasFocus(focus, ref, { zoom, changeZoom }) }),
      {
        initialProps: { zoom: 0.7 },
      },
    );
    expect(changeZoom).toHaveBeenCalledWith(1 / 0.7);
    expect(ref.scrollTo).not.toHaveBeenCalled();
    rerender({ zoom: 1 });
    expect(ref.scrollTo).toHaveBeenCalledWith({ left: 350, top: 276, behavior: 'auto' });
  });

  it('keeps the top left of an oversized boundary visible rather than centring off-screen', () => {
    const ref = viewport();
    const changeZoom = vi.fn<(factor: number) => void>();
    renderHook(() => ({
      reveal: useCanvasFocus({ ...focus, width: 1500 }, ref, { zoom: 0.85, changeZoom }),
    }));
    expect(changeZoom).not.toHaveBeenCalled();
    expect(ref.scrollTo).toHaveBeenCalledWith({ left: 316, top: 231, behavior: 'auto' });
  });

  it('leaves manual zoom and pan alone after revealing the same system', () => {
    const ref = viewport();
    const changeZoom = vi.fn<(factor: number) => void>();
    const { rerender } = renderHook(
      ({ zoom }) => ({ reveal: useCanvasFocus(focus, ref, { zoom, changeZoom }) }),
      {
        initialProps: { zoom: 1 },
      },
    );
    expect(ref.scrollTo).toHaveBeenCalledTimes(1);
    rerender({ zoom: 0.7 });
    expect(ref.scrollTo).toHaveBeenCalledTimes(1);
    expect(changeZoom).not.toHaveBeenCalled();
  });

  it('follows the same system when the layout moves it instead of centring it again', () => {
    const ref = viewport();
    const changeZoom = vi.fn<(factor: number) => void>();
    const { rerender } = renderHook(
      ({ x }) => ({ reveal: useCanvasFocus({ ...focus, x }, ref, { zoom: 1, changeZoom }) }),
      { initialProps: { x: 400 } },
    );
    ref.current.scrollLeft = 350;
    rerender({ x: 520 });
    expect(ref.scrollTo).toHaveBeenCalledTimes(1);
    expect(ref.current.scrollLeft).toBe(470);
  });

  it('allows the reader to focus the selection again without changing zoom', () => {
    const ref = viewport();
    const changeZoom = vi.fn<(factor: number) => void>();
    const { result } = renderHook(() => ({
      reveal: useCanvasFocus({ ...focus, readable: false }, ref, { zoom: 0.7, changeZoom }),
    }));
    act(() => {
      result.current.reveal();
    });
    expect(ref.scrollTo).toHaveBeenCalledTimes(2);
    expect(changeZoom).not.toHaveBeenCalled();
  });
});

it('reveals an incoming flow once and keeps the page still when switching flows', () => {
  const ref = viewport();
  const surface = document.createElement('div');
  const scrollIntoView = vi.fn<(options?: boolean | ScrollIntoViewOptions) => void>();
  surface.scrollIntoView = scrollIntoView;
  surface.append(ref.current);
  const changeZoom = vi.fn<(factor: number) => void>();
  const initialProps: { readonly id: string | null } = { id: 'flow:prepare' };
  const { rerender } = renderHook(
    ({ id }: { readonly id: string | null }) =>
      useCanvasFocus(
        id === null ? null : { id, x: 400, y: 200, width: 600, height: 300, revealViewport: true },
        ref,
        {
          zoom: 1,
          changeZoom,
        },
      ),
    { initialProps },
  );
  expect(scrollIntoView).toHaveBeenCalledTimes(1);
  rerender({ id: 'flow:read' });
  rerender({ id: null });
  rerender({ id: 'flow:prepare' });
  expect(scrollIntoView).toHaveBeenCalledTimes(1);
  expect(ref.scrollTo).toHaveBeenCalledTimes(3);
});

it('frames a selected flow consistently after a distant overview and retains later manual zoom', () => {
  const ref = viewport();
  const changeZoom = vi.fn<(factor: number) => void>();
  const focus = {
    id: 'flow:models',
    x: 1000,
    y: 150,
    width: 1300,
    height: 650,
    fit: true,
    maximumZoom: 1,
  };
  const target = Math.min(904 / 1300, 504 / 650);
  const { rerender } = renderHook(({ zoom }) => useCanvasFocus(focus, ref, { zoom, changeZoom }), {
    initialProps: { zoom: 0.2 },
  });
  expect(changeZoom).toHaveBeenCalledWith(target / 0.2);
  rerender({ zoom: target });
  expect(ref.scrollTo).toHaveBeenCalledTimes(1);
  rerender({ zoom: 0.9 });
  expect(changeZoom).toHaveBeenCalledTimes(1);
});

describe('opening a complete system', () => {
  it.each([
    { width: 5000, height: 1000, target: 904 / 5000 },
    { width: 1200, height: 5000, target: 504 / 5000 },
    { width: 20_000, height: 1000, target: 904 / 20_000 },
  ])('fits both dimensions of a $width by $height boundary', ({ width, height, target }) => {
    const ref = viewport();
    const changeZoom = vi.fn<(factor: number) => void>();
    const focus = { id: 'open:price', x: 800, y: 500, width, height, fit: true };
    const { rerender } = renderHook(
      ({ zoom }) => useCanvasFocus(focus, ref, { zoom, changeZoom }),
      { initialProps: { zoom: 0.85 } },
    );
    expect(changeZoom).toHaveBeenCalledWith(target / 0.85);
    expect(ref.scrollTo).not.toHaveBeenCalled();
    rerender({ zoom: target });
    const scroll = ref.scrollTo.mock.lastCall?.[0];
    const left = focus.x * target - (scroll?.left ?? 0);
    const top = focus.y * target - (scroll?.top ?? 0);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(left + width * target).toBeLessThanOrEqual(ref.current.clientWidth);
    expect(top + height * target).toBeLessThanOrEqual(ref.current.clientHeight);
    // The reader can then zoom into part of that system without the camera fitting it again.
    rerender({ zoom: 0.9 });
    expect(changeZoom).toHaveBeenCalledTimes(1);
    expect(ref.scrollTo).toHaveBeenCalledTimes(1);
  });

  it('preserves a wider view when the complete system already fits', () => {
    const ref = viewport();
    const changeZoom = vi.fn<(factor: number) => void>();
    renderHook(() =>
      useCanvasFocus(
        { id: 'open:tax', x: 400, y: 300, width: 1500, height: 1000, fit: true },
        ref,
        { zoom: 0.2, changeZoom },
      ),
    );
    expect(changeZoom).not.toHaveBeenCalled();
    expect(ref.scrollTo).toHaveBeenCalledTimes(1);
  });
});

it('fits the part of the canvas actually visible below the page controls', () => {
  const ref = viewport();
  ref.current.getBoundingClientRect = () => new DOMRect(0, window.innerHeight - 250, 1000, 600);
  const changeZoom = vi.fn<(factor: number) => void>();
  renderHook(() =>
    useCanvasFocus(
      { id: 'open:price', x: 400, y: 300, width: 1200, height: 1000, fit: true },
      ref,
      { zoom: 1, changeZoom },
    ),
  );
  expect(changeZoom).toHaveBeenCalledWith((250 - 24 - 96) / 1000);
});

it('opens a large system at readable scale even after a distant Fit map view', () => {
  const ref = viewport();
  const changeZoom = vi.fn<(factor: number) => void>();
  const focus = {
    id: 'open:large',
    x: 80,
    y: 146,
    width: 5000,
    height: 3000,
    fit: true,
    minimumZoom: 0.85,
  };
  const { rerender } = renderHook(({ zoom }) => useCanvasFocus(focus, ref, { zoom, changeZoom }), {
    initialProps: { zoom: 0.23 },
  });
  expect(changeZoom).toHaveBeenCalledWith(0.85 / 0.23);
  rerender({ zoom: 0.85 });
  expect(ref.scrollTo).toHaveBeenCalledTimes(1);
  rerender({ zoom: 0.4 });
  expect(changeZoom).toHaveBeenCalledTimes(1);
  expect(ref.scrollTo).toHaveBeenCalledTimes(1);
});
