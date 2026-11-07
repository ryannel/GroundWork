import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { parse, stringify } from 'yaml';

import type { WorkspaceModel } from '@/domain/workspace-model';
import { readModel } from '@/infrastructure/read-model';

import { areaBoundaryBoxes, areaBoundaryOf } from './area-map/boundaries';
import { platformComponents } from './area-map/platform';
import { unpackAreaMapView, packAreaMapView, packAreaMapOverview } from './area-map/transport';
import { valueFlowConnections } from './area-map/value-flow-connections';
import { valueFlowLayout } from './area-map/value-flow-layout';
import { modelAreaViewOf } from './model-area';
import { indexOf, type ModelIndex } from './model-index';
import { modelSystemMapInput } from './model-system-map-input';
import { modelValueFlowsOf } from './model-value-flows';
import { searchValueFlows } from './workspace-value-flows';

vi.mock(import('server-only'), () => ({}));
let root: string;
let model: WorkspaceModel;
let index: ModelIndex;
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'groundwork-model-area-'));
  const folder = path.join(root, 'model');
  await cp(path.resolve('test/fixtures/model'), folder, { recursive: true });
  await mkdir(path.join(folder, 'domains/orders/systems/unmapped'));
  await writeFile(
    path.join(folder, 'domains/orders/systems/unmapped/system.yaml'),
    'id: sys:unmapped\nname: Unmapped system\nmapped: false\n',
  );
  const file = path.join(folder, 'landscape.yaml');
  const source = parse(await readFile(file, 'utf8')) as Record<string, unknown>;
  await writeFile(
    file,
    stringify({
      ...source,
      details: [
        {
          area: 'area:orders',
          systems: ['sys:ordering'],
          relationships: [],
          collaborations: [],
          valueFlow: {
            title: 'Explain boundary work',
            summary: 'Synthetic fixture.',
            confidence: 'low',
            reasoning: 'Synthetic fixture.',
            limitations: [],
            bands: [
              {
                id: 'confirm',
                title: 'Confirm',
                summary: 'Recorded work',
                nodes: [
                  { component: 'svc:ordering', column: 0 },
                  { component: 'sys:unmapped', column: 1 },
                  { component: 'ext:payments', column: 2 },
                ],
              },
            ],
            connections: [
              {
                from: 'svc:ordering',
                to: 'sys:unmapped',
                label: 'Known system boundary',
                kind: 'api',
                backs: ['h:confirm#tx/save'],
                cites: ['ev:source'],
              },
              {
                from: 'sys:unmapped',
                to: 'ext:payments',
                label: 'Known external boundary',
                kind: 'api',
                cites: ['ev:source'],
              },
            ],
            overview: [
              {
                from: 'svc:ordering',
                to: 'sys:unmapped',
                label: 'Known system boundary',
                kind: 'api',
                backs: ['h:confirm#tx/save'],
                cites: ['ev:source'],
              },
            ],
            summaries: [
              {
                from: 'svc:ordering',
                to: 'sys:unmapped',
                label: 'Cited caption',
                kind: 'api',
                cites: ['ev:source'],
              },
            ],
          },
        },
      ],
    }),
  );
  const loaded = await readModel('model-fixture', root);
  if (loaded === null) throw new Error('Missing native area fixture');
  model = loaded;
  index = indexOf(model);
});
afterAll(async () => rm(root, { recursive: true }));

it('keeps system and external boundary anchors outside actual component placement', () => {
  const view = modelAreaViewOf(index, 'orders');
  expect(view?.boundaries?.map((node) => [node.id, node.boundaryKind])).toEqual([
    ['sys:unmapped', 'system'],
    ['ext:payments', 'external'],
  ]);
  const components = view?.systems.flatMap((system) => system.components) ?? [];
  expect(components.some((component) => component.id === 'sys:unmapped')).toBe(false);
  expect(components.some((component) => component.id === 'ext:payments')).toBe(false);
  expect(components.find((component) => component.id === 'svc:ordering')?.roles).toEqual([
    'api',
    'worker',
    'job',
  ]);
  expect(
    components.find((component) => component.id === 'st:unknown-owner')?.parentComponent,
  ).toBeUndefined();
  expect(view?.gaps).toContainEqual({
    id: 'sys:unmapped',
    kind: 'unmapped_implementation',
    message: 'The implementing components have not been mapped.',
  });
  expect(modelAreaViewOf(index, 'area:orders')).toEqual(view);
  expect(modelAreaViewOf(index, 'missing')).toBeNull();
});
it('retains authored bands, connections, captions and resolved citations through both map transports', () => {
  const view = modelAreaViewOf(index, 'orders');
  if (view?.valueFlow === undefined) throw new Error('Missing native flow');
  const source = model.landscape?.details?.[0]?.valueFlow;
  expect(view.valueFlow.bands).toEqual(source?.bands);
  expect(
    view.valueFlow.connections.map(({ evidence, ...connection }) => ({ connection, evidence })),
  ).toEqual(
    source?.connections.map((connection) => ({ connection, evidence: connection.backs ?? [] })),
  );
  expect(view.valueFlow.overview?.[0]?.cites).toEqual(source?.overview?.[0]?.cites);
  expect(view.valueFlow.summaries?.[0]?.label).toBe('Cited caption');
  expect(unpackAreaMapView(packAreaMapView(view))).toEqual(view);
  const overview = packAreaMapOverview(view);
  expect(overview.boundaries).toEqual(
    view.boundaries?.map((boundary) => ({
      ...boundary,
      repository: null,
      entries: [],
      citations: [],
      endpoints: [],
      resources: [],
      dependencies: [],
    })),
  );
  expect(overview.valueFlow).toEqual(view.valueFlow);
  const drawing = valueFlowLayout(view, view.valueFlow);
  for (const id of ['svc:ordering', 'sys:unmapped', 'ext:payments']) {
    expect(drawing.nodes.some((node) => node.members.includes(id))).toBe(true);
  }
  const connections = valueFlowConnections(
    view.valueFlow,
    drawing.nodes,
    view.technicalRelationships,
  );
  expect(connections.some((connection) => connection.label === 'Known system boundary')).toBe(true);
  expect(connections.some((connection) => connection.label === 'Known external boundary')).toBe(
    true,
  );
  expect({ drawing, connections }).toMatchSnapshot('band anchors and exact connection routing');
});
it('uses actual entries, SDK protocol, known API callers and recorded technical evidence', () => {
  const view = modelAreaViewOf(index, 'orders');
  const component = view?.systems
    .flatMap((system) => system.components)
    .find((node) => node.id === 'svc:ordering');
  expect(component?.entries?.map((entry) => entry.kind)).toEqual(
    expect.arrayContaining(['job', 'subscription']),
  );
  expect(component?.endpoints.find((endpoint) => endpoint.id === 'api:confirm')?.explorer).toBe(
    '/model-fixture/entries/?id=api-confirm',
  );
  expect(
    view?.boundaries?.find((boundary) => boundary.id === 'ext:payments')?.endpoints[0]?.protocol,
  ).toBe('sdk');
  expect(view?.technicalRelationships.every((edge) => edge.native !== undefined)).toBe(true);
  expect(view?.area.evidenceCount).toBe(1);
  expect(view?.technicalRelationships.map((edge) => edge.native?.site)).toEqual([
    'h:confirm#load',
    'h:confirm#tx/save',
    'h:confirm#lines/reserve',
    'h:confirm#enrich/order',
    'h:confirm#enrich/payment',
    'h:confirm#deliver/send',
    'h:click#submit',
    'sub:on-confirmed',
    'gql:order',
  ]);
  expect(view).toMatchSnapshot('recorded area, entry protocols, resource modes and evidence');
});
it('keeps the catalogue on the same bands and existing bare area filter/address', () => {
  const catalogue = modelValueFlowsOf(index);
  expect(catalogue[0]?.flows[0]?.id).toBe('confirm');
  expect(catalogue[0]?.flows[0]?.systems).toEqual(
    expect.arrayContaining(['Ordering', 'Unmapped system', 'Payments']),
  );
  expect(catalogue[0]?.flows[0]?.href).toBe(
    '/model-fixture/areas/orders/?flow=confirm#value-flow-map',
  );
  expect(searchValueFlows(catalogue, '', 'orders')).toEqual(catalogue);
  expect(searchValueFlows(catalogue, '', 'area:orders')).toEqual(catalogue);
  expect(catalogue).toMatchSnapshot('authored value-flow catalogue');
});

it('preserves an explicit infrastructure flag through the native area card and map transport', () => {
  const marked: WorkspaceModel = {
    ...model,
    domains: model.domains.map((domain) => ({
      ...domain,
      systems: domain.systems.map((system) => ({
        ...system,
        components: system.components.map((component) => {
          if (component.id === 'svc:ordering') return { ...component, infrastructure: true };
          if (component.id === 'st:unknown-owner') return { ...component, infrastructure: false };
          return component;
        }),
      })),
    })),
  };
  const view = modelAreaViewOf(indexOf(marked), 'orders');
  if (view === null) throw new Error('Missing marked native area');
  const cards = view.systems.flatMap((system) => system.components);
  expect(cards.find((component) => component.id === 'svc:ordering')?.infrastructure).toBe(true);
  expect(cards.find((component) => component.id === 'st:unknown-owner')).not.toHaveProperty(
    'infrastructure',
  );
  expect(platformComponents(view)).toEqual(new Set(['svc:ordering']));
  const transported = unpackAreaMapView(packAreaMapView(view));
  expect(platformComponents(transported)).toEqual(new Set(['svc:ordering']));
});

it('places external and unmapped boundaries below the systems without creating components', () => {
  const view = modelAreaViewOf(index, 'orders');
  const [system, external] = view?.boundaries ?? [];
  if (view === null || system === undefined || external === undefined) {
    throw new Error('Missing recorded boundary fixtures');
  }
  const boundaries = [
    system,
    external,
    { ...system, id: 'sys:another' },
    { ...external, id: 'ext:another' },
  ];
  const area = { ...view, boundaries };
  const systems = [{ id: 'sys:ordering', x: 80, y: 70, width: 400, height: 240, rank: 0 }];
  expect(areaBoundaryOf(area, 'ext:payments')).toBe(external);
  expect(areaBoundaryOf(area, 'ext:missing')).toBeUndefined();
  expect(areaBoundaryOf({ ...view, boundaries: [] }, 'ext:payments')).toBeUndefined();
  expect(areaBoundaryBoxes({ ...view, boundaries: [] }, systems)).toEqual([]);
  const boxes = areaBoundaryBoxes(area, systems);
  expect(boxes.map(({ boundary, ...box }) => ({ ...box, source: boundary.id }))).toMatchSnapshot(
    'four boundary cards, wrapping below the system',
  );
});

it('keeps the recorded call labels, resource directions and scope when opening an old component identity', () => {
  const scoped = modelSystemMapInput(index, { focus: ['svc:old-ordering'], lens: 'team:orders' });
  expect(scoped).toEqual(
    modelSystemMapInput(index, { focus: ['svc:ordering'], lens: 'team:orders' }),
  );
  expect(scoped.callWords).toMatchObject({
    'api:confirm': 'REST call',
    'api:charge': 'SDK call',
    'gql:order': 'GraphQL operation',
  });
  expect(scoped.carries?.['api:confirm']).toBe(index.label('sch:order'));
  expect(scoped.callWords).not.toHaveProperty('api:grpc-confirm');
  expect(index.edges('svc:ordering').some((edge) => edge.kind === 'causes')).toBe(true);
  expect(scoped.edges.some((edge) => edge.via === 'h:on-confirmed')).toBe(false);
  expect(
    scoped.edges.filter((edge) => edge.to === 'st:orders').map(({ read, write }) => [read, write]),
  ).toEqual([
    [true, false],
    [false, true],
    [true, false],
  ]);
  expect(scoped).toMatchSnapshot('cited map links, topic carries and canonical component focus');
});
