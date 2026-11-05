import { describe, expect, it } from 'vitest';

import { acme } from '@/../test/workspace-kit';
import type { AuthoredLandscape, LandscapeRelationship } from '@/domain/landscape';
import { diagramCaption } from '@/shared/diagram-caption';

import { areaLandscapeOf } from './workspace-landscape-areas';

function landscape(
  ids: readonly string[],
  relationships: readonly LandscapeRelationship[],
): AuthoredLandscape {
  return {
    label: 'Inferred',
    reviewed: '2026-10-26',
    scope: 'Mapped activity.',
    limitation: 'Partial evidence.',
    areas: ids.map((id) => ({
      id,
      name: id,
      purpose: id,
      activities: [],
      boundary: '',
      confidence: 'medium',
      evidenceCount: 1,
    })),
    relationships,
    details: [],
  };
}

function edge(
  from: string,
  to: string,
  kind: LandscapeRelationship['kind'] = 'exchange',
): LandscapeRelationship {
  return { id: `${from}-${to}`, from, to, label: `${from} information for ${to}`, kind };
}

function samples(path: string) {
  let current = { x: 0, y: 0 };
  return [...path.matchAll(/([MLQ]) ([\d., -]+)/gu)].flatMap((match) => {
    const values = match[2]!.trim().split(/[ ,]+/u).map(Number);
    const end = { x: values.at(-2)!, y: values.at(-1)! };
    const start = current;
    current = end;
    if (match[1] === 'M') return [end];
    return Array.from({ length: 41 }, (_, index) => {
      const t = index / 40;
      return match[1] === 'Q'
        ? {
            x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * values[0]! + t ** 2 * end.x,
            y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * values[1]! + t ** 2 * end.y,
          }
        : {
            x: start.x + (end.x - start.x) * t,
            y: start.y + (end.y - start.y) * t,
          };
    });
  });
}

describe('authored landscape layout', () => {
  const { workspace } = acme();

  it('derives left-to-right columns from relationships rather than area order', () => {
    const view = areaLandscapeOf(
      workspace,
      landscape(
        ['delivery', 'price', 'products', 'buy', 'browse'],
        [
          edge('products', 'price'),
          edge('price', 'browse'),
          edge('browse', 'buy', 'transition'),
          edge('buy', 'delivery', 'transition'),
        ],
      ),
    );
    expect(view.nodes.map((node) => node.id)).toEqual([
      'products',
      'price',
      'browse',
      'buy',
      'delivery',
    ]);
    expect(view.width).toBeGreaterThan(view.height);
    expect(
      view.nodes.every((node, index) => index === 0 || node.x > view.nodes[index - 1]!.x),
    ).toBe(true);
    expect(view.edges.map((relationship) => [relationship.from, relationship.to])).toEqual([
      ['products', 'price'],
      ['price', 'browse'],
      ['browse', 'buy'],
      ['buy', 'delivery'],
    ]);
  });

  it('grows beyond fourteen areas without overlapping boxes, paths or labels', () => {
    const ids = Array.from({ length: 20 }, (_, index) => `area-${String(index)}`);
    const relationships = [
      ...ids.slice(0, 9).map((id, index) => edge(id, ids[index + 9]!)),
      edge('area-0', 'area-17'),
      edge('area-17', 'area-18'),
      edge('area-18', 'area-0'),
      edge('area-19', 'area-0', 'support'),
      edge('area-17', 'area-17', 'support'),
    ];
    const source = landscape(ids, relationships);
    const view = areaLandscapeOf(workspace, source);
    expect(areaLandscapeOf(workspace, source)).toEqual(view);
    expect(view.edges).toHaveLength(relationships.length);
    expect(view.nodes).toHaveLength(20);
    const flowIds = new Set(
      relationships
        .filter((item) => item.kind !== 'support')
        .flatMap((item) => [item.from, item.to]),
    );
    for (const node of view.nodes.filter((item) => flowIds.has(item.id))) {
      expect(
        view.nodes.filter((other) => flowIds.has(other.id) && other.x === node.x).length,
      ).toBeLessThanOrEqual(3);
    }
    for (const node of view.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.x + node.width).toBeLessThanOrEqual(view.width);
      expect(node.y + node.height).toBeLessThanOrEqual(view.height);
      for (const other of view.nodes.filter((candidate) => candidate.id !== node.id)) {
        expect(
          node.x + node.width <= other.x ||
            other.x + other.width <= node.x ||
            node.y + node.height <= other.y ||
            other.y + other.height <= node.y,
        ).toBe(true);
      }
    }
    for (const relationship of view.edges) {
      for (const point of samples(relationship.path)) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(view.width);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(view.height);
        expect(
          view.nodes.some(
            (node) =>
              point.x > node.x + 0.1 &&
              point.x < node.x + node.width - 0.1 &&
              point.y > node.y + 0.1 &&
              point.y < node.y + node.height - 0.1,
          ),
        ).toBe(false);
      }
      if (relationship.labelHidden === true) continue;
      const caption = diagramCaption(relationship.label);
      const halfWidth = caption.width / 2;
      expect(
        view.edges
          .filter((other) => other.id !== relationship.id && other.labelHidden !== true)
          .some(
            (other) =>
              Math.abs(other.x - relationship.x) <
                halfWidth + diagramCaption(other.label).width / 2 &&
              other.y - 14 < relationship.y - 14 + caption.height &&
              relationship.y - 14 < other.y - 14 + diagramCaption(other.label).height,
          ),
      ).toBe(false);
      expect(
        view.nodes.some(
          (node) =>
            relationship.x + halfWidth > node.x &&
            relationship.x - halfWidth < node.x + node.width &&
            relationship.y - 14 + caption.height > node.y &&
            relationship.y - 14 < node.y + node.height,
        ),
      ).toBe(false);
    }
  });

  it('places a short branch beside the activity that feeds its destination', () => {
    const view = areaLandscapeOf(
      workspace,
      landscape(
        ['fleet', 'products', 'accounts', 'offers', 'browse', 'buy', 'delivery'],
        [
          edge('products', 'offers'),
          edge('offers', 'browse'),
          edge('browse', 'buy', 'transition'),
          edge('buy', 'delivery', 'transition'),
          edge('fleet', 'buy', 'transition'),
          edge('accounts', 'buy'),
        ],
      ),
    );
    const nodes = new Map(view.nodes.map((node) => [node.id, node]));
    expect(nodes.get('fleet')!.x).toBe(nodes.get('browse')!.x);
    expect(nodes.get('accounts')!.x).toBe(nodes.get('browse')!.x);
    expect(nodes.get('fleet')!.x).toBeGreaterThan(nodes.get('products')!.x);
    expect(nodes.get('buy')!.x - nodes.get('fleet')!.x).toBe(
      nodes.get('browse')!.x - nodes.get('offers')!.x,
    );
    expect(view.nodes.filter((node) => node.x === nodes.get('fleet')!.x)).toHaveLength(3);
  });

  it('pulls a whole short branch towards a join without stretching its internal connections', () => {
    const view = areaLandscapeOf(
      workspace,
      landscape(
        ['source', 'prepare', 'offers', 'browse', 'buy', 'fleet', 'agreements'],
        [
          edge('source', 'prepare'),
          edge('prepare', 'offers'),
          edge('offers', 'browse'),
          edge('browse', 'buy'),
          edge('fleet', 'agreements'),
          edge('agreements', 'buy'),
        ],
      ),
    );
    const nodes = new Map(view.nodes.map((node) => [node.id, node]));
    expect(nodes.get('agreements')!.x).toBe(nodes.get('browse')!.x);
    expect(nodes.get('fleet')!.x).toBe(nodes.get('offers')!.x);
    expect(nodes.get('agreements')!.x - nodes.get('fleet')!.x).toBe(
      nodes.get('prepare')!.x - nodes.get('source')!.x,
    );
  });

  it('keeps support-only areas below the flow without implying a sequence between them', () => {
    const view = areaLandscapeOf(
      workspace,
      landscape(
        ['support', 'target', 'source', 'independent'],
        [edge('source', 'target'), edge('support', 'source', 'support')],
      ),
    );
    const nodes = new Map(view.nodes.map((node) => [node.id, node]));
    expect(nodes.get('source')!.x).toBeLessThan(nodes.get('target')!.x);
    expect(nodes.get('support')!.y).toBeGreaterThan(nodes.get('target')!.y);
    expect(nodes.get('support')!.y).toBe(nodes.get('independent')!.y);
    const support = view.edges.find((item) => item.kind === 'support');
    expect(support).toBeDefined();
    const start = support?.path.match(/^M ([\d.]+),([\d.]+)/u);
    const end = support?.path.match(/ L ([\d.]+),([\d.]+)$/u);
    expect(start?.slice(1)).toEqual([
      String(nodes.get('support')!.x + 125),
      String(nodes.get('support')!.y),
    ]);
    expect(end?.slice(1)).toEqual([
      String(nodes.get('source')!.x + 125),
      String(nodes.get('source')!.y + 166),
    ]);
  });

  it('contains empty and unconnected landscapes within dynamically sized bounds', () => {
    expect(areaLandscapeOf(workspace, landscape([], []))).toMatchObject({
      nodes: [],
      edges: [],
      width: 760,
      height: 280,
    });
    const view = areaLandscapeOf(workspace, landscape(['one', 'two', 'three', 'four'], []));
    expect(view.nodes[3]!.y).toBeGreaterThan(view.nodes[0]!.y);
    expect(view.nodes[3]!.y + view.nodes[3]!.height).toBeLessThan(view.height);
  });
});
