import { describe, expect, it } from 'vitest';

import type { AreaTechnicalRelationship, AreaView } from '@/application/workspace-area';

import { packAreaMapOverview, packAreaMapView, unpackAreaMapView } from './transport';
import { valueFlowConnections } from './value-flow-connections';
import { valueFlowLayout } from './value-flow-layout';

function viewWith(technicalRelationships: readonly AreaTechnicalRelationship[]): AreaView {
  return {
    workspace: { id: 'example', name: 'Example', href: '/' },
    area: {
      id: 'commercial',
      name: 'Commercial',
      purpose: 'Prepare offers.',
      activities: [],
      boundary: 'Mapped code only.',
      confidence: 'medium',
      evidenceCount: 1,
    },
    reviewed: '2026-10-30',
    scope: 'Commercial',
    limitation: 'Deployment is not established.',
    relationships: [],
    technicalRelationships,
    collaborations: [],
    systems: [
      {
        id: 'offers',
        name: 'Offers',
        purpose: 'Prepare offers.',
        href: '/',
        resources: [],
        components: ['Reader', 'Provider'].map((name) => ({
          id: name.toLowerCase(),
          name,
          kind: 'service',
          summary: '',
          explorer: null,
          repository: null,
          endpoints: [],
          resources: [],
          dependencies: [],
        })),
      },
    ],
  };
}

const call: AreaTechnicalRelationship = {
  id: 'technical:read',
  from: 'reader',
  to: 'provider',
  fromSystem: 'offers',
  toSystem: 'offers',
  kind: 'api',
  via: 'api:offers',
  endpointId: 'api:offers',
  label: 'GET /offers',
  detail:
    'Reader calls Provider at GET /offers. Direction follows the initiating request, not its response.',
  evidence: 'handler',
  evidenced: true,
};

describe('area map transport', () => {
  it('defers contracts while preserving collapsed geometry, purpose labels and qualified exchanges', () => {
    const base = viewWith([call]);
    const components = base.systems[0]!.components;
    const view: AreaView = {
      ...base,
      systems: components.map((component) => ({
        ...base.systems[0]!,
        id: component.id,
        components: [
          {
            ...component,
            endpoints:
              component.id === 'provider'
                ? [
                    {
                      id: 'api:offers',
                      signature: 'GET /offers',
                      summary: 'Find available offers. Conditional on the selected market.',
                      request: null,
                      response: null,
                      callers: [],
                      explorer: null,
                    },
                  ]
                : [],
          },
        ],
      })),
      valueFlow: {
        title: 'Offers to readers',
        summary: 'Read available offers.',
        confidence: 'medium',
        reasoning: 'Captured call.',
        limitations: [],
        bands: [
          {
            id: 'read',
            title: 'Read offers',
            summary: 'Find available offers.',
            nodes: [
              { component: 'reader', column: 0 },
              { component: 'provider', column: 1 },
            ],
          },
        ],
        connections: [],
      },
    };
    const overview = unpackAreaMapView(packAreaMapOverview(view));
    const original = valueFlowLayout(view, view.valueFlow!, new Set());
    const deferred = valueFlowLayout(overview, view.valueFlow!, new Set());
    expect(deferred.nodes).toEqual(
      original.nodes.map((node) => ({
        ...node,
        component: { ...node.component, endpoints: [] },
      })),
    );
    const compact = (source: AreaView, nodes: typeof original.nodes) =>
      valueFlowConnections(source.valueFlow!, nodes, source.technicalRelationships).map(
        ({ from, to, label, detail }) => ({ from, to, label, detail }),
      );
    expect(compact(overview, deferred.nodes)).toEqual(compact(view, original.nodes));
    expect(
      overview.systems.every((system) =>
        system.components.every((component) => component.endpoints.length === 0),
      ),
    ).toBe(true);
    expect(unpackAreaMapView(packAreaMapView(view))).toEqual(view);
  });

  it('reconstructs generated identities while retaining custom identities and qualifications', () => {
    const generated = {
      ...call,
      id: `technical:${call.kind}|${call.from}|${call.to}|${String(call.via)}`,
      detail: `${call.detail} Only enabled for selected markets.`,
    };
    const view = viewWith([generated, call]);
    const packed = packAreaMapView(view);
    expect(packed.technicalRelationships[0]).not.toHaveProperty('id');
    expect(packed.technicalRelationships[0]?.detail).toBe(generated.detail);
    expect(packed.technicalRelationships[1]?.id).toBe(call.id);
    expect(unpackAreaMapView(packed)).toEqual(view);
    expect(view.technicalRelationships[0]?.id).toBe(generated.id);
  });

  it.each([
    ['handler', call.detail],
    ['flow', call.detail],
    [
      'declared',
      'Reader calls Provider at GET /offers. Declared dependency; no captured call site.',
    ],
    [
      'configuration',
      'Configured graph routing: Reader calls Provider at GET /offers. This does not establish a call on every request.',
    ],
  ] as const)('restores every word of a %s API description', (evidence, detail) => {
    const view = viewWith([{ ...call, evidence, detail }]);
    const packed = packAreaMapView(view);
    expect(packed.technicalRelationships[0]).not.toHaveProperty('detail');
    expect(unpackAreaMapView(packed)).toEqual(view);
    expect(view.technicalRelationships[0]?.detail).toBe(detail);
  });

  it('keeps custom API context and non-API evidence unchanged', () => {
    const relations: readonly AreaTechnicalRelationship[] = [
      { ...call, detail: `${call.detail} Disabled in the captured production configuration.` },
      { ...call, kind: 'message', detail: 'Only configured markets receive this event.' },
      { ...call, kind: 'data', detail: 'Reads a shared cache; its owner does not write it.' },
      { ...call, kind: 'membership', detail: 'Membership does not establish live composition.' },
      {
        ...call,
        kind: 'message',
        detail:
          'Reader publishes Offer changed via Offers; Provider has a captured consumer. Delivery and deployed subscription state are not established.',
      },
      { ...call, detail: '' },
    ];
    const view = viewWith(relations);
    const packed = packAreaMapView(view);
    expect(packed.technicalRelationships).toEqual(relations);
    expect(unpackAreaMapView(packed)).toEqual(view);
  });

  it.each([
    ['data', 'Reads and writes'],
    ['message', 'Publishes Offer changed'],
    ['message', 'Consumes Offer changed'],
  ] as const)('restores standard %s access details for %s', (kind, label) => {
    const detail = `Reader → Provider: ${label}. Modelled access; deployed behaviour is not established.`;
    const view = viewWith([
      { ...call, kind, label, detail, evidenced: false, evidence: 'declared' },
    ]);
    const packed = packAreaMapView(view);
    expect(packed.technicalRelationships[0]).not.toHaveProperty('detail');
    expect(unpackAreaMapView(packed)).toEqual(view);
  });

  it('retains descriptions whose participants are outside the transported component lookup', () => {
    const view = viewWith([{ ...call, from: 'outside' }]);
    const packed = packAreaMapView(view);
    expect(packed.technicalRelationships).toEqual(view.technicalRelationships);
    expect(unpackAreaMapView(packed)).toEqual(view);
  });

  it('rejects incomplete transport instead of dropping a connection qualification', () => {
    const payload = packAreaMapView(viewWith([call]));
    expect(() => unpackAreaMapView({ ...payload, systems: [] })).toThrow(
      'Missing connection detail: technical:read',
    );
  });
});
