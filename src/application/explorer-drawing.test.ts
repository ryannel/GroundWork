import { describe, expect, it } from 'vitest';

import { explorerFixture } from '@/../test/service-explorer-kit';

import { explorerDrawing } from './explorer-drawing';

describe('explorer visual projection', () => {
  it('draws only delivered relationships and keeps failure and async edges distinct', () => {
    const page = explorerFixture();
    const drawing = explorerDrawing(page);
    expect(drawing.nodes.map((node) => node.id)).toEqual(page.nodes.map((node) => node.id));
    expect(drawing.edges.map((edge) => edge.id)).toEqual(page.links.map((edge) => edge.id));
    expect(drawing.nodes.find((node) => node.id === 'guard')?.shape).toBe('diamond');
    expect(drawing.nodes.find((node) => node.id === 'save')?.shape).toBe('store');
    expect(drawing.edges.filter((edge) => edge.dashed).map((edge) => edge.id)).toEqual([
      'no',
      'later',
    ]);
    expect(drawing.nodes.find((node) => node.id === 'failure')?.tone).toBe('warning');
  });
  it('terminates cycles and retains detached evidence without inventing connecting edges', () => {
    const page = explorerFixture();
    const cycle = {
      ...page,
      links: [{ ...page.links[0]!, from: 'entry', to: 'entry' }],
      nodes: page.nodes.map((node) => ({
        ...node,
        label: `${node.label} with a longer explanatory source label`,
      })),
    };
    const drawing = explorerDrawing(cycle);
    expect(drawing.edges).toHaveLength(1);
    expect(drawing.nodes).toHaveLength(page.nodes.length);
    expect(drawing.width).toBeGreaterThanOrEqual(800);
    expect(explorerDrawing({ ...page, nodes: [], links: [] }).height).toBe(260);
    expect(
      explorerDrawing({ ...page, links: [{ ...page.links[0]!, to: 'absent' }] }).edges,
    ).toEqual([]);
  });
  it('keeps an entry group together while preserving every delivered boundary', () => {
    const page = explorerFixture();
    const component = { ...page.nodes[0]!, id: 'component', kind: 'component' as const };
    const stores = Array.from({ length: 5 }, (_, i) => ({
      ...page.nodes[2]!,
      id: `store-${String(i)}`,
    }));
    const dependencies = Array.from({ length: 7 }, (_, i) => ({
      ...page.nodes[2]!,
      kind: 'call' as const,
      id: `call-${String(i)}`,
    }));
    const nodes = [component, page.nodes[0]!, ...stores, ...dependencies];
    const links = nodes
      .slice(1)
      .map((node) => ({ ...page.links[0]!, id: node.id, from: component.id, to: node.id }));
    const drawing = explorerDrawing({ ...page, kind: 'overview', nodes, links });
    expect(drawing.height).toBeLessThan(1100);
    expect(drawing.nodes).toHaveLength(nodes.length);
    expect(new Set(drawing.nodes.map((node) => `${String(node.x)}:${String(node.y)}`)).size).toBe(
      nodes.length,
    );
    expect(drawing.edges).toHaveLength(links.length);
    expect(drawing.edges.every((edge) => edge.path.includes(' C'))).toBe(true);
    expect(drawing.edges.find((edge) => edge.id === 'entry')?.label).toBe('');
    expect(drawing.edges.find((edge) => edge.id === 'store-0')?.label).toBe(links[0]!.label);
    expect(drawing.groups).toHaveLength(1);
    expect(drawing.nodes.find((node) => node.id === 'entry')?.shape).toBe('row');
    expect(drawing.nodes.find((node) => node.id === 'component')?.shape).toBe('header');
  });
  it('keeps declared schemas inside the service boundary and preserves full route labels', () => {
    const fixture = explorerFixture();
    const route = 'POST api/v{version:apiVersion}/CalculateProductPrices';
    const page = {
      ...fixture,
      kind: 'overview' as const,
      nodes: [
        { ...fixture.nodes[0]!, id: 'service', kind: 'component' as const },
        { ...fixture.nodes[0]!, label: route },
        { ...fixture.nodes[0]!, id: 'schema', kind: 'schema' as const },
      ],
      links: [],
    };
    const drawing = explorerDrawing(page);
    expect(drawing.nodes.find((node) => node.id === 'entry')).toMatchObject({
      detail: route,
      shape: 'row',
    });
    expect(drawing.nodes.find((node) => node.id === 'schema')?.shape).toBe('row');
    expect(drawing.groups?.[0]?.height).toBeGreaterThan(300);
    expect(explorerDrawing({ ...page, nodes: [page.nodes[0]!] }).groups).toEqual([]);
  });
});
