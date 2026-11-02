// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { useLayoutEffect, useState } from 'react';
import { describe, expect, it } from 'vitest';

import { useCanvasPinch } from './use-canvas-pinch';

function setup(width = 1000) {
  const element = document.createElement('div');
  const drawing = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  element.append(drawing);
  Object.defineProperties(element, {
    clientWidth: { value: 600 },
    clientHeight: { value: 400 },
  });
  element.getBoundingClientRect = () => new DOMRect(20, 30, 600, 400);
  drawing.getBoundingClientRect = () =>
    new DOMRect(0, 0, Number(drawing.getAttribute('width')), 800);
  const ref = { current: element };
  const hook = renderHook(() => {
    const [zoom, setZoom] = useState(1);
    useLayoutEffect(() => {
      drawing.setAttribute('width', String(width * zoom));
    }, [zoom]);
    useCanvasPinch(ref, {
      zoom,
      changeZoom: (factor) => {
        setZoom((current) => Math.max(0.01, Math.min(2, current * factor)));
      },
    });
    return zoom;
  });
  return { element, ...hook };
}

function wheel(deltaY: number, ctrlKey = true): WheelEvent {
  const event = new WheelEvent('wheel', {
    deltaY,
    ctrlKey,
    clientX: 220,
    clientY: 180,
    cancelable: true,
  });
  // happy-dom's WheelEvent does not yet inherit MouseEvent's coordinates or modifiers.
  Object.defineProperties(event, {
    ctrlKey: { value: ctrlKey },
    clientX: { value: 220 },
    clientY: { value: 180 },
  });
  return event;
}

function gesture(type: string, scale: number): Event {
  const event = new Event(type, { cancelable: true });
  Object.defineProperties(event, {
    scale: { value: scale },
    clientX: { value: 220 },
    clientY: { value: 180 },
  });
  return event;
}

function touch(type: string, distance: number): TouchEvent {
  const touches =
    distance <= 0
      ? []
      : [
          new Touch({
            identifier: 1,
            target: document.body,
            clientX: 220 - distance / 2,
            clientY: 180,
          }),
          new Touch({
            identifier: 2,
            target: document.body,
            clientX: 220 + distance / 2,
            clientY: 180,
          }),
        ];
  return new TouchEvent(type, { touches, cancelable: true });
}

describe('canvas pinch zoom', () => {
  it('zooms at the cursor without zooming the page', () => {
    const { element, result } = setup();
    element.scrollLeft = 100;
    element.scrollTop = 50;
    const event = wheel(-Math.log(1.5) * 100);
    act(() => {
      element.dispatchEvent(event);
    });
    expect(result.current).toBeCloseTo(1.5);
    expect(element.scrollLeft).toBeCloseTo(250);
    expect(element.scrollTop).toBeCloseTo(150);
    expect(event.defaultPrevented).toBe(true);
  });

  it('accounts for the centred drawing when it becomes wider than the viewport', () => {
    const { element, result } = setup(400);
    act(() => {
      element.dispatchEvent(wheel(-Math.log(2) * 100));
    });
    expect(result.current).toBe(2);
    expect(element.scrollLeft).toBeCloseTo(0);
    expect(element.scrollTop).toBeCloseTo(150);
  });

  it('leaves ordinary scrolling untouched', () => {
    const { element, result } = setup();
    const event = wheel(-40, false);
    act(() => {
      element.dispatchEvent(event);
    });
    expect(result.current).toBe(1);
    expect(event.defaultPrevented).toBe(false);
  });

  it('clamps both ends of the zoom range', () => {
    const { element, result } = setup();
    act(() => {
      element.dispatchEvent(wheel(-1000));
    });
    expect(result.current).toBe(2);
    act(() => {
      element.dispatchEvent(wheel(1000));
    });
    expect(result.current).toBeCloseTo(0.01);
  });

  it('accumulates rapid wheel events before React renders', () => {
    const { element, result } = setup();
    act(() => {
      element.dispatchEvent(wheel(-Math.log(1.2) * 100));
      element.dispatchEvent(wheel(-Math.log(1.2) * 100));
    });
    expect(result.current).toBeCloseTo(1.44);
    expect(element.scrollLeft).toBeCloseTo(88);
  });

  it('does not retain an old anchor when pinching beyond a zoom limit', () => {
    const { element, result } = setup();
    act(() => {
      element.dispatchEvent(wheel(-1000));
    });
    element.scrollLeft = 300;
    act(() => {
      element.dispatchEvent(wheel(-20));
    });
    element.scrollLeft = 400;
    act(() => {
      element.dispatchEvent(wheel(Math.log(2) * 100));
    });
    expect(result.current).toBeCloseTo(1);
    expect(element.scrollLeft).toBeCloseTo(100);
  });

  it('keeps single-finger touch available for native scrolling', () => {
    const { element, result } = setup();
    const event = new TouchEvent('touchstart', {
      cancelable: true,
      touches: [new Touch({ identifier: 1, target: element, clientX: 200, clientY: 100 })],
    });
    act(() => {
      element.dispatchEvent(event);
    });
    expect(result.current).toBe(1);
    expect(event.defaultPrevented).toBe(false);
  });

  it('supports Safari gestures without counting duplicate wheel events', () => {
    const { element, result } = setup();
    act(() => {
      element.dispatchEvent(gesture('gesturestart', 1));
      element.dispatchEvent(gesture('gesturechange', 1.5));
      element.dispatchEvent(wheel(-30));
    });
    expect(result.current).toBe(1.5);
    act(() => {
      element.dispatchEvent(gesture('gestureend', 1.5));
      element.dispatchEvent(wheel(Math.log(1.5) * 100));
    });
    expect(result.current).toBeCloseTo(1);
  });

  it('supports two-finger touch pinch and resets after the fingers lift', () => {
    const { element, result } = setup();
    const move = touch('touchmove', 150);
    act(() => {
      element.dispatchEvent(touch('touchstart', 100));
      element.dispatchEvent(move);
    });
    expect(result.current).toBe(1.5);
    expect(move.defaultPrevented).toBe(true);
    act(() => {
      element.dispatchEvent(touch('touchend', 0));
      element.dispatchEvent(touch('touchstart', 200));
      element.dispatchEvent(touch('touchmove', 100));
    });
    expect(result.current).toBe(0.75);
  });

  it('removes gesture listeners on unmount', () => {
    const { element, unmount } = setup();
    unmount();
    const event = wheel(-30);
    element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
