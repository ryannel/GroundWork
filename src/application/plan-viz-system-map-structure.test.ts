import { describe, expect, it } from 'vitest';

import { stagedDeliveryTime } from '@/../test/fixtures/acme/plans/contracts-plans';
import { modelOf } from '@/../test/plan-kit';

import { drawSystemMap, SHOW_ALL, SHOW_OVERVIEW } from './plan-viz-system-map';
import { systemMapInput } from './plan-viz-system-map-input';
import { structureMapInput } from './plan-viz-system-map-structure';

const fixture = () => systemMapInput(modelOf(stagedDeliveryTime()));

function pairedSystem() {
  const input = fixture();
  const system = input.systems.find(
    (candidate) => input.services.filter((service) => service.system === candidate.id).length > 1,
  );
  if (system === undefined) throw new Error('The fixture needs a system with several components');
  const [first, second] = input.services.filter((service) => service.system === system.id);
  if (first === undefined || second === undefined) throw new Error('Missing components');
  return { input, system, first, second };
}

describe('system structure arrangement', () => {
  it('groups components that were split across stages while preserving the model and scope', () => {
    const { input, system, first, second } = pairedSystem();
    const staged = { ...input, stageOf: { ...input.stageOf, [first.id]: 0, [second.id]: 1 } };
    const arranged = structureMapInput(staged);
    expect(arranged.stages).toEqual([]);
    expect(arranged.stageOf[first.id]).toBe(arranged.stageOf[second.id]);
    expect(arranged.services).toBe(staged.services);
    expect(arranged.stores).toBe(staged.stores);
    expect(arranged.edges).toBe(staged.edges);
    expect(arranged.steps).toBe(staged.steps);
    expect(arranged.refs).toBe(staged.refs);
    expect(arranged.labels).toBe(staged.labels);
    expect(arranged.focus).toBe(staged.focus);
    expect(staged.stages.length).toBeGreaterThan(0);
    const drawing = drawSystemMap(arranged, { show: SHOW_OVERVIEW });
    expect(drawing?.nodes.find((node) => node.id === system.id)?.folded).toBe(true);
    expect(drawing?.nodes.some((node) => node.id === first.id || node.id === second.id)).toBe(
      false,
    );
    expect(drawing?.bands).toEqual([]);
  });

  it('reveals internal connections and keeps resources within their expanded system', () => {
    const { input, system, first, second } = pairedSystem();
    const arranged = structureMapInput({
      ...input,
      edges: [
        ...input.edges,
        {
          kind: 'api',
          from: first.id,
          to: second.id,
          via: null,
          steps: [],
          read: false,
          write: false,
        },
      ],
    });
    const expanded = drawSystemMap(arranged, { show: SHOW_ALL });
    expect(expanded?.lines.some((line) => line.a === first.id && line.b === second.id)).toBe(true);
    const resources = input.stores.filter((resource) =>
      input.services.some(
        (service) => service.id === resource.owner && service.system === system.id,
      ),
    );
    expect(resources.length).toBeGreaterThan(0);
    const boundary = expanded?.nodes.find((node) => node.id === system.id);
    if (boundary === undefined) throw new Error('Missing system boundary');
    for (const resource of resources) {
      const card = expanded?.nodes.find((node) => node.id === resource.id);
      if (card === undefined) throw new Error(`Missing ${resource.id}`);
      expect(card.system).toBe(system.id);
      expect(card.x).toBeGreaterThan(boundary.x);
      expect(card.x + card.w).toBeLessThan(boundary.x + boundary.w);
      expect(card.y + card.h).toBeLessThan(boundary.y + boundary.h);
    }
    const folded = drawSystemMap(arranged, { show: SHOW_ALL, flip: new Set([system.id]) });
    expect(folded?.nodes.find((node) => node.id === system.id)?.folded).toBe(true);
    expect(
      folded?.nodes.some((node) => resources.some((resource) => resource.id === node.id)),
    ).toBe(false);
    expect(folded?.lines.some((line) => line.a === system.id && line.b === system.id)).toBe(false);
  });

  it('retains unassigned components and shared external components without inventing a system', () => {
    const { input, system, first } = pairedSystem();
    const extra = [
      { ...first, id: 'svc:unassigned', system: null },
      { ...first, id: 'svc:unknown', system: 'sys:not-recorded' },
      { ...first, id: 'svc:external', kind: 'external', system: system.id },
    ];
    const arranged = structureMapInput({
      ...input,
      services: [...input.services, ...extra],
      edges: [
        ...input.edges,
        {
          kind: 'api',
          from: 'svc:unassigned',
          to: 'svc:external',
          via: null,
          steps: [],
          read: false,
          write: false,
        },
      ],
    });
    const drawing = drawSystemMap(arranged, { show: SHOW_OVERVIEW });
    expect(drawing?.nodes.find((node) => node.id === 'svc:unassigned')?.kind).toBe('service');
    expect(drawing?.nodes.find((node) => node.id === 'svc:unknown')?.kind).toBe('service');
    expect(drawing?.nodes.some((node) => node.id === 'sys:not-recorded')).toBe(false);
    expect(drawing?.nodes.some((node) => node.id === 'svc:external')).toBe(false);
    expect(
      drawSystemMap(arranged, { show: SHOW_ALL })?.nodes.find((node) => node.id === 'svc:external')
        ?.system,
    ).toBe(system.id);
  });

  it('accepts an empty scope', () => {
    const arranged = structureMapInput({
      ...fixture(),
      services: [],
      systems: [],
      stores: [],
      edges: [],
    });
    expect(arranged.stageOf).toEqual({});
    expect(drawSystemMap(arranged, { show: SHOW_OVERVIEW })).toBeNull();
  });
});
