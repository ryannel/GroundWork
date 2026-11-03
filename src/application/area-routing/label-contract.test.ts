import { describe, expect, it } from 'vitest';

import { diagramCaption } from '@/shared/diagram-caption';

import { captionRoute, labelPoint, lineBoxes } from './route';

describe('attached connection captions', () => {
  it('does not put a caption across another request between the text and its own segment', () => {
    const caption = diagramCaption('Read product variants');
    const points = [
      { x: 200, y: 300 },
      { x: 700, y: 300 },
    ];
    const other = lineBoxes([
      { x: 200, y: 295 },
      { x: 700, y: 295 },
    ]);
    const label = labelPoint(points, [], caption.width, true, {
      height: caption.height,
      lines: other,
    });
    expect(label.labelHidden).not.toBe(true);
    expect(label.y - 14).toBeGreaterThan(300);
  });
  it.each([false, true])(
    'keeps a two-line caption beside its horizontal segment, reversed=%s',
    (reverse) => {
      const points = [
        { x: 300, y: 300 },
        { x: 700, y: 300 },
      ];
      const { width, height } = diagramCaption('Read and refresh complete product views');
      const placed = labelPoint(
        reverse ? points.toReversed() : points,
        [{ x: 250, y: 240, width: 500, height: 45 }],
        width,
        true,
        { height, bounds: { x: 0, y: 0, width: 1000, height: 800 } },
      );
      expect(placed.labelHidden).not.toBe(true);
      expect(placed.x - width / 2).toBeGreaterThanOrEqual(300);
      expect(placed.x + width / 2).toBeLessThanOrEqual(700);
      expect(placed.y - 14 - 300).toBe(8);
    },
  );

  it('puts a vertical caption immediately alongside its line and within the owning bounds', () => {
    const { width, height } = diagramCaption('Read product variants');
    const label = labelPoint(
      [
        { x: 400, y: 200 },
        { x: 400, y: 600 },
      ],
      [],
      width,
      false,
      { height, bounds: { x: 350, y: 100, width: 400, height: 600 } },
    );
    expect(label.labelHidden).not.toBe(true);
    expect(label.x - width / 2 - 400).toBe(12);
    expect(label.y - 14).toBeGreaterThan(200);
    expect(label.y - 14 + height).toBeLessThan(600);
  });

  it('keeps the relationship when no caption can fit within a constrained frame', () => {
    const points = [
      { x: 20, y: 20 },
      { x: 80, y: 20 },
    ];
    const routed = captionRoute(points, [], {
      width: 180,
      height: 34,
      bounds: { x: 0, y: 0, width: 100, height: 50 },
    });
    expect(routed.points).toEqual(points);
    expect(routed.labelHidden).toBe(true);
    expect(routed.path).toBe('M 20,20 L 80,20');
  });
});
