import { diagramCaption } from '@/shared/diagram-caption';

import { type LaneObstacle, type LanePoint, separateLanes } from './lanes';
import { captionRoute, lineBoxes } from './route';

interface SettlingRoute {
  readonly label: string;
  readonly labelAtEnd?: boolean;
  readonly points: readonly LanePoint[];
}

function inLine(a: LanePoint, b: LanePoint, c: LanePoint): boolean {
  return (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);
}

/** Drop corners that do not turn, including a run that doubles back over itself. */
function straightened(points: readonly LanePoint[]): readonly LanePoint[] {
  return points.reduce<readonly LanePoint[]>((kept, point) => {
    const last = kept.at(-1);
    const before = kept.at(-2);
    if (last?.x === point.x && last.y === point.y) return kept;
    if (last !== undefined && before !== undefined && inLine(before, last, point)) {
      return [...kept.slice(0, -1), point];
    }
    return [...kept, point];
  }, []);
}

/**
 * Spread lines that share a corridor into their own lanes, then redraw each one and place its label
 * clear of the cards and of the labels placed before it.
 */
export function settleRoutes<T extends SettlingRoute>(
  routes: readonly T[],
  obstacles: readonly LaneObstacle[],
): readonly (Omit<T, 'points'> & {
  readonly path: string;
  readonly x: number;
  readonly y: number;
  readonly labelHidden?: boolean;
})[] {
  const lanes = separateLanes(
    routes.map((route) => straightened(route.points)),
    obstacles,
  );
  const labels: LaneObstacle[] = [];
  return routes.map(({ points: original, ...route }, index) => {
    const points = lanes[index] ?? original;
    const { width, height } = diagramCaption(route.label);
    const otherLines = lanes.flatMap((line, other) => (other === index ? [] : lineBoxes(line)));
    const label = captionRoute(points, [...obstacles, ...labels], {
      width,
      height,
      lines: otherLines,
      preferEnd: route.labelAtEnd === true,
    });
    if (label.labelHidden !== true) {
      labels.push({ x: label.x - width / 2, y: label.y - 14, width, height });
    }
    return {
      ...route,
      path: label.path,
      x: label.x,
      y: label.y,
      ...(label.labelHidden === true ? { labelHidden: true } : {}),
    };
  });
}
