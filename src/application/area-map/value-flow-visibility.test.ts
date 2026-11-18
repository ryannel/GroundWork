import { describe, expect, it } from 'vitest';

import type { ValueFlowConnection } from './value-flow-connections';
import type { ValueFlowNode } from './value-flow-system';
import { defaultValueFlowConnections } from './value-flow-visibility';

function node(
  id: string,
  kind: ValueFlowNode['component']['kind'] = 'service',
  systemId = 'price',
): ValueFlowNode {
  return {
    id,
    systemId,
    system: systemId,
    band: 'main',
    supporting: true,
    collapsed: false,
    members: [id],
    x: 0,
    y: 0,
    width: 280,
    height: 140,
    rank: 0,
    component: {
      id,
      kind,
      name: id,
      summary: '',
      endpoints: [],
      dependencies: [],
      resources: [],
      repository: null,
    },
  };
}

function edge(
  from: string,
  to: string,
  supporting = true,
  kind: 'api' | 'message' = 'api',
): ValueFlowConnection {
  return {
    id: `${from}:${to}`,
    from,
    to,
    kind,
    supporting,
    label: `${from} to ${to}`,
    detail: 'Recorded exchange',
    evidence: [],
    relations: [{ from, to }],
  };
}

describe('default value-flow connections', () => {
  it('does not connect collapsed business systems through a shared platform dependency', () => {
    const nodes = [node('ui'), node('price'), node('marketing')];
    const edges = [edge('ui', 'price', false), { ...edge('marketing', 'price'), platform: true }];
    expect([...defaultValueFlowConnections(edges, nodes)]).toEqual(['ui:price']);
    expect(edges).toHaveLength(2);
  });

  it('retains the core and complete supporting chains without showing redundant exchanges', () => {
    const nodes = ['ui', 'price', 'external-prices', 'insurance', 'catalogue', 'unmapped'].map(
      (id) => node(id),
    );
    const edges = [
      edge('ui', 'price', false),
      edge('price', 'external-prices'),
      edge('external-prices', 'insurance'),
      edge('catalogue', 'price'),
      edge('catalogue', 'ui'),
    ];
    const selected = defaultValueFlowConnections(edges, nodes);
    expect([...selected].toSorted((a, b) => a.localeCompare(b))).toEqual([
      'catalogue:price',
      'external-prices:insurance',
      'price:external-prices',
      'ui:price',
    ]);
    expect(defaultValueFlowConnections(edges.toReversed(), nodes.toReversed())).toEqual(selected);
    expect(
      edges.filter((item) => selected.has(item.id)).map(({ from, to }) => [from, to]),
    ).toContainEqual(['external-prices', 'insurance']);
  });

  it('does not use shared infrastructure as the bridge when a business exchange exists', () => {
    const nodes = [node('ui'), node('price'), node('offers'), node('flags', 'external')];
    const edges = [
      edge('ui', 'price', false),
      edge('price', 'flags'),
      edge('offers', 'flags'),
      edge('offers', 'price'),
    ];
    const selected = defaultValueFlowConnections(edges, nodes);
    expect(selected.has('offers:price')).toBe(true);
    expect([...selected].filter((id) => id.endsWith(':flags'))).toHaveLength(1);
  });

  it('keeps disconnected recorded groups together without inventing a connection to the core', () => {
    const nodes = ['ui', 'price', 'a', 'b', 'c', 'unmapped'].map((id) => node(id));
    const edges = [edge('ui', 'price', false), edge('a', 'b'), edge('b', 'c'), edge('c', 'a')];
    const selected = defaultValueFlowConnections(edges, nodes);
    expect(selected.size).toBe(3);
    const endpoints = edges
      .filter((item) => selected.has(item.id))
      .flatMap(({ from, to }) => [from, to]);
    expect(new Set(endpoints)).toEqual(new Set(['ui', 'price', 'a', 'b', 'c']));
  });

  it('retains both publication and delivery for a visible topic even when its peers already join the core', () => {
    const nodes = [node('producer'), node('consumer'), node('topic', 'queue')];
    const edges = [
      edge('producer', 'consumer', false),
      edge('producer', 'topic', true, 'message'),
      edge('topic', 'consumer', true, 'message'),
    ];
    expect(defaultValueFlowConnections(edges, nodes).size).toBe(3);
  });
});
