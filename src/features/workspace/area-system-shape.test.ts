import { describe, expect, it } from 'vitest';

import type { AreaSystemView } from '@/application/workspace-area';

import { systemShape } from './area-system-shape';

describe('expanded system space', () => {
  const system: AreaSystemView = {
    id: 'offers',
    name: 'Offers',
    purpose: 'Prepare offers.',
    href: '/cars/offers/',
    resources: [],
    components: Array.from({ length: 13 }, (_, index) => ({
      id: `svc:${String(index)}`,
      name: `Component ${String(index)}`,
      kind: 'service',
      summary: 'A component with a two-line description.',
      explorer: null,
      repository: null,
      endpoints: [],
      resources: [],
      dependencies:
        index === 12
          ? []
          : [
              {
                id: `svc:${String(index + 1)}`,
                name: 'Next component',
                system: 'offers',
                systemName: 'Offers',
                endpointId: null,
                endpoint: null,
              },
            ],
    })),
  };

  it('shows the entire overview without changing technical direction', () => {
    const story = {
      id: 'story',
      name: 'Prepare',
      summary: 'Prepare inputs.',
      confidence: 'medium' as const,
      reasoning: 'Evidence.',
      limitations: [],
      stages: [3, 0].map((index) => ({
        component: `svc:${String(index)}`,
        title: 'Prepare',
        summary: 'Prepare.',
        supporting: index === 3 ? ['svc:4'] : [],
        evidence: ['flow:prepare'],
      })),
    };
    const shape = systemShape(system, new Set(), story);
    expect(shape.components.slice(0, 3).map((component) => component.id)).toEqual([
      'svc:3',
      'svc:4',
      'svc:0',
    ]);
    expect(shape.relationships).toContainEqual(
      expect.objectContaining({ from: 'svc:3', to: 'svc:4' }),
    );
    const supported = shape;
    expect(supported.components).toHaveLength(system.components.length);
    expect(supported.components.slice(0, 3).every((component) => component.overview === true)).toBe(
      true,
    );
    expect(supported.components.find((component) => component.id === 'svc:4')!.y).toBeGreaterThan(
      shape.components[0]!.y,
    );
  });

  it('reads left to right and wraps a long chain into bands rather than stretching it', () => {
    const shape = systemShape(system);
    const rank = (value: number) => shape.components.find((component) => component.rank === value)!;
    expect(shape.width).toBeLessThan(2600);
    expect(shape.components).toHaveLength(13);
    expect(shape.relationships).toHaveLength(12);
    expect(rank(1).x).toBeGreaterThan(rank(0).x + rank(0).width + 150);
    expect(rank(1).y).toBe(rank(0).y);
    expect(rank(5).x).toBe(rank(0).x);
    expect(rank(5).y).toBeGreaterThan(rank(0).y + rank(0).height);
    for (const component of shape.components) {
      expect(component.x + component.width).toBeLessThan(shape.width);
      expect(component.y + component.height).toBeLessThan(shape.height);
      expect(component.height).toBeGreaterThanOrEqual(94);
      for (const other of shape.components.filter((candidate) => candidate.id !== component.id)) {
        expect(
          component.x + component.width <= other.x ||
            other.x + other.width <= component.x ||
            component.y + component.height <= other.y ||
            other.y + other.height <= component.y,
        ).toBe(true);
      }
    }
  });

  it('keeps private resource identities inside a correctly sized service card', () => {
    const service = system.components[0]!;
    const resource = {
      ...service,
      id: 'st:private',
      kind: 'database' as const,
      dependencies: [],
      parentComponent: service.id,
    };
    const shape = systemShape({ ...system, components: [service, resource] });
    expect(shape.components).toHaveLength(1);
    expect(shape.components[0]?.attachments).toEqual([resource]);
    expect(shape.components[0]?.open).toBe(false);
    expect(shape.components[0]?.height).toBe(156);
    const opened = systemShape(
      { ...system, components: [service, resource] },
      new Set([service.id]),
    );
    expect(opened.components[0]?.open).toBe(true);
    expect(opened.components[0]?.height).toBe(192);
    expect(shape.relationships).toEqual([]);
    const outsideOwner = systemShape({
      ...system,
      components: [{ ...resource, parentComponent: 'svc:outside' }],
    });
    expect(outsideOwner.components[0]?.id).toBe(resource.id);
  });
});
