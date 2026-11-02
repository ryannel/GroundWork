import { describe, expect, it } from 'vitest';

import { platformComponents } from '@/application/area-map/platform';
import type {
  AreaComponentView,
  AreaTechnicalRelationship,
  AreaView,
} from '@/application/workspace-area';

import { areaCanvasEdges } from './area-system-edges';

const component = (id: string): AreaComponentView => ({
  id,
  name: id,
  kind: 'service',
  summary: 'Scanned component',
  explorer: null,
  repository: null,
  resources: [],
  dependencies: [],
  endpoints: Array.from({ length: 9 }, (_, index) => ({
    id: `api:${String(index)}`,
    signature: `GET /items/${String(index)}`,
    summary: 'Reads an item',
    request: null,
    response: null,
    callers: [],
    explorer: null,
  })),
});

function fixture() {
  const systems = ['offers', 'price'].map((id, index) => ({
    id,
    name: id,
    purpose: id,
    href: `/${id}/`,
    resources: [],
    components: [component(`svc:${id}`)],
    x: index * 700,
    y: 0,
    width: 600,
    height: 500,
    rank: index,
    componentRelationships: [],
    componentBoxes: [
      {
        ...component(`svc:${id}`),
        x: 40,
        y: 80,
        width: 360,
        height: 344,
        rank: index,
        compact: false,
        open: true,
      },
    ],
  }));
  const relation: AreaTechnicalRelationship = {
    id: 'call-price',
    from: 'svc:offers',
    to: 'svc:price',
    fromSystem: 'offers',
    toSystem: 'price',
    via: 'api:0',
    endpointId: 'api:0',
    kind: 'api',
    label: 'REST /items',
    detail: 'Offers requests readiness from Price.',
    evidenced: true,
    evidence: 'handler',
  };
  const view: AreaView = {
    workspace: { id: 'cars', name: 'Cars', href: '/cars/' },
    area: {
      id: 'sell',
      name: 'Sell',
      purpose: 'Sell',
      activities: [],
      boundary: 'Partial',
      confidence: 'high',
      evidenceCount: 1,
    },
    reviewed: '2026-10-26',
    scope: 'Partial',
    limitation: 'Partial',
    systems,
    collaborations: [],
    relationships: [
      {
        id: 'response',
        from: 'price',
        to: 'offers',
        kind: 'api',
        label: 'Readiness result',
        detail: 'Authored response.',
      },
    ],
    technicalRelationships: [relation],
  };
  return { systems, view, relation };
}

describe('area canvas relation projection', () => {
  it('preserves arrowless membership and does not anchor it on an invented API', () => {
    const { systems, view, relation } = fixture();
    const membership = {
      ...relation,
      kind: 'membership' as const,
      directed: false,
      supporting: true,
      via: 'sg:price',
      endpointId: null,
      label: 'Recorded subgraph membership',
      evidenced: false,
      evidence: 'configuration' as const,
    };
    for (const detail of ['all', 'grouped'] as const) {
      const edges = areaCanvasEdges({
        systems,
        view: { ...view, relationships: [], technicalRelationships: [membership] },
        expanded: new Set(['offers', 'price']),
        detail,
      });
      expect(edges).toHaveLength(1);
      expect(edges[0]).toMatchObject({
        kind: 'membership',
        directed: false,
        supporting: true,
        endpointId: null,
        label: 'Recorded subgraph membership',
      });
      expect(edges[0]?.surfaceId).toBeUndefined();
    }
  });
  it('anchors a resource relation on the embedded row rather than the system boundary', () => {
    const { view, systems, relation } = fixture();
    const resource = { ...component('st:private'), kind: 'database' as const, endpoints: [] };
    const grouped = systems.map((system) => ({
      ...system,
      componentBoxes: system.componentBoxes.map((box) => ({
        ...box,
        attachments: system.id === 'price' ? [resource] : [],
      })),
    }));
    const edges = areaCanvasEdges({
      systems: grouped,
      expanded: new Set(['offers', 'price']),
      detail: 'all',
      view: {
        ...view,
        relationships: [],
        technicalRelationships: [
          {
            ...relation,
            to: resource.id,
            kind: 'data',
            endpointId: null,
            via: resource.id,
          },
        ],
      },
    });

    expect(edges[0]?.to).toBe(resource.id);
    expect(edges[0]?.path).toMatch(/L 740,296$/u);
  });

  it('keeps a shared business provider visible unless infrastructure is explicitly recorded', () => {
    const { view } = fixture();
    const provider = { ...component('svc:cms'), kind: 'external' as const };
    const systems = view.systems.map((system) => ({
      ...system,
      components: [...system.components, provider],
    }));
    expect(platformComponents({ ...view, systems })).not.toContain(provider.id);
    expect(
      platformComponents({
        ...view,
        systems: systems.map((system) => ({
          ...system,
          components: system.components.map((item) =>
            item.id === provider.id ? { ...item, infrastructure: true } : item,
          ),
        })),
      }),
    ).toContain(provider.id);
  });

  it('marks lines leaving an open system as context and calls to shared platform services', () => {
    const { view, systems, relation } = fixture();
    const flags = {
      ...component('svc:flags'),
      kind: 'external' as const,
      infrastructure: true,
      endpoints: [],
    };
    const withFlags = systems.map((system) =>
      system.id === 'price'
        ? {
            ...system,
            components: [...system.components, flags],
            componentBoxes: [
              ...system.componentBoxes,
              { ...system.componentBoxes[0]!, ...flags, y: 450, height: 40 },
            ],
          }
        : system,
    );
    const flagCall = (fromSystem: string): AreaTechnicalRelationship => ({
      ...relation,
      id: `flags:${fromSystem}`,
      from: `svc:${fromSystem}`,
      fromSystem,
      to: flags.id,
      endpointId: null,
      via: null,
      label: 'Reads a flag',
    });
    const edges = areaCanvasEdges({
      systems: withFlags,
      expanded: new Set(['offers']),
      detail: 'all',
      view: {
        ...view,
        systems: withFlags,
        relationships: [],
        technicalRelationships: [relation, ...['offers', 'tax', 'finance'].map(flagCall)],
      },
    });
    const call = edges.find((edge) => edge.id === relation.id);
    const flag = edges.find((edge) => edge.id === 'flags:offers');

    expect(call).toMatchObject({ context: true });
    expect(call?.platform).toBeUndefined();
    expect(flag).toMatchObject({ context: true, platform: true });
  });

  it('routes a return call around the entire destination card, not through its API row', () => {
    const { view, systems } = fixture();
    const system = systems[0]!;
    const target = { ...system.componentBoxes[0]!, id: 'svc:target', y: 600, height: 500 };
    const relation = {
      ...view.technicalRelationships[0]!,
      to: target.id,
      toSystem: system.id,
    };
    const edges = areaCanvasEdges({
      systems: [{ ...system, componentBoxes: [...system.componentBoxes, target] }],
      expanded: new Set([system.id]),
      detail: 'all',
      view: { ...view, relationships: [], technicalRelationships: [relation] },
    });
    expect(edges).toHaveLength(1);
    expect(edges[0]?.path).toContain('L 414,576');
    expect(edges[0]?.path).toMatch(/L 400,756$/u);
  });

  it('does not draw a redundant line inside a private resource card', () => {
    const { view, systems, relation } = fixture();
    const resource = { ...component('st:private'), kind: 'database' as const, endpoints: [] };
    const grouped = systems.map((system) => ({
      ...system,
      componentBoxes: system.componentBoxes.map((box) => ({ ...box, attachments: [resource] })),
    }));
    const edges = areaCanvasEdges({
      systems: grouped,
      expanded: new Set(['offers']),
      detail: 'all',
      view: {
        ...view,
        relationships: [],
        technicalRelationships: [
          {
            ...relation,
            from: 'svc:offers',
            to: 'st:private',
            toSystem: 'offers',
            kind: 'data',
            endpointId: null,
            via: 'st:private',
          },
        ],
      },
    });
    expect(edges).toEqual([]);
  });
  it('retains authored overview but projects initiating calls when either system opens', () => {
    const { view, systems } = fixture();
    const collapsed = areaCanvasEdges({ view, systems, expanded: new Set(), detail: 'all' });
    expect(collapsed.map((edge) => edge.id)).toEqual(['response']);
    const expanded = areaCanvasEdges({
      view,
      systems,
      expanded: new Set(['price']),
      detail: 'all',
    });
    expect(expanded).toHaveLength(1);
    expect(expanded[0]).toMatchObject({
      from: 'svc:offers',
      to: 'svc:price',
      endpointId: 'api:0',
      label: 'REST /items',
    });
    expect(expanded[0]?.relations?.[0]?.fromSystem).toBe('offers');
  });

  it('draws one line to a closed card and fans out to API groups once it opens', () => {
    const { view, systems, relation } = fixture();
    const price = systems[1]!;
    const target = price.componentBoxes[0]!;
    const endpoints = target.endpoints.map((endpoint, index) =>
      index === 1 ? { ...endpoint, signature: 'GET /prices/1' } : endpoint,
    );
    const calls = [
      relation,
      { ...relation, id: 'call-items', via: 'api:2', endpointId: 'api:2' },
      { ...relation, id: 'call-prices', via: 'api:1', endpointId: 'api:1', label: 'REST /prices' },
    ];
    const withCard = (open: boolean) =>
      systems.map((system) =>
        system.id === 'price'
          ? { ...system, componentBoxes: [{ ...target, endpoints, open, height: 400 }] }
          : system,
      );
    const options = {
      view: { ...view, technicalRelationships: calls },
      expanded: new Set(['offers', 'price']),
      detail: 'grouped' as const,
    };
    const closed = areaCanvasEdges({ ...options, systems: withCard(false) });
    expect(closed).toHaveLength(1);
    expect(closed[0]).toMatchObject({ label: 'Reads an item', to: 'svc:price' });
    expect(closed[0]?.relations).toHaveLength(3);
    const open = areaCanvasEdges({ ...options, systems: withCard(true) });
    expect(open.map((edge) => edge.label).toSorted((a, b) => a.localeCompare(b))).toEqual([
      'REST /items',
      'REST /prices',
    ]);
    expect(new Set(open.map((edge) => edge.path.split(' ').at(-1))).size).toBe(2);
  });

  it('routes every operation to its API group without changing anchors on selection', () => {
    const { view, systems, relation } = fixture();
    const options = {
      view,
      systems,
      expanded: new Set(['offers', 'price']),
      detail: 'all' as const,
    };
    const compact = areaCanvasEdges(options);
    const open = areaCanvasEdges({ ...options, selected: new Map([['price', 'svc:price']]) });
    expect(open[0]?.path).toBe(compact[0]?.path);
    expect(open[0]?.path).toMatch(/L 740,236$/u);
    const beyond = {
      ...view,
      technicalRelationships: [{ ...relation, via: 'api:8', endpointId: 'api:8' }],
    };
    const hidden = areaCanvasEdges({
      ...options,
      view: beyond,
      selected: new Map([['price', 'svc:price']]),
    });
    expect(hidden[0]?.path).toBe(compact[0]?.path);
    expect(hidden[0]?.endpointId).toBe('api:8');
    const unknown = areaCanvasEdges({
      ...options,
      view: {
        ...view,
        technicalRelationships: [{ ...relation, endpointId: 'api:unknown', via: 'api:unknown' }],
      },
    });
    expect(unknown[0]?.path).not.toBe(compact[0]?.path);
    expect(unknown[0]?.path).toMatch(/L 740,252$/u);
  });

  it('keeps opposite calls but reserves untargeted authored exchanges for collapsed systems', () => {
    const { view, systems, relation } = fixture();
    const revised = {
      ...view,
      relationships: [
        ...view.relationships,
        {
          id: 'event',
          from: 'offers',
          to: 'price',
          kind: 'message' as const,
          label: 'Offer changed',
          detail: 'Declared event.',
        },
      ],
      technicalRelationships: [
        relation,
        {
          ...relation,
          id: 'reverse',
          from: relation.to,
          to: relation.from,
          fromSystem: 'price',
          toSystem: 'offers',
        },
      ],
    };
    const edges = areaCanvasEdges({
      view: revised,
      systems,
      expanded: new Set(['offers', 'price']),
      detail: 'grouped',
    });
    expect(edges).toHaveLength(2);
    expect(edges.map((edge) => edge.id)).not.toContain('event');
    const overview = areaCanvasEdges({
      view: revised,
      systems,
      expanded: new Set(),
      detail: 'grouped',
    });
    expect(overview.map((edge) => edge.id)).toContain('event');
    expect(edges.flatMap((edge) => edge.relations ?? []).map((edge) => edge.id)).toEqual([
      'call-price',
      'reverse',
    ]);
  });

  it('retains every endpoint identity when calls are grouped', () => {
    const { view, systems, relation } = fixture();
    const revised = {
      ...view,
      technicalRelationships: [
        relation,
        { ...relation, id: 'second', via: 'api:1', endpointId: 'api:1' },
      ],
    };
    const edges = areaCanvasEdges({
      view: revised,
      systems,
      expanded: new Set(['offers', 'price']),
      detail: 'grouped',
    });

    expect(edges).toHaveLength(1);
    expect(edges[0]?.relations?.map((edge) => edge.endpointId)).toEqual(['api:0', 'api:1']);
    expect(edges[0]?.endpointId).toBeNull();
  });

  it('lands grouped external calls on components and API groups, never expanded boundaries', () => {
    const { view, systems } = fixture();
    const options = {
      view,
      systems,
      expanded: new Set(['offers', 'price']),
      detail: 'grouped' as const,
    };
    const grouped = areaCanvasEdges(options);
    expect(grouped[0]?.path).toMatch(/^M 400,252/u);
    expect(grouped[0]?.path).toMatch(/L 740,236$/u);
    expect(grouped[0]?.relations).toEqual(view.technicalRelationships);
    const selected = areaCanvasEdges({ ...options, selected: new Map([['price', 'svc:price']]) });
    expect(selected[0]?.path).toBe(grouped[0]?.path);
    expect(selected[0]?.relations).toEqual(view.technicalRelationships);
    const all = areaCanvasEdges({ ...options, detail: 'all' });
    expect(all[0]?.path).toBe(grouped[0]?.path);
  });

  it('keeps different component callers separate so their arrows remain specific', () => {
    const { view, systems, relation } = fixture();
    const caller = component('svc:other');
    const revised = {
      ...view,
      technicalRelationships: [relation, { ...relation, id: 'other-call', from: caller.id }],
    };
    const placed = systems.map((system) =>
      system.id === 'offers'
        ? {
            ...system,
            componentBoxes: [
              ...system.componentBoxes,
              {
                ...caller,
                x: 40,
                y: 450,
                width: 260,
                height: 112,
                rank: 0,
                compact: false,
                open: true,
              },
            ],
          }
        : system,
    );
    const options = {
      view: revised,
      systems: placed,
      expanded: new Set(['offers', 'price']),
      detail: 'grouped' as const,
    };
    const grouped = areaCanvasEdges(options);
    expect(grouped).toHaveLength(2);
    expect(grouped.flatMap((edge) => edge.relations ?? []).map((edge) => edge.from)).toEqual([
      'svc:offers',
      'svc:other',
    ]);
    const all = areaCanvasEdges({ ...options, detail: 'all' });
    expect(all).toHaveLength(2);
    expect(Math.abs(all[0]!.x - all[1]!.x) >= 120 || Math.abs(all[0]!.y - all[1]!.y) >= 18).toBe(
      true,
    );
  });
  it('keeps exact endpoint bindings on internal calls too', () => {
    const { view, systems, relation } = fixture();
    const price = systems[1]!;
    const caller = component('svc:price-reader');
    const placed = [
      {
        ...price,
        componentBoxes: [
          ...price.componentBoxes,
          {
            ...caller,
            x: 40,
            y: 450,
            width: 260,
            height: 112,
            rank: 0,
            compact: false,
            open: true,
          },
        ],
      },
    ];
    const internal = { ...relation, from: caller.id, fromSystem: 'price' };
    const revised = { ...view, relationships: [], technicalRelationships: [internal] };
    const edges = areaCanvasEdges({
      view: revised,
      systems: placed,
      expanded: new Set(['price']),
      selected: new Map([['price', 'svc:price']]),
      detail: 'all',
    });
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ from: caller.id, to: 'svc:price', endpointId: 'api:0' });
    expect(edges[0]?.relations).toEqual([internal]);
  });
});

describe('hidden narrative components', () => {
  it('does not redirect hidden component calls to an expanded system outline', () => {
    const { systems, view } = fixture();
    const hidden = systems.map((system) =>
      system.id === 'price' ? { ...system, componentBoxes: [] } : system,
    );
    expect(
      areaCanvasEdges({ view, systems: hidden, expanded: new Set(['price']), detail: 'grouped' }),
    ).toEqual([]);
    expect(
      areaCanvasEdges({ view, systems: hidden, expanded: new Set(['offers']), detail: 'grouped' }),
    ).toHaveLength(1);
  });
});
