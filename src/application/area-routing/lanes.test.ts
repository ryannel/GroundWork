import { describe, expect, it } from 'vitest';

import { separateLanes } from './lanes';
import { labelPoint } from './route';
import { settleRoutes } from './settle';

const route = (x: number, top: number, bottom: number) => [
  { x: 0, y: top },
  { x, y: top },
  { x, y: bottom },
  { x: 400, y: bottom },
];

describe('separateLanes', () => {
  it('gives lines that share a corridor a track each, keeping every run straight', () => {
    const routes = separateLanes([route(200, 0, 300), route(200, 100, 400)], []);
    const tracks = routes.map((points) => points[1]!.x);
    expect(new Set(tracks).size).toBe(2);
    expect(Math.abs(tracks[0]! - tracks[1]!)).toBe(14);
    for (const points of routes) {
      expect(points[1]!.x).toBe(points[2]!.x);
      expect(points[0]).toEqual({ x: 0, y: points[1]!.y });
      expect(points.at(-1)).toEqual({ x: 400, y: points[2]!.y });
    }
  });

  it('stays inside the free space between neighbouring cards', () => {
    const cards = [
      { x: 100, y: 0, width: 80, height: 500 },
      { x: 240, y: 0, width: 100, height: 500 },
    ];
    const routes = separateLanes(
      [route(200, 0, 300), route(200, 100, 400), route(200, 50, 350)],
      cards,
    );
    const tracks = routes.map((points) => points[1]!.x).toSorted((a, b) => a - b);
    expect(tracks[0]).toBeGreaterThanOrEqual(192);
    expect(tracks[2]).toBeLessThanOrEqual(228);
    expect(new Set(tracks).size).toBe(3);
  });

  it('leaves lines alone when they only share a track but not a span', () => {
    const routes = separateLanes([route(200, 0, 100), route(200, 200, 300)], []);
    expect(routes.map((points) => points[1]!.x)).toEqual([200, 200]);
  });
});

describe('settleRoutes', () => {
  it('reports exhausted space instead of detaching a label from a narrow run between tall cards', () => {
    const points = [
      { x: 440, y: 500 },
      { x: 560, y: 500 },
    ];
    const label = labelPoint(
      points,
      [
        { x: 160, y: 100, width: 280, height: 900 },
        { x: 560, y: 100, width: 280, height: 900 },
      ],
      240,
      true,
    );
    expect(label.labelHidden).toBe(true);
    expect(label).toMatchObject(points[0]!);
  });

  it('keeps a two-line label immediately beside a sufficiently wide gap', () => {
    const cards = [
      { x: 100, y: 100, width: 280, height: 104 },
      { x: 650, y: 100, width: 280, height: 104 },
    ];
    const label = labelPoint(
      [
        { x: 380, y: 148 },
        { x: 650, y: 148 },
      ],
      cards,
      180,
      true,
      { height: 34 },
    );
    expect(label.labelHidden).not.toBe(true);
    expect(label.x - 90).toBeGreaterThanOrEqual(388);
    expect(label.x + 90).toBeLessThanOrEqual(642);
    expect(Math.min(Math.abs(label.y + 20 - 148), Math.abs(label.y - 14 - 148))).toBe(8);
  });
  it('straightens a run that doubles back before drawing it', () => {
    const [settled] = settleRoutes(
      [
        {
          label: 'Reads prices',
          points: [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 300 },
            { x: 20, y: 200 },
            { x: 100, y: 200 },
          ],
        },
      ],
      [],
    );
    expect(settled?.path).not.toContain('300');
    expect(settled?.path).toMatch(/L 100,200$/u);
    expect(settled).not.toHaveProperty('points');
  });
});
