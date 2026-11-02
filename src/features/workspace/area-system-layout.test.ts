import { describe, expect, it } from 'vitest';

import { areaEdgeGeometry, layoutAreaSystems } from '@/application/area-system-layout';
import type { LandscapeSystemRelationship } from '@/domain/landscape';

const edge = (id: string, from: string, to: string): LandscapeSystemRelationship => ({
  id,
  from,
  to,
  label: id,
  kind: 'api',
  detail: id,
});

describe('area system flow layout', () => {
  it('puts sources left, transformations in the middle and consumers right', () => {
    const relationships = [
      edge('products', 'assortment', 'offers'),
      edge('terms', 'offers', 'price'),
      edge('taxes', 'tax', 'price'),
      edge('prices', 'price', 'graph'),
    ];
    const boxes = layoutAreaSystems(
      ['assortment', 'tax', 'offers', 'price', 'graph'].map((id) => ({
        id,
        width: 200,
        height: 120,
      })),
      relationships,
    );
    const x = Object.fromEntries(boxes.map((box) => [box.id, box.x]));

    expect(x.assortment).toBeLessThan(x.offers ?? 0);
    expect(x.offers).toBeLessThan(x.price ?? 0);
    expect(x.tax).toBeLessThan(x.price ?? 0);
    expect(x.price).toBeLessThan(x.graph ?? 0);
  });

  it('routes a circular dependency as a return path instead of reversing the whole flow', () => {
    const relationships = [edge('request', 'offers', 'price'), edge('answer', 'price', 'offers')];
    const boxes = layoutAreaSystems(
      [
        { id: 'offers', width: 200, height: 120 },
        { id: 'price', width: 200, height: 120 },
      ],
      relationships,
    );
    const request = areaEdgeGeometry({ edge: relationships[0]!, boxes, relationships });
    const answer = areaEdgeGeometry({ edge: relationships[1]!, boxes, relationships });

    expect(boxes[0]?.rank).not.toBe(boxes[1]?.rank);
    expect(request?.path).not.toBe(answer?.path);
    expect((answer?.y ?? 0) > Math.max(...boxes.map((box) => box.y + box.height))).toBe(true);
  });
});

const box = (id: string, x: number, y: number, width = 120, height = 80, rank = 0) => ({
  id,
  x,
  y,
  width,
  height,
  rank,
});

function samples(path: string) {
  let current = { x: 0, y: 0 };
  return [...path.matchAll(/([MLQ]) ([\d., -]+)/gu)].flatMap((match) => {
    const numbers = match[2]!.trim().split(/[ ,]+/u).map(Number);
    const end = { x: numbers.at(-2)!, y: numbers.at(-1)! };
    const start = current;
    current = end;
    if (match[1] === 'M') return [end];
    return Array.from({ length: 21 }, (_, index) => {
      const t = index / 20;
      if (match[1] !== 'Q') {
        return {
          x: start.x + (end.x - start.x) * t,
          y: start.y + (end.y - start.y) * t,
        };
      }
      return {
        x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * numbers[0]! + t ** 2 * end.x,
        y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * numbers[1]! + t ** 2 * end.y,
      };
    });
  });
}

describe('area connection routing', () => {
  it('uses canvas positions rather than incompatible local ranks', () => {
    const relationship = edge('cross-system', 'component', 'system');
    const geometry = areaEdgeGeometry({
      edge: relationship,
      relationships: [relationship],
      boxes: [box('component', 400, 60, 120, 80, 9), box('system', 800, 60)],
    });
    expect(geometry?.path).toMatch(/^M 520,100/u);
    expect(geometry?.path).toMatch(/L 800,100$/u);
  });

  it('routes past an intervening node while ignoring the containing system boundary', () => {
    const relationship = edge('through', 'source', 'target');
    const obstruction = box('unrelated', 340, 20, 120, 260);
    const geometry = areaEdgeGeometry({
      edge: relationship,
      relationships: [relationship],
      boxes: [
        box('boundary', 0, 0, 1000, 600),
        box('source', 24, 100),
        obstruction,
        box('target', 680, 100),
      ],
    });
    expect(geometry).not.toBeNull();
    const crossesNode = samples(geometry!.path).some(
      (point) =>
        point.x > obstruction.x &&
        point.x < obstruction.x + obstruction.width &&
        point.y > obstruction.y &&
        point.y < obstruction.y + obstruction.height,
    );
    expect(crossesNode).toBe(false);
    expect(geometry!.y).toBeLessThan(600);
  });

  it('reserves different local lanes for reciprocal calls', () => {
    const relationships = [
      edge('return-a', 'right', 'left'),
      edge('return-b', 'right', 'left'),
      edge('forward', 'left', 'right'),
    ];
    const boxes = [box('left', 60, 40), box('right', 500, 40), box('lower', 280, 200)];
    const first = areaEdgeGeometry({ edge: relationships[0]!, relationships, boxes });
    const second = areaEdgeGeometry({ edge: relationships[1]!, relationships, boxes });
    expect(first?.y).toBeGreaterThan(120);
    expect(second?.y).toBeLessThan(280);
    expect(second?.y).toBeGreaterThan(first?.y ?? 0);
    expect(first?.path).not.toBe(second?.path);
  });

  it('keeps an exact endpoint port y and ignores its containing component', () => {
    const relationship = edge('endpoint', 'caller', 'port');
    const geometry = areaEdgeGeometry({
      edge: relationship,
      relationships: [relationship],
      boxes: [
        box('caller', 20, 30),
        box('component', 450, 20, 360, 250),
        box('port', 450, 139, 360, 0),
      ],
    });
    expect(geometry?.path).toMatch(/L 450,139$/u);
  });
  it('keeps a short connection inside a narrow gap', () => {
    const relationship = edge('narrow', 'left', 'right');
    const geometry = areaEdgeGeometry({
      edge: relationship,
      relationships: [relationship],
      boxes: [box('left', 20, 30), box('right', 164, 30)],
    });
    expect(geometry).not.toBeNull();
    const points = samples(geometry!.path);
    expect(Math.min(...points.map((point) => point.x))).toBeGreaterThanOrEqual(140);
    expect(Math.max(...points.map((point) => point.x))).toBeLessThanOrEqual(164);
  });

  it('takes a self-loop around the component instead of crossing its body', () => {
    const relationship = edge('loop', 'component', 'component');
    const component = box('component', 300, 140);
    const geometry = areaEdgeGeometry({
      edge: relationship,
      relationships: [relationship],
      boxes: [component],
    });
    expect(geometry).not.toBeNull();
    const crossesNode = samples(geometry!.path).some(
      (point) => point.x > 300 && point.x < 420 && point.y > 140 && point.y < 220,
    );
    expect(crossesNode).toBe(false);
  });
  it('mirrors an ordinary leftward call without a bottom return lane', () => {
    const relationship = edge('leftward', 'right', 'left');
    const geometry = areaEdgeGeometry({
      edge: relationship,
      relationships: [relationship],
      boxes: [box('left', 60, 40), box('right', 500, 40), box('unrelated-bottom', 260, 900)],
    });
    expect(geometry?.path).toMatch(/^M 500,80/u);
    expect(geometry?.path).toMatch(/L 180,80$/u);
    expect(Math.max(...samples(geometry!.path).map((point) => point.y))).toBe(80);
  });

  it('places a long label in the vertical corridor instead of over the source', () => {
    const relationship = {
      ...edge('turn', 'source', 'target'),
      label: 'Products and offer variants',
    };
    const source = box('source', 60, 40);
    const geometry = areaEdgeGeometry({
      edge: relationship,
      relationships: [relationship],
      boxes: [source, box('target', 330, 320)],
    });
    expect(geometry).not.toBeNull();
    const labelOverSource =
      geometry!.x - 95 < 180 && geometry!.x + 95 > 60 && geometry!.y > 40 && geometry!.y < 120;
    expect(labelOverSource).toBe(false);
  });
});
