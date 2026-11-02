import { describe, expect, it } from 'vitest';

import type { AreaView } from '@/application/workspace-area';
import type { LandscapeValueFlow } from '@/domain/landscape';

import { valueFlowEdges, valueFlowLayout } from './value-flow-layout';
import { routeValueFlows } from './value-flow-routing';

const view: AreaView = {
  workspace: { id: 'test', name: 'Test', href: '/' },
  area: {
    id: 'commercial',
    name: 'Commercial',
    purpose: '',
    activities: [],
    boundary: '',
    confidence: 'medium',
    evidenceCount: 0,
  },
  reviewed: '2026-10-29',
  scope: '',
  limitation: '',
  relationships: [],
  technicalRelationships: [],
  collaborations: [],
  systems: [
    {
      id: 'source',
      name: 'Source',
      components: [
        { id: 'editor', name: 'Editor' },
        { id: 'topic', name: 'Topic' },
        { id: 'cache', name: 'Cache' },
      ],
    },
    {
      id: 'consumer',
      name: 'Consumer',
      components: [
        { id: 'reader', name: 'Reader' },
        { id: 'peer', name: 'Peer' },
      ],
    },
    { id: 'other', name: 'Other', components: [{ id: 'support', name: 'Support' }] },
  ].map((system) => ({
    ...system,
    href: '/',
    purpose: '',
    resources: [],
    components: system.components.map((component) => ({
      ...component,
      kind: 'service',
      summary: '',
      endpoints: [],
      dependencies: [],
      resources: [],
      repository: null,
      explorer: null,
    })),
  })),
};
const narrative: LandscapeValueFlow = {
  title: 'Publish and use',
  summary: 'Inputs become useful.',
  confidence: 'medium',
  reasoning: 'Recorded flows.',
  limitations: [],
  bands: [
    {
      id: 'publish',
      title: 'Publish',
      summary: 'Make changes available.',
      nodes: [
        { component: 'editor', column: 0 },
        { component: 'topic', column: 1 },
      ],
    },
    {
      id: 'use',
      title: 'Use',
      summary: 'Use published inputs.',
      nodes: [
        { component: 'reader', column: 2 },
        { component: 'peer', column: 2 },
      ],
    },
  ],
  connections: [
    { from: 'editor', to: 'topic', label: 'Publish', kind: 'message', evidence: ['editor'] },
    { from: 'topic', to: 'reader', label: 'Supply inputs', kind: 'message', evidence: ['topic'] },
  ],
};

describe('value flow exploration', () => {
  it('keeps recorded membership as an arrowless supporting connection after routing', () => {
    const relation = {
      id: 'membership:cache',
      from: 'editor',
      to: 'cache',
      fromSystem: 'source',
      toSystem: 'source',
      kind: 'membership' as const,
      directed: false,
      supporting: true,
      via: 'sg:cache',
      endpointId: null,
      label: 'Recorded subgraph membership',
      detail: 'Not live composition.',
      evidenced: false,
      evidence: 'configuration' as const,
    };
    const layout = valueFlowLayout(
      { ...view, technicalRelationships: [relation] },
      narrative,
      new Set(['source']),
    );
    const edges = valueFlowEdges(narrative, layout.nodes, [], [relation]);
    expect(edges.find((edge) => edge.kind === 'membership')).toMatchObject({
      directed: false,
      supporting: true,
      label: 'Recorded subgraph membership',
      endpointId: null,
    });
  });
  it('uses authored activity order for tied anchors and retains secondary work on the collapsed card', () => {
    const detail = {
      ...narrative,
      connections: [],
      bands: [
        {
          id: 'first',
          title: 'Prepare developer access',
          summary: '',
          nodes: [{ component: 'cache', column: 0 }],
        },
        {
          id: 'second',
          title: 'Read owner reports',
          summary: '',
          nodes: [{ component: 'editor', column: 0 }],
        },
      ],
    };
    const drawing = valueFlowLayout(view, detail);
    const system = drawing.nodes.find((node) => node.systemId === 'source');
    expect(system).toMatchObject({
      band: 'first',
      activities: ['Read owner reports'],
      height: 164,
    });
    expect(drawing.headings.map((heading) => heading.title)).toEqual(['Prepare developer access']);
    expect(drawing.nodes.filter((node) => node.systemId === 'source')).toHaveLength(1);
  });

  it('anchors a system on its selected overview responsibility rather than secondary call volume', () => {
    const chosen = {
      from: 'topic',
      to: 'reader',
      kind: 'api' as const,
      label: 'Read the main view',
      evidence: ['cache'],
    };
    const detail = {
      ...narrative,
      bands: [
        {
          ...narrative.bands[0]!,
          nodes: [
            { component: 'editor', column: 0 },
            { component: 'cache', column: 1 },
          ],
        },
        narrative.bands[1]!,
      ],
      connections: [
        chosen,
        { ...chosen, from: 'editor', to: 'reader', label: 'Read secondary data' },
        { ...chosen, from: 'editor', to: 'peer', label: 'Manage supporting work' },
      ],
      overview: [chosen],
    };
    const owned = {
      ...view,
      systems: view.systems.map((system) => ({
        ...system,
        components: system.components.map((component) =>
          component.id === 'topic' ? { ...component, parentComponent: 'cache' } : component,
        ),
      })),
    };
    const drawing = valueFlowLayout(owned, detail);
    expect(drawing.nodes.find((node) => node.systemId === 'source')?.component.id).toBe('cache');
    expect(drawing.nodes.find((node) => node.systemId === 'source')?.members).toHaveLength(3);
  });

  it('starts with one node per system and retains every component behind those nodes', () => {
    const layout = valueFlowLayout(view, narrative);
    expect(layout.nodes).toHaveLength(3);
    expect(layout.nodes.every((node) => node.collapsed)).toBe(true);
    expect(
      layout.nodes.flatMap((node) => node.members).toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(['cache', 'editor', 'peer', 'reader', 'support', 'topic']);
    expect(valueFlowEdges(narrative, layout.nodes)).toHaveLength(1);
  });
  it('opens only the requested system, preserving the topic and quieter support', () => {
    const layout = valueFlowLayout(view, narrative, new Set(['source']));
    expect(layout.nodes.find((node) => node.id === 'topic')).toMatchObject({
      collapsed: false,
      supporting: false,
    });
    expect(layout.nodes.find((node) => node.id === 'cache')).toMatchObject({
      collapsed: false,
      supporting: true,
    });
    expect(layout.nodes.find((node) => node.systemId === 'consumer')?.collapsed).toBe(true);
    const edges = valueFlowEdges(narrative, layout.nodes);
    expect(edges).toHaveLength(2);
    expect(edges).toContainEqual(
      expect.objectContaining({ from: 'editor', to: 'topic', label: 'Publish' }),
    );
    const ids = new Set(layout.nodes.map((node) => node.id));
    expect(edges.every((edge) => ids.has(edge.from) && ids.has(edge.to))).toBe(true);
  });
  it('keeps a collapsed system in one full-height card without a detached heading', () => {
    const collapsed = valueFlowLayout(view, narrative);
    const other = collapsed.nodes.find((node) => node.systemId === 'other')!;
    const primary = collapsed.nodes.find((node) => node.systemId === 'source')!;
    expect(other.height).toBe(primary.height);
    expect(collapsed.headings.find((heading) => heading.id === 'support:other')).toBeUndefined();
    const expanded = valueFlowLayout(view, narrative, new Set(['other']));
    expect(expanded.nodes.find((node) => node.id === 'support')).toMatchObject({
      collapsed: false,
      supporting: true,
    });
    expect(expanded.groups.find((group) => group.id === 'other')?.name).toBe('Other');
    expect(expanded.headings.find((heading) => heading.id === 'support:other')?.title).toBe(
      'Other components',
    );
  });
  it('routes between columns without looping around headings above collapsed systems', () => {
    const acrossColumns = {
      ...narrative,
      bands: narrative.bands.map((band) =>
        band.id === 'use'
          ? { ...band, nodes: [...band.nodes, { component: 'support', column: 3 }] }
          : band,
      ),
    };
    const layout = valueFlowLayout(view, acrossColumns, new Set(['consumer']));
    const source = layout.nodes.find((node) => node.members.includes('topic'))!;
    const reader = layout.nodes.find((node) => node.id === 'reader')!;
    const edge = valueFlowEdges(narrative, layout.nodes, layout.headings).find(
      (item) => item.label === 'Supply inputs',
    )!;
    const xs = edge.path
      .split(' ')
      .filter((part) => part.includes(','))
      .map((point) => Number(point.split(',')[0]));
    expect(xs.length).toBeGreaterThan(1);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(source.x + source.width);
    expect(Math.max(...xs)).toBeLessThanOrEqual(reader.x);
    expect(edge.y).toBeGreaterThanOrEqual(reader.y);
    expect(edge.y).toBeLessThanOrEqual(reader.y + reader.height);
    expect(layout.headings.find((heading) => heading.id === 'publish')?.width).toBe(source.width);
  });
  it('stacks peers and returns to the same collapsed layout', () => {
    const before = valueFlowLayout(view, narrative);
    const expanded = valueFlowLayout(view, narrative, new Set(['consumer']));
    const reader = expanded.nodes.find((node) => node.id === 'reader')!;
    const peer = expanded.nodes.find((node) => node.id === 'peer')!;
    expect(peer.x).toBe(reader.x);
    expect(peer.y).toBeGreaterThan(reader.y + reader.height);
    expect(valueFlowLayout(view, narrative, new Set())).toEqual(before);
  });
  it('encloses every component once and keeps neighbouring systems outside expanded boundaries', () => {
    const layout = valueFlowLayout(view, narrative, new Set(['source', 'consumer']));
    expect(layout.groups).toHaveLength(2);
    expect(new Set(layout.nodes.flatMap((node) => node.members)).size).toBe(6);
    expect(layout.nodes.flatMap((node) => node.members)).toHaveLength(6);
    for (const group of layout.groups) {
      for (const node of layout.nodes) {
        const inside =
          node.x >= group.x &&
          node.y >= group.y &&
          node.x + node.width <= group.x + group.width &&
          node.y + node.height <= group.y + group.height;
        expect(inside).toBe(node.systemId === group.id);
        const outside =
          node.x + node.width <= group.x ||
          node.x >= group.x + group.width ||
          node.y + node.height <= group.y ||
          node.y >= group.y + group.height;
        expect(outside).toBe(node.systemId !== group.id);
      }
    }
  });
  it('places support beside recorded neighbours and shows its actual connection quietly', () => {
    const technical: AreaView['technicalRelationships'] = [
      {
        id: 'write',
        from: 'editor',
        to: 'cache',
        fromSystem: 'source',
        toSystem: 'source',
        label: 'Store input',
        detail: 'Editor writes its cache.',
        kind: 'data',
        via: null,
        evidenced: true,
      },
      {
        id: 'publish',
        from: 'editor',
        to: 'topic',
        fromSystem: 'source',
        toSystem: 'source',
        label: 'Publish',
        detail: 'Publishes updates.',
        kind: 'message',
        via: null,
        evidenced: true,
      },
    ];
    const layout = valueFlowLayout(
      { ...view, technicalRelationships: technical },
      narrative,
      new Set(['source']),
    );
    const editor = layout.nodes.find((node) => node.id === 'editor')!;
    const cache = layout.nodes.find((node) => node.id === 'cache')!;
    expect(cache.band).toBe(editor.band);
    expect(cache.x).toBe(editor.x);
    expect(cache.y).toBeGreaterThan(editor.y + editor.height);
    const edges = valueFlowEdges(
      narrative,
      layout.nodes,
      layout.headings,
      technical,
      layout.groups,
    );
    expect(edges.filter((edge) => edge.from === 'editor' && edge.to === 'topic')).toHaveLength(1);
    expect(edges).toContainEqual(
      expect.objectContaining({
        from: 'editor',
        to: 'cache',
        supporting: true,
      }),
    );
    expect(edges.find((edge) => edge.from === 'editor' && edge.to === 'cache')?.detail).toContain(
      'Editor writes its cache.',
    );
    expect(edges.some((edge) => edge.to === 'support')).toBe(false);
  });
});

function privateResources(): AreaView {
  return {
    ...view,
    systems: view.systems.map((system) => ({
      ...system,
      components: system.components.map((component) => {
        if (component.id === 'topic') {
          return { ...component, kind: 'queue', parentComponent: 'editor' };
        }
        if (component.id === 'cache') {
          return { ...component, kind: 'database', parentComponent: 'editor' };
        }
        if (component.id === 'reader') {
          return {
            ...component,
            resources: [{ id: 'topic', name: 'Topic', kind: 'topic', use: 'Consumes updates' }],
            endpoints: [
              {
                id: 'api:read',
                signature: 'GET /inputs',
                summary: 'Read inputs',
                request: null,
                response: null,
                callers: [],
                explorer: null,
              },
            ],
          };
        }
        return component;
      }),
    })),
  };
}

describe('service detail in value flows', () => {
  it.each([false, true])(
    'retains consumer usage through owned topic folding with authored core %s',
    (authored) => {
      const fixture = privateResources();
      const technical: AreaView['technicalRelationships'] = [
        {
          id: 'delivery',
          from: 'topic',
          to: 'reader',
          usageFrom: 'reader',
          usageTo: 'topic',
          fromSystem: 'source',
          toSystem: 'consumer',
          kind: 'message',
          via: 'msg:updates',
          label: 'Consumes updates',
          detail: 'Captured consumer',
          evidenced: true,
        },
      ];
      const detail = {
        ...narrative,
        connections: authored
          ? [
              {
                from: 'editor',
                to: 'reader',
                label: 'Supply inputs',
                kind: 'message' as const,
                evidence: ['msg:updates'],
              },
            ]
          : [],
      };
      const layout = valueFlowLayout(
        { ...fixture, technicalRelationships: technical },
        detail,
        new Set(['source', 'consumer']),
        new Set(['editor', 'reader']),
      );
      const edges = valueFlowEdges(detail, layout.nodes, layout.headings, technical, layout.groups);
      expect(edges.length).toBeGreaterThan(0);
      for (const edge of edges) {
        expect(edge).toMatchObject({ from: 'editor', to: 'reader', kind: 'message' });
        expect(edge.relations).toContainEqual(
          expect.objectContaining({
            from: 'editor',
            to: 'reader',
            usageFrom: 'reader',
            usageTo: 'editor',
          }),
        );
        expect(edge.relations.every((relation) => relation.usageFrom === 'reader')).toBe(true);
      }
      expect(edges.flatMap((edge) => edge.relations)).toContainEqual(
        expect.objectContaining({
          from: 'topic',
          to: 'reader',
          usageFrom: 'reader',
          usageTo: 'topic',
        }),
      );
    },
  );

  it('folds private resources but keeps every identity and the publisher-to-consumer exchange', () => {
    const fixture = privateResources();
    const layout = valueFlowLayout(fixture, narrative, new Set(['source', 'consumer']));
    expect(layout.nodes.some((node) => node.id === 'topic' || node.id === 'cache')).toBe(false);
    expect(layout.nodes.find((node) => node.id === 'editor')?.members).toEqual([
      'editor',
      'topic',
      'cache',
    ]);
    const edges = valueFlowEdges(narrative, layout.nodes, layout.headings, [], layout.groups);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ from: 'editor', to: 'reader', kind: 'message' });
    expect(edges[0]?.relations).toContainEqual(
      expect.objectContaining({ from: 'topic', to: 'reader' }),
    );
  });
  it('lands event delivery on the owned topic and its consumer row when both services open', () => {
    const fixture = privateResources();
    const layout = valueFlowLayout(
      fixture,
      narrative,
      new Set(['source', 'consumer']),
      new Set(['editor', 'reader']),
    );
    const edge = valueFlowEdges(narrative, layout.nodes, layout.headings, [], layout.groups)[0]!;
    const source = layout.nodes.find((node) => node.id === 'editor')!;
    const target = layout.nodes.find((node) => node.id === 'reader')!;
    expect(source.height).toBeGreaterThan(200);
    expect(edge.sourceY).toBeGreaterThan(source.y + 84);
    expect(edge.targetY).toBeGreaterThan(target.y + 84);
    expect(edge.points[0]?.y).toBe(edge.sourceY);
    expect(edge.points.at(-1)?.y).toBe(edge.targetY);
  });
  it('connects an API request to the exposed API row without duplicating the recorded exchange', () => {
    const fixture = privateResources();
    const request = {
      from: 'editor',
      to: 'reader',
      label: 'Read inputs',
      kind: 'api' as const,
      evidence: ['api:read'],
    };
    const story = { ...narrative, connections: [request] };
    const technical: AreaView['technicalRelationships'] = [
      {
        ...request,
        evidence: 'declared',
        id: 'read',
        fromSystem: 'source',
        toSystem: 'consumer',
        detail: 'Read inputs',
        via: null,
        endpointId: 'api:read',
        evidenced: true,
      },
    ];
    const layout = valueFlowLayout(
      fixture,
      story,
      new Set(['source', 'consumer']),
      new Set(['reader', 'editor']),
    );
    const edges = valueFlowEdges(story, layout.nodes, layout.headings, technical, layout.groups);
    expect(edges).toHaveLength(1);
    const reader = layout.nodes.find((node) => node.id === 'reader')!;
    const editor = layout.nodes.find((node) => node.id === 'editor')!;
    expect(edges[0]?.points[0]?.y).toBeLessThan(editor.y + 84);
    expect(edges[0]?.targetY).toBeGreaterThan(reader.y + 84);
    expect(edges[0]?.points.at(-1)?.y).toBe(edges[0]?.targetY);
    expect(edges[0]?.relations.some((relation) => relation.endpointId === 'api:read')).toBe(true);
  });
});

it('summarises recorded supporting calls without creating a new edge or promoting it into the key flow', () => {
  const summary = {
    from: 'cache',
    to: 'reader',
    kind: 'api' as const,
    label: 'Find stored inputs',
    evidence: ['api:read'],
  };
  const story = { ...narrative, summaries: [summary] };
  const layout = valueFlowLayout(view, story, new Set(['source', 'consumer']));
  const technical: AreaView['technicalRelationships'] = [
    {
      from: 'cache',
      to: 'reader',
      kind: 'api',
      id: 'read',
      endpointId: 'api:read',
      fromSystem: 'source',
      toSystem: 'consumer',
      via: null,
      evidenced: true,
      label: 'GET /inputs',
      detail: 'Cache calls Reader at GET /inputs.',
    },
  ];
  const without = valueFlowEdges(story, layout.nodes, layout.headings, [], layout.groups);
  expect(without.some((edge) => edge.label === summary.label)).toBe(false);
  const withCall = valueFlowEdges(story, layout.nodes, layout.headings, technical, layout.groups);
  const explained = withCall.find((edge) => edge.label === summary.label);
  expect(explained).toMatchObject({ from: 'cache', to: 'reader', supporting: true });
  expect(explained?.relations.some((relation) => relation.endpointId === 'api:read')).toBe(true);
});

it('packs parallel contributions across the canvas instead of one long left-hand list', () => {
  const ids = Array.from({ length: 8 }, (_, index) => `system-${String(index)}`);
  const systems = ids.map((id) => ({
    ...view.systems[0]!,
    id,
    name: id,
    components: [{ ...view.systems[0]!.components[0]!, id }],
  }));
  const flow = {
    ...narrative,
    connections: [],
    bands: [
      ...ids
        .slice(0, 5)
        .map((id) => ({ id, title: id, summary: '', nodes: [{ component: id, column: 0 }] })),
      {
        id: 'use',
        title: 'Use the inputs',
        summary: '',
        nodes: ids.slice(5).map((id, index) => ({ component: id, column: index + 1 })),
      },
    ],
  };
  const drawing = valueFlowLayout({ ...view, systems }, flow);
  const contributions = drawing.nodes.filter((node) => ids.slice(0, 5).includes(node.systemId));
  expect(new Set(contributions.map((node) => node.x)).size).toBe(2);
  expect(new Set(contributions.map((node) => node.y)).size).toBe(3);
  expect(drawing.height).toBeLessThan(1400);
  expect(drawing.nodes).toHaveLength(8);
});

it('uses area-wide system columns independently of local component stages', () => {
  const flow = {
    ...narrative,
    columns: [
      { system: 'source', column: 2 },
      { system: 'consumer', column: 1 },
      { system: 'other', column: 0 },
    ],
  };
  const drawing = valueFlowLayout(view, flow);
  expect(drawing.nodes.find((node) => node.systemId === 'source')?.rank).toBe(2);
  expect(drawing.nodes.find((node) => node.systemId === 'consumer')?.rank).toBe(1);
  expect(drawing.nodes.find((node) => node.systemId === 'other')?.rank).toBe(0);
  expect(drawing.nodes.find((node) => node.systemId === 'source')?.x).toBe(1000);
  const expanded = valueFlowLayout(view, flow, new Set(['source']));
  expect(expanded.nodes.find((node) => node.id === 'editor')?.rank).toBe(0);
  expect(expanded.nodes.find((node) => node.id === 'topic')?.rank).toBe(1);
  const edges = valueFlowEdges(flow, expanded.nodes);
  expect(edges.some((edge) => edge.from === 'editor' && edge.to === 'topic')).toBe(true);
});

it('keeps core columns fixed when a component has many supporting neighbours', () => {
  const baseline = valueFlowLayout(view, narrative, new Set(['source']));
  const supports = Array.from({ length: 20 }, (_, index) => ({
    ...view.systems[0]!.components[0]!,
    id: `support-${String(index)}`,
  }));
  const systems = view.systems.map((system) =>
    system.id === 'source'
      ? { ...system, components: [...system.components, ...supports] }
      : system,
  );
  const relationships = supports.map((component) => ({
    id: component.id,
    from: 'editor',
    to: component.id,
    fromSystem: 'source',
    toSystem: 'source',
    via: null,
    kind: 'api' as const,
    label: 'Supporting work',
    detail: '',
    evidenced: true,
  }));
  const expanded = valueFlowLayout(
    { ...view, systems, technicalRelationships: relationships },
    narrative,
    new Set(['source']),
    new Set(['editor']),
  );
  expect(expanded.nodes.find((node) => node.id === 'editor')?.x).toBe(
    baseline.nodes.find((node) => node.id === 'editor')?.x,
  );
  expect(expanded.nodes.find((node) => node.id === 'topic')?.x).toBe(
    baseline.nodes.find((node) => node.id === 'topic')?.x,
  );
  expect(expanded.nodes.filter((node) => node.systemId === 'source')).toHaveLength(23);
  const pairs = expanded.nodes.flatMap((node, index) =>
    expanded.nodes.slice(index + 1).map((other) => [node, other] as const),
  );
  for (const [a, b] of pairs) {
    expect(
      a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y,
    ).toBe(true);
  }
});

it('keeps headings local when one activity spans other packed stages or an expanded system', () => {
  const systems = ['a', 'b', 'c', 'd'].map((id) => ({
    ...view.systems[0]!,
    id,
    name: id,
    components: [{ ...view.systems[0]!.components[0]!, id }],
  }));
  const flow = {
    ...narrative,
    connections: [],
    bands: [
      {
        id: 'dispersed',
        title: 'Dispersed activity',
        summary: '',
        nodes: [
          { component: 'a', column: 0 },
          { component: 'c', column: 2 },
        ],
      },
      {
        id: 'between',
        title: 'Other work between the contributions',
        summary: '',
        nodes: [
          { component: 'b', column: 1 },
          { component: 'd', column: 1 },
        ],
      },
    ],
  };
  for (const expanded of [[], ['a'], ['b']]) {
    const drawing = valueFlowLayout({ ...view, systems }, flow, new Set(expanded));
    const boxes = [...drawing.nodes, ...drawing.headings];
    const pairs = boxes.flatMap((box, index) =>
      boxes.slice(index + 1).map((other) => [box, other] as const),
    );
    for (const [a, b] of pairs) {
      expect(
        a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y,
      ).toBe(true);
    }
    expect(drawing.headings.filter((heading) => heading.id === 'dispersed')).toHaveLength(2);
  }
});

it('reserves supporting labels so parallel deliveries do not paint over one another', () => {
  const drawing = valueFlowLayout(view, narrative);
  const nodes = [drawing.nodes[0]!, drawing.nodes[1]!].map((node, index) => ({
    ...node,
    x: 80 + index * 460,
    y: 146,
    width: 280,
    height: 140,
  }));
  const edges = Array.from({ length: 7 }, (_, index) => ({
    id: `delivery-${String(index)}`,
    from: nodes[0]!.id,
    to: nodes[1]!.id,
    kind: 'message' as const,
    supporting: true,
    label: `Deliver update ${String(index)}`,
    detail: 'Recorded delivery',
    evidence: [],
    relations: [],
  }));
  const labels = routeValueFlows(edges, nodes, [], []).map((edge) => ({
    x: edge.x - (edge.label.length * 6.5 + 16) / 2,
    y: edge.y - 14,
    width: edge.label.length * 6.5 + 16,
    height: 18,
  }));
  const pairs = labels.flatMap((label, index) =>
    labels.slice(index + 1).map((other) => [label, other] as const),
  );
  for (const [a, b] of pairs) {
    expect(
      a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y,
    ).toBe(true);
  }
});
