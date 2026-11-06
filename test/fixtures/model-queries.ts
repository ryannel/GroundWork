// Synthetic containment and execution cases, not company claims.
import type { ModelCite, ModelSystem, WorkspaceModel } from '@/domain/workspace-model';

const cite: ModelCite = {
  kind: 'code',
  repo: 'fixture/a',
  commit: 'a'.repeat(40),
  path: 'example.ts',
  lines: [1, 2],
};
const system = (id: string, name: string): ModelSystem => ({
  id,
  name,
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
});
export function emptyQueryModel(): WorkspaceModel {
  return {
    id: 'queries',
    name: 'Query fixture',
    domains: [],
    libraries: [],
    externals: [],
    graphs: [],
    flows: [],
    journeys: [],
    programmes: [],
    language: null,
    landscape: null,
    aliases: {},
    evidence: [],
    problems: [],
  };
}
export function queryModel(): WorkspaceModel {
  return {
    ...emptyQueryModel(),
    teams: [
      { id: 'team:a', name: 'A' },
      { id: 'team:b', name: 'B' },
    ],
    externals: [{ id: 'ext:supplier', name: 'Supplier' }],
    domains: [
      {
        id: 'dom:queries',
        name: 'Queries',
        language: null,
        target: null,
        systems: [
          {
            ...system('sys:a', 'A'),
            team: 'team:a',
            homes: { a: { repo: 'fixture/a' } },
            components: [{ id: 'svc:a', kind: 'service', name: 'A', homes: ['a'] }],
            interfaces: [
              {
                id: 'if:a',
                kind: 'rest',
                component: 'svc:a',
                entries: [{ id: 'api:a', method: 'GET', path: '/a' }],
              },
              {
                id: 'if:supplier',
                kind: 'sdk',
                external: 'ext:supplier',
                entries: [{ id: 'api:supplier', call: 'Supplier.load' }],
              },
            ],
            connections: [{ to: 'sys:b', says: 'Publishes to B', backs: ['h:a'] }],
            handlers: [
              {
                id: 'h:a',
                component: 'svc:a',
                on: 'api:a',
                cites: [cite],
                steps: [
                  { id: 'read', read: 'sch:remote#id', from: 'st:remote', cites: [cite] },
                  { id: 'write', write: 'sch:remote#id', to: 'st:remote', cites: [cite] },
                  { id: 'publish', publish: 'msg:remote', cites: [cite] },
                  { id: 'call', call: 'api:supplier', cites: [cite] },
                ],
              },
            ],
            relationships: [
              {
                id: 'rel:consume',
                from: 'svc:a',
                to: 'top:remote',
                kind: 'consume',
                says: 'Registers a topic consumer',
                reason: 'Only topic registration is recorded; no message binding is known.',
                cites: [cite],
              },
            ],
          },
          {
            ...system('sys:b', 'B'),
            team: 'team:b',
            homes: { b: { repo: 'fixture/b', path: 'worker' } },
            components: [
              { id: 'svc:b', kind: 'service', name: 'B' },
              {
                id: 'st:remote',
                kind: 'store',
                form: 'database',
                name: 'Remote',
                owner: { id: 'svc:a', cites: [cite] },
              },
              { id: 'top:remote', kind: 'topic', form: 'stream', name: 'Events' },
            ],
            schemas: [
              {
                id: 'sch:remote',
                kind: 'record',
                store: 'st:remote',
                fields: [{ id: 'id', name: 'id', type: 'string' }],
              },
            ],
            messages: [{ id: 'msg:remote', topic: 'top:remote', payload: 'sch:remote' }],
            subscriptions: [{ id: 'sub:b', component: 'svc:b', message: 'msg:remote' }],
            jobs: [{ id: 'job:b', component: 'svc:b' }],
            relationships: [
              {
                id: 'rel:read',
                from: 'svc:b',
                to: 'st:remote',
                kind: 'read',
                says: 'Configures read access',
                reason: 'Only configuration is recorded.',
                cites: [cite],
              },
              {
                id: 'rel:boundary',
                from: 'svc:b',
                to: 'sys:unmapped',
                kind: 'call',
                says: 'Registers an unmapped client',
                reason: 'No target component is recorded.',
                cites: [cite],
              },
            ],
          },
          { ...system('sys:unmapped', 'Unmapped'), mapped: false },
        ],
      },
    ],
  };
}

/** Synthetic client evidence names a system whose implementation has not been mapped. */
export function systemProviderModel(provider = 'sys:unmapped'): WorkspaceModel {
  const model = queryModel();
  return {
    ...model,
    domains: model.domains.map((domain) => ({
      ...domain,
      systems: domain.systems.map((item): ModelSystem =>
        item.id === 'sys:a'
          ? {
              ...item,
              connections: (item.connections ?? []).map((connection) => ({
                ...connection,
                backs: ['h:a#publish'],
              })),
              interfaces: [
                ...item.interfaces,
                {
                  id: 'if:unmapped-api',
                  kind: 'rest',
                  system: provider,
                  entries: [{ id: 'api:unmapped-api', method: 'GET', path: '/known' }],
                  cites: [cite],
                },
              ],
              handlers: item.handlers.map((handler) => ({
                ...handler,
                steps: [
                  ...handler.steps,
                  { id: 'call-unmapped', call: 'api:unmapped-api', cites: [cite] },
                ],
              })),
            }
          : item,
      ),
    })),
  };
}
