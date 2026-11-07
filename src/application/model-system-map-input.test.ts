import { describe, expect, it } from 'vitest';

import { emptyQueryModel, queryModel } from '@/../test/fixtures/model-queries';
import { indexOf } from '@/application/model-index';
import { plansIndex } from '@/application/plans-index';
import type { ModelPlan, ModelSystem, WorkspaceModel } from '@/domain/workspace-model';

import { modelSystemMapInput, modelSystemMapWire } from './model-system-map-input';
import { unpackModelSystemMap } from './model-system-map-transport';
import { drawSystemMap, SHOW_ALL, SHOW_OVERVIEW } from './plan-viz-system-map';
import { aggregate } from './plan-viz-system-map-links';

function unmapped(): ModelSystem {
  return {
    id: 'sys:unknown',
    name: 'Known boundary',
    mapped: false,
    purpose: 'Accepts a known request; implementation is not mapped.',
    components: [],
    interfaces: [],
    messages: [],
    subscriptions: [],
    jobs: [],
    interactions: [],
    operations: [],
    schemas: [],
    screens: [],
    handlers: [],
    narratives: null,
  };
}
function fixture(): WorkspaceModel {
  const base = queryModel();
  return {
    ...base,
    domains: base.domains.map((domain) => ({
      ...domain,
      systems: [
        ...domain.systems.map((system): ModelSystem => {
          if (system.id !== 'sys:a') return system;
          return {
            ...system,
            interfaces: [
              ...system.interfaces,
              {
                id: 'if:unknown',
                kind: 'rest',
                system: 'sys:unknown',
                entries: [{ id: 'api:unknown', method: 'POST', path: '/known' }],
              },
            ],
            handlers: system.handlers.map((handler) => ({
              ...handler,
              steps: [
                ...handler.steps,
                { id: 'unknown', call: 'api:unknown', cites: handler.cites ?? [] },
              ],
            })),
          };
        }),
        unmapped(),
      ],
    })),
  };
}
describe('native system-map input', () => {
  it('keeps exact native exchanges, backings and gaps without manufacturing components or owners', () => {
    const model = fixture();
    const before = JSON.stringify(model);
    const index = indexOf(model);
    const input = modelSystemMapInput(index);
    expect(index.edges('svc:a')).toContainEqual(
      expect.objectContaining({ to: 'sys:unknown', via: 'api:unknown', site: 'h:a#unknown' }),
    );
    expect(input.systems.find((system) => system.id === 'sys:unknown')).toMatchObject({
      mapped: false,
      parts: 0,
      stores: 0,
    });
    expect(input.services.some((node) => node.id === 'sys:unknown')).toBe(false);
    expect(input.interfaceOf['api:unknown']).toBe('if:unknown');
    expect(index.get('if:unknown')?.data.system).toBe('sys:unknown');
    expect(input.edges).toContainEqual(
      expect.objectContaining({
        from: 'svc:a',
        to: 'sys:unknown',
        kind: 'api',
        via: 'api:unknown',
      }),
    );
    expect(input.placement).toMatchObject({
      'st:remote': 'sys:b',
      'top:remote': 'sys:b',
      'ext:supplier': null,
    });
    expect(input.stores.find((node) => node.id === 'st:remote')?.owner).toBe('svc:a');
    expect(input.stores.find((node) => node.id === 'top:remote')?.owner).toBeNull();
    const aggregated = aggregate(input, SHOW_ALL);
    expect(aggregated.hostOfSat.get('st:remote')).toBe('sys:b');
    expect(aggregated.hostOfSat.get('top:remote')).toBe('sys:b');
    expect(index.gaps('api:unknown')).toContainEqual(
      expect.objectContaining({ id: 'api:unknown', kind: 'unmapped_target' }),
    );
    expect(index.gaps('api:unknown')).toContainEqual(
      expect.objectContaining({ id: 'api:unknown', kind: 'no_handler' }),
    );
    const serialised = JSON.stringify(input);
    expect(JSON.parse(serialised)).toEqual(input);
    expect(JSON.stringify(model)).toBe(before);
  });
  it('round-trips the overview and expanded drawing without losing edge occurrences', () => {
    const index = indexOf(fixture());
    const options = { focus: ['sys:a'] };
    const complete = modelSystemMapInput(index, options);
    const wire = modelSystemMapWire(index, options);
    const restored = unpackModelSystemMap(wire);
    expect(restored.edges).toEqual(complete.edges);
    expect(restored.services).toEqual(complete.services);
    expect(restored.stores).toEqual(complete.stores);
    for (const show of [SHOW_OVERVIEW, SHOW_ALL]) {
      expect(drawSystemMap(restored, { show })).toEqual(drawSystemMap(complete, { show }));
    }
    expect(JSON.stringify(wire)).not.toContain('h:a#unknown');
    expect(index.cites('h:a#unknown').length).toBeGreaterThan(0);
  });
  it('uses the same authored colour and one-based fallback slots as existing maps', () => {
    const model = fixture();
    const input = modelSystemMapInput(
      indexOf({
        ...model,
        teams: [
          { id: 'team:a', name: 'A', colour: 13 },
          { id: 'team:b', name: 'B' },
        ],
      }),
    );
    expect(input.services.find((node) => node.id === 'svc:a')?.teamSlot).toBe(13);
    expect(input.services.find((node) => node.id === 'svc:b')?.teamSlot).toBe(2);
    expect(input.systems.find((node) => node.id === 'sys:a')?.teamSlot).toBe(13);
  });
  it('draws unmapped providers as systems and resources in their recorded containing system', () => {
    const input = modelSystemMapInput(indexOf(fixture()));
    const drawing = drawSystemMap(input, { show: SHOW_ALL });
    expect(drawing?.nodes.find((node) => node.id === 'sys:unknown')).toMatchObject({
      kind: 'system',
      partCount: 0,
      size: 'Implementation not mapped',
    });
    expect(drawing?.lines).toContainEqual(
      expect.objectContaining({ a: 'svc:a', b: 'sys:unknown' }),
    );
    expect(drawing?.nodes.find((node) => node.id === 'ext:supplier')).toMatchObject({
      external: true,
      system: null,
    });
    expect(drawing?.nodes.find((node) => node.id === 'st:remote')).toMatchObject({
      kind: 'store',
      system: 'sys:b',
      host: 'sys:b',
    });
    expect(drawing?.nodes.find((node) => node.id === 'top:remote')).toMatchObject({
      kind: 'topic',
      system: 'sys:b',
      host: 'sys:b',
    });
    const folded = drawSystemMap(input, { show: SHOW_OVERVIEW });
    expect(folded?.nodes.find((node) => node.id === 'sys:unknown')?.size).toBe(
      'Implementation not mapped',
    );
  });
  it('uses the same projection for selected before and after indexes without altering current facts', () => {
    const model = fixture();
    const before = JSON.stringify(model);
    const plan: ModelPlan = {
      meta: { id: 'plan:new', title: 'Add a component' },
      problem: { summary: 'A proposed component is needed.' },
      changes: [
        {
          id: 'chg:new',
          title: 'Add',
          ops: [
            {
              add: 'component',
              into: 'sys:a',
              value: { id: 'svc:new', kind: 'service', name: 'New component' },
            },
          ],
        },
      ],
    };
    const selected = plansIndex([plan], model).plans[0];
    if (selected === undefined) throw new Error('Missing projection');
    expect(
      modelSystemMapInput(selected.beforeIndex).services.some((node) => node.id === 'svc:new'),
    ).toBe(false);
    expect(
      modelSystemMapInput(selected.afterIndex).services.find((node) => node.id === 'svc:new')
        ?.system,
    ).toBe('sys:a');
    expect(JSON.stringify(model)).toBe(before);
  });
  it('bounds scope to recorded neighbours and never turns narrative-only flow into execution', () => {
    const base = fixture();
    const lonely: ModelSystem = {
      ...unmapped(),
      id: 'sys:unrelated',
      name: 'Unrelated',
      mapped: true,
      components: [{ id: 'svc:unrelated', name: 'Unrelated', kind: 'service' }],
    };
    const model: WorkspaceModel = {
      ...base,
      domains: base.domains.map((domain) => ({ ...domain, systems: [...domain.systems, lonely] })),
      flows: [
        {
          id: 'flow:story',
          name: 'Narrated collaboration',
          steps: [
            {
              id: 'only-story',
              from: 'svc:a',
              to: 'svc:unrelated',
              action: 'A narrative, without execution backing',
            },
          ],
        },
      ],
    };
    const input = modelSystemMapInput(indexOf(model), { focus: ['sys:a'] });
    expect(input.services.some((node) => node.id === 'svc:unrelated')).toBe(false);
    expect(input.systems.some((node) => node.id === 'sys:unrelated')).toBe(false);
    expect(input.labels).not.toHaveProperty('svc:unrelated');
    expect(input.steps).toEqual([]);
    expect(input.stages).toEqual([]);
    expect(input.edges.some((edge) => edge.to === 'svc:unrelated')).toBe(false);
    expect(
      drawSystemMap(input, { show: SHOW_ALL })?.lines.some((line) => line.b === 'svc:unrelated'),
    ).toBe(false);
  });
  it('retains an unmapped-only system without inventing a deployable to make it draw', () => {
    const model: WorkspaceModel = {
      ...emptyQueryModel(),
      domains: [
        { id: 'dom:one', name: 'One', language: null, target: null, systems: [unmapped()] },
      ],
    };
    const input = modelSystemMapInput(indexOf(model));
    expect(input.services).toEqual([]);
    const drawing = drawSystemMap(input, { show: SHOW_ALL });
    expect(drawing?.nodes).toContainEqual(
      expect.objectContaining({
        id: 'sys:unknown',
        kind: 'system',
        size: 'Implementation not mapped',
      }),
    );
  });
});
