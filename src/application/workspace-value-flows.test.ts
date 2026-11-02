import { describe, expect, it } from 'vitest';

import { acme } from '@/../test/workspace-kit';
import type { AuthoredLandscape, LandscapeValueFlow } from '@/domain/landscape';

import { searchValueFlows, workspaceValueFlowsOf } from './workspace-value-flows';

const flow: LandscapeValueFlow = {
  title: 'Publish and use',
  summary: 'Inputs become available.',
  confidence: 'medium',
  reasoning: 'Recorded model.',
  limitations: [],
  bands: [
    {
      id: 'publish-offers',
      title: 'Make offers available',
      summary: 'Publish offer changes for customers.',
      nodes: [{ component: 'svc:shop-bff', column: 0 }],
    },
  ],
  connections: [],
};
const landscape: AuthoredLandscape = {
  label: 'Inferred',
  reviewed: '2026-11-02',
  scope: 'Mapped systems.',
  limitation: 'Partial source coverage.',
  relationships: [],
  areas: ['sell', 'renew'].map((id) => ({
    id,
    name: id === 'sell' ? 'Set prices and market offers' : 'Renew an agreement',
    purpose: 'Prepare useful offers.',
    activities: [],
    boundary: '',
    confidence: 'medium',
    evidenceCount: 1,
  })),
  details: ['sell', 'renew'].map((area) => ({
    area,
    systems: ['shop', 'products'],
    collaborations: [],
    relationships: [],
    valueFlow:
      area === 'sell'
        ? flow
        : {
            ...flow,
            bands: [
              {
                ...flow.bands[0]!,
                title: 'Renew an offer',
                summary: 'Continue an existing agreement.',
              },
            ],
          },
  })),
};

describe('value-flow discovery', () => {
  it('reuses validated bands and keeps same-named IDs scoped to their area', () => {
    const { workspace, today } = acme();
    const areas = workspaceValueFlowsOf(workspace, today.model, landscape);
    expect(areas).toHaveLength(2);
    expect(areas[0]?.flows[0]).toMatchObject({
      id: 'publish-offers',
      title: 'Make offers available',
      systems: ['Shop'],
      href: '/acme/areas/sell/?flow=publish-offers#value-flow-map',
    });
    expect(areas[1]?.flows[0]?.href).toBe('/acme/areas/renew/?flow=publish-offers#value-flow-map');
  });

  it('finds work by title, outcome and system without knowing the area', () => {
    const { workspace, today } = acme();
    const areas = workspaceValueFlowsOf(workspace, today.model, landscape);
    expect(searchValueFlows(areas, '"MAKE offers available"')[0]?.flows[0]?.title).toBe(
      'Make offers available',
    );
    expect(searchValueFlows(areas, 'continue agreement')[0]?.id).toBe('renew');
    expect(searchValueFlows(areas, 'shop')).toHaveLength(2);
    expect(searchValueFlows(areas, '', 'renew').map((area) => area.id)).toEqual(['renew']);
    expect(searchValueFlows(areas, 'make available', 'renew')).toEqual([]);
    expect(searchValueFlows(areas, 'something unmapped')).toEqual([]);
  });

  it('omits unavailable or invalid map targets instead of advertising broken diagrams', () => {
    const { workspace, today } = acme();
    expect(workspaceValueFlowsOf(workspace, today.model, null)).toEqual([]);
    const invalid = {
      ...landscape,
      details: landscape.details.map((detail) => ({
        ...detail,
        valueFlow: {
          ...flow,
          bands: [{ ...flow.bands[0]!, nodes: [{ component: 'svc:missing', column: 0 }] }],
        },
      })),
    };
    expect(workspaceValueFlowsOf(workspace, today.model, invalid)).toEqual([]);
  });
});
