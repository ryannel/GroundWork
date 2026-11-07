import { describe, expect, it } from 'vitest';

import { queryModel, systemProviderModel } from '@/../test/fixtures/model-queries';
import { indexOf } from '@/application/model-index';
import type { ModelSystem, WorkspaceModel } from '@/domain/workspace-model';

import { modelCatalogueOf } from './model-catalogue';

function providerFixture(): WorkspaceModel {
  const model = systemProviderModel();
  const original = model.domains[0];
  if (original === undefined) throw new Error('Missing domain');
  return {
    ...model,
    domains: [
      { ...original, systems: original.systems.filter((system) => system.id !== 'sys:unmapped') },
      {
        ...original,
        id: 'dom:unknown',
        name: 'Known boundary',
        systems: original.systems.filter((system) => system.id === 'sys:unmapped'),
      },
    ],
  };
}
describe('native catalogues', () => {
  it('groups entries under their actual providers, independently of the consuming contract file', () => {
    const index = indexOf(providerFixture());
    const consumer = modelCatalogueOf(index, new Set(['sys:a']));
    expect(consumer.apis.map((row) => row.head.id)).toEqual(['svc:a']);
    expect(consumer.apis[0]?.items.map((item) => item.id)).toEqual(['api:a']);
    const boundary = modelCatalogueOf(index, new Set(['sys:unmapped']));
    expect(boundary.apis[0]).toMatchObject({
      head: { id: 'sys:unmapped' },
      note: 'Implementation not mapped.',
      items: [{ id: 'api:unmapped-api' }],
    });
    const supplier = modelCatalogueOf(index, new Set(['ext:supplier']));
    expect(supplier.apis[0]?.items.map((item) => item.id)).toEqual(['api:supplier']);
    expect(consumer.apis.flatMap((row) => row.items.map((item) => item.id))).not.toContain(
      'api:supplier',
    );
  });

  it('uses native message bindings and keeps stores in their containing system despite a different cited owner', () => {
    const model = queryModel();
    const before = JSON.stringify(model);
    const index = indexOf(model);
    const producer = modelCatalogueOf(index, new Set(['sys:a']));
    expect(producer.events[0]).toMatchObject({
      head: { id: 'msg:remote' },
      note: 'From A',
      items: [{ id: 'svc:b' }],
    });
    expect(producer.data).toEqual([]);
    const placed = modelCatalogueOf(index, new Set(['sys:b']));
    expect(placed.events).toEqual([]);
    expect(placed.data[0]).toMatchObject({
      head: { id: 'st:remote' },
      note: 'Kept by A',
      items: [{ id: 'sch:remote' }],
    });
    expect(placed.data.some((row) => row.head.id === 'top:remote')).toBe(false);
    expect(JSON.stringify(model)).toBe(before);
  });

  it('keeps an uncited owner unknown and a message with no execution bindings visibly incomplete', () => {
    const model = queryModel();
    const amended: WorkspaceModel = {
      ...model,
      domains: model.domains.map((domain) => ({
        ...domain,
        systems: domain.systems.map((system): ModelSystem =>
          system.id === 'sys:b'
            ? {
                ...system,
                components: [
                  ...system.components,
                  {
                    id: 'st:unknown',
                    kind: 'store',
                    name: 'Unknown store',
                    does: 'Keeps example records',
                    owner: { id: 'svc:b', cites: [] },
                  },
                ],
                messages: [...system.messages, { id: 'msg:unknown', topic: 'top:remote' }],
              }
            : system,
        ),
      })),
    };
    const catalogue = modelCatalogueOf(indexOf(amended), new Set(['sys:b']));
    expect(catalogue.data.find((row) => row.head.id === 'st:unknown')?.note).toBe(
      'Keeps example records; Owner not identified',
    );
    expect(catalogue.events.find((row) => row.head.id === 'msg:unknown')).toMatchObject({
      note: 'Publisher not identified; no recorded consumers',
      items: [],
    });
  });
});
