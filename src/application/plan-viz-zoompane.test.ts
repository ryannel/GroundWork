import { describe, expect, it } from 'vitest';

import {
  frameDiagram,
  isPartial,
  panned,
  scrollCue,
  stepScale,
  wheelScale,
  zoomAbout,
  zoomKey,
  zoomPercent,
  ZOOM_MAX,
  ZOOM_MIN,
} from './plan-viz-zoompane';

const view = { s: 1, x: 100, y: 50, fit: true, focus: false };

describe('frameDiagram', () => {
  it('frames the whole drawing centred, never larger than 125%', () => {
    const framed = frameDiagram({ w: 400, h: 200, vw: 1200, vh: 800 });
    expect(framed).toMatchObject({ s: 1.25, fit: true, focus: false });
    expect(framed.x).toBeCloseTo((1200 - 500) / 2);
  });

  it('shrinks a large drawing to fit, down to the minimum fit', () => {
    expect(frameDiagram({ w: 2000, h: 500, vw: 1000, vh: 600 }).s).toBeCloseTo(952 / 2000);
    expect(frameDiagram({ w: 2000, h: 500, vw: 1000, vh: 600, minFit: 0.6 }).s).toBeCloseTo(0.6);
  });

  it('frames the selection when asked, and at a readable scale', () => {
    const bounds = { x: 1000, y: 100, w: 300, h: 100 };
    const framed = frameDiagram({
      w: 2000,
      h: 500,
      vw: 800,
      vh: 500,
      bounds,
      focus: true,
      readable: 0.75,
    });
    expect(framed).toMatchObject({ fit: false, focus: true });
    expect(framed.s).toBeGreaterThanOrEqual(0.75);
    expect(framed.x + 1150 * framed.s).toBeCloseTo(400, 0);
  });

  it('falls back to the whole drawing with nothing selected', () => {
    expect(frameDiagram({ w: 400, h: 200, vw: 800, vh: 500, focus: true }).fit).toBe(true);
  });

  it('centres a selection whose drawing is smaller than the panel', () => {
    const framed = frameDiagram({
      w: 300,
      h: 100,
      vw: 800,
      vh: 500,
      bounds: { x: 0, y: 0, w: 300, h: 100 },
      focus: true,
    });
    expect(framed.x).toBeCloseTo((800 - 300 * framed.s) / 2);
  });
});

describe('zoom steps', () => {
  it('zooms about a point so it stays put', () => {
    const next = zoomAbout(view, 2, { x: 300, y: 150 });
    expect(next).toMatchObject({ s: 2, fit: false, focus: false });
    expect(300 - (300 - next.x) / 2).toBeCloseTo(300 - (300 - view.x));
  });

  it('keeps the scale within the limits', () => {
    expect(zoomAbout(view, 99, { x: 0, y: 0 }).s).toBe(ZOOM_MAX);
    expect(zoomAbout(view, 0.001, { x: 0, y: 0 }).s).toBe(ZOOM_MIN);
  });

  it('turns a wheel into a capped zoom', () => {
    expect(wheelScale(view, 0, false)).toBe(1);
    expect(wheelScale(view, -1000, false)).toBeLessThan(2);
    expect(wheelScale(view, -1000, false)).toBeGreaterThan(wheelScale(view, -10, false));
    expect(wheelScale(view, 5, true)).toBeLessThan(1);
  });

  it('steps in, out and back to actual size', () => {
    expect(stepScale(view, 'in')).toBe(1.25);
    expect(stepScale(view, 'out')).toBeCloseTo(0.8);
    expect(stepScale({ ...view, s: 2 }, 'reset')).toBe(1);
  });

  it('marks a moved view as neither fitted nor focused', () => {
    expect(panned(view, 1, 2)).toEqual({ s: 1, x: 1, y: 2, fit: false, focus: false });
  });
});

describe('isPartial', () => {
  const panel = { vw: 800, vh: 500 };
  it('is false when the whole drawing is in sight', () => {
    expect(isPartial({ ...view, x: 10, y: 10 }, { w: 400, h: 200 }, panel)).toBe(false);
  });
  it('is true when an edge is out of sight', () => {
    expect(isPartial({ ...view, x: -50 }, { w: 400, h: 200 }, panel)).toBe(true);
    expect(isPartial({ ...view, x: 700 }, { w: 400, h: 200 }, panel)).toBe(true);
  });
});

describe('labels and keys', () => {
  it('reads the zoom as a percentage', () => {
    expect(zoomPercent({ ...view, s: 0.756 })).toBe('76%');
    expect(zoomPercent(null)).toBe('100%');
  });

  it('maps keys to commands', () => {
    expect(zoomKey('+')).toBe('in');
    expect(zoomKey('-')).toBe('out');
    expect(zoomKey('0')).toBe('fit');
    expect(zoomKey('1')).toBe('reset');
    expect(zoomKey('F')).toBe('focus');
    expect(zoomKey('x')).toBeNull();
  });
});

describe('scrollCue', () => {
  it('has nothing to say when everything fits', () => {
    expect(scrollCue({ scrollLeft: 0, scrollWidth: 500, clientWidth: 500 })).toEqual({
      more: false,
      left: false,
      right: false,
    });
  });
  it('says which edges have more behind them', () => {
    expect(scrollCue({ scrollLeft: 0, scrollWidth: 900, clientWidth: 500 })).toEqual({
      more: true,
      left: false,
      right: true,
    });
    expect(scrollCue({ scrollLeft: 200, scrollWidth: 900, clientWidth: 500 })).toMatchObject({
      left: true,
      right: true,
    });
    expect(scrollCue({ scrollLeft: 400, scrollWidth: 900, clientWidth: 500 })).toMatchObject({
      left: true,
      right: false,
    });
  });
});
