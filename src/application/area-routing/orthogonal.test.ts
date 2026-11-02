import { describe, expect, it } from 'vitest';

import {
  clearRouteSegment,
  orthogonalRoute,
  simplifyRoute,
  type RouteBox,
  type RoutePoint,
  type RoutePort,
} from './orthogonal';

const bounds = { x: 0, y: 0, width: 1000, height: 900 };

function ports(box: RouteBox): readonly RoutePort[] {
  const { x, y, width, height } = box;
  return [
    {
      point: { x: x + width, y: y + height / 2 },
      exit: { x: x + width + 16, y: y + height / 2 },
      direction: 0,
    },
    {
      point: { x: x + width / 2, y: y + height },
      exit: { x: x + width / 2, y: y + height + 16 },
      direction: 1,
    },
    { point: { x, y: y + height / 2 }, exit: { x: x - 16, y: y + height / 2 }, direction: 2 },
    { point: { x: x + width / 2, y }, exit: { x: x + width / 2, y: y - 16 }, direction: 3 },
  ];
}

/** Check final geometry, including attachment stubs, rather than only the searched middle. */
function expectClear(points: readonly RoutePoint[], boxes: readonly RouteBox[]): void {
  expect(points.length).toBeGreaterThanOrEqual(2);
  for (const [index, point] of points.entries()) {
    expect(point.x).toBeGreaterThanOrEqual(bounds.x);
    expect(point.x).toBeLessThanOrEqual(bounds.width);
    expect(point.y).toBeGreaterThanOrEqual(bounds.y);
    expect(point.y).toBeLessThanOrEqual(bounds.height);
    const previous = points[index - 1];
    if (previous === undefined) continue;
    expect(point).not.toEqual(previous);
    expect(point.x === previous.x || point.y === previous.y).toBe(true);
    expect(clearRouteSegment(previous, point, boxes)).toBe(true);
    const before = points[index - 2];
    if (before !== undefined) {
      const dot =
        (previous.x - before.x) * (point.x - previous.x) +
        (previous.y - before.y) * (point.y - previous.y);
      expect(dot).toBeGreaterThanOrEqual(0);
    }
  }
}

describe('orthogonal routing', () => {
  it('connects vertically adjacent cards through their facing ports without a return loop', () => {
    const source = { x: 100, y: 100, width: 120, height: 80 };
    const receiver = { ...source, y: 300 };
    const boxes = [source, receiver];
    const route = orthogonalRoute(ports(source), ports(receiver), { boxes, bounds, lines: [] });
    expect(route).toEqual([
      { x: 160, y: 180 },
      { x: 160, y: 300 },
    ]);
    expectClear(route, boxes);
  });

  it('tries another card side when the nearest outward stub is blocked', () => {
    const source = { x: 100, y: 100, width: 100, height: 100 };
    const receiver = { ...source, x: 400 };
    const blocker = { x: 204, y: 130, width: 8, height: 40 };
    const boxes = [source, receiver, blocker];
    const route = orthogonalRoute(ports(source), ports(receiver), { boxes, bounds, lines: [] });
    expectClear(route, boxes);
    expect(route[0]).not.toEqual({ x: 200, y: 150 });
  });

  it('keeps reciprocal connections distinguishable and respects both endpoint interiors', () => {
    const source = { x: 100, y: 200, width: 120, height: 80 };
    const receiver = { ...source, x: 440 };
    const boxes = [source, receiver];
    const forward = orthogonalRoute(ports(source), ports(receiver), { boxes, bounds, lines: [] });
    const reverse = orthogonalRoute(ports(receiver), ports(source), {
      boxes,
      bounds,
      lines: [{ points: forward }],
    });
    expectClear(forward, boxes);
    expectClear(reverse, boxes);
    expect(reverse).not.toEqual(forward.toReversed());
  });

  it('reserves distinct corridors for fan-out without shifting a completed route into cards', () => {
    const source = { x: 100, y: 300, width: 120, height: 100 };
    const receivers = [100, 300, 500].map((y) => ({ x: 500, y, width: 120, height: 100 }));
    const boxes = [source, ...receivers];
    const lines: { points: readonly RoutePoint[] }[] = [];
    for (const receiver of receivers) {
      const points = orthogonalRoute(ports(source), ports(receiver), { boxes, bounds, lines });
      expectClear(points, boxes);
      lines.push({ points });
    }
    expect(new Set(lines.map((line) => JSON.stringify(line.points[0]))).size).toBe(
      receivers.length,
    );
    expect(lines.every((line) => line.points.length <= 4)).toBe(true);
  });

  it('searches an alternating obstacle corridor that requires several bends', () => {
    const source = { x: 80, y: 80, width: 100, height: 80 };
    const receiver = { x: 760, y: 680, width: 100, height: 80 };
    const boxes = [
      source,
      receiver,
      { x: 260, y: -10, width: 80, height: 450 },
      { x: 460, y: 300, width: 80, height: 620 },
    ];
    const route = orthogonalRoute(ports(source), ports(receiver), { boxes, bounds, lines: [] });
    expectClear(route, boxes);
    expect(route.length).toBeGreaterThan(4);
  });

  it('keeps the fallback grid independent of hundreds of unrelated reserved lines', () => {
    const source = { x: 80, y: 80, width: 100, height: 80 };
    const receiver = { x: 760, y: 680, width: 100, height: 80 };
    const boxes = [
      source,
      receiver,
      { x: 260, y: -10, width: 80, height: 450 },
      { x: 460, y: 300, width: 80, height: 620 },
    ];
    const lines = Array.from({ length: 300 }, (_, index) => ({
      points: [
        { x: 600.25, y: 10.25 + index * 0.4 },
        { x: 900.25, y: 10.25 + index * 0.4 },
      ],
    }));
    const empty = orthogonalRoute(ports(source), ports(receiver), { boxes, bounds, lines: [] });
    const busy = orthogonalRoute(ports(source), ports(receiver), { boxes, bounds, lines });
    expectClear(busy, boxes);
    expect(busy).toEqual(empty);
  });

  it('returns no route rather than crossing a completely enclosed receiver', () => {
    const source = { x: 100, y: 100, width: 100, height: 100 };
    const receiver = { x: 500, y: 400, width: 100, height: 100 };
    const wall = { x: 490, y: 390, width: 120, height: 120 };
    expect(
      orthogonalRoute(ports(source), ports(receiver), {
        boxes: [source, receiver, wall],
        bounds,
        lines: [],
      }),
    ).toEqual([]);
  });

  it('is deterministic for the same geometry and existing traffic', () => {
    const source = { x: 100, y: 100, width: 100, height: 100 };
    const receiver = { x: 500, y: 400, width: 100, height: 100 };
    const space = { boxes: [source, receiver], bounds, lines: [] };
    expect(orthogonalRoute(ports(source), ports(receiver), space)).toEqual(
      orthogonalRoute(ports(source), ports(receiver), space),
    );
  });

  it('rejects diagonal segments and preserves reversals when simplifying', () => {
    expect(clearRouteSegment({ x: 0, y: 0 }, { x: 20, y: 20 }, [])).toBe(false);
    const reversal = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(simplifyRoute(reversal)).toEqual(reversal);
    expect(
      simplifyRoute([
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
      ]),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ]);
  });
});
