import { describe, expect, it } from 'vitest';

import { acme } from '@/../test/workspace-kit';
import { derive } from '@/application/plan/derive';

import { areaTechnicalRelationships } from './workspace-area-relationships';

describe('recorded graph membership', () => {
  it('retains explicit queue reads and writes with handler evidence without fabricating delivery', () => {
    const { today } = acme();
    const model = derive({
      ...today.plan,
      stores: [
        { id: 'st:retry', name: 'Retry queue', kind: 'queue', owner: 'svc:products' },
        {
          id: 'st:events',
          name: 'Events',
          kind: 'topic',
          access: [{ svc: 'svc:products', mode: 'write' }],
        },
      ],
      messages: [
        {
          id: 'msg:changed',
          name: 'Changed',
          topic: 'st:events',
          producer: 'svc:products',
          consumers: ['svc:shop-bff'],
        },
      ],
      handlers: [
        {
          id: 'h:retry',
          component: 'svc:products',
          on: 'timer:retry',
          steps: [
            { read: 'sch:job', from: 'st:retry' },
            { write: 'sch:job', to: 'st:retry', when: 'attempts remain' },
            { publish: 'msg:changed' },
          ],
        },
      ],
    });
    const edges = areaTechnicalRelationships(
      [
        {
          id: 'shop',
          components: ['svc:products', 'svc:shop-bff', 'st:retry', 'st:events'].map((id) => ({
            id,
          })),
        },
      ],
      model,
    );
    expect(model.edges('asIs', 'data')).toEqual([
      expect.objectContaining({
        from: 'svc:products',
        to: 'st:retry',
        mode: 'readwrite',
        handlers: ['h:retry'],
      }),
    ]);
    expect(edges).toContainEqual(
      expect.objectContaining({
        from: 'svc:products',
        to: 'st:retry',
        kind: 'data',
        label: 'Reads and writes',
        evidence: 'handler',
        evidenced: true,
        evidenceIds: ['h:retry'],
      }),
    );
    expect(edges.filter((edge) => edge.kind === 'message')).toHaveLength(2);
    expect(edges.some((edge) => edge.kind === 'data' && edge.to === 'st:events')).toBe(false);
    expect(model.asIs.messages).toHaveLength(1);
    expect(model.storeGrid('asIs').cells.some((cell) => cell.store === 'st:retry')).toBe(false);
  });

  it('retains flow queue access and library access declarations without ownership-based access', () => {
    const { today } = acme();
    const model = derive({
      ...today.plan,
      stores: [
        { id: 'st:retry', name: 'Retry queue', kind: 'queue' },
        {
          id: 'st:library',
          name: 'Library queue',
          kind: 'queue',
          access: [{ svc: 'svc:products', mode: 'read' }],
        },
        { id: 'st:owner-only', name: 'Owner only', kind: 'queue', owner: 'svc:products' },
      ],
      messages: [],
      flows: [
        {
          id: 'flow:retry',
          name: 'Retry',
          steps: [
            {
              id: 'read',
              from: 'st:retry',
              to: 'svc:products',
              via: 'internal',
              action: 'Read retry jobs',
            },
          ],
        },
      ],
    });
    const edges = areaTechnicalRelationships(
      [
        {
          id: 'shop',
          components: ['svc:products', 'st:retry', 'st:library', 'st:owner-only'].map((id) => ({
            id,
          })),
        },
      ],
      model,
    );
    expect(edges).toContainEqual(
      expect.objectContaining({
        from: 'svc:products',
        to: 'st:retry',
        kind: 'data',
        evidence: 'flow',
        evidenced: true,
        evidenceIds: ['read'],
      }),
    );
    expect(edges).toContainEqual(
      expect.objectContaining({
        from: 'svc:products',
        to: 'st:library',
        label: 'Reads',
        evidence: 'declared',
        evidenced: false,
      }),
    );
    expect(edges.some((edge) => edge.to === 'st:owner-only' || edge.kind === 'message')).toBe(
      false,
    );
  });

  it('retains a concrete flow publisher even when the message publisher field is unidentified', () => {
    const { today } = acme();
    const model = derive({
      ...today.plan,
      stores: [{ id: 'st:incoming', name: 'Inbound events', kind: 'topic' }],
      messages: [
        { id: 'msg:incoming', name: 'Changed', topic: 'st:incoming', consumers: ['svc:shop-bff'] },
      ],
      flows: [
        {
          id: 'flow:publish',
          name: 'Publish changed information',
          steps: [
            {
              id: 'send',
              from: 'svc:products',
              to: 'st:incoming',
              via: 'msg:incoming',
              action: 'Publish changed information',
            },
          ],
        },
      ],
    });
    const edges = areaTechnicalRelationships(
      [
        {
          id: 'products',
          components: [{ id: 'svc:products' }, { id: 'svc:shop-bff' }, { id: 'st:incoming' }],
        },
      ],
      model,
    );
    expect(edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'svc:products', to: 'st:incoming', evidence: 'flow' }),
      ]),
    );
    expect(model.ownerService('msg:incoming')).toBeNull();
    expect(model.publishPoints('msg:incoming', 'asIs')).toHaveLength(1);
  });

  it('retains every captured publisher, its evidence and a declared consumer when the publisher field is absent', () => {
    const { today } = acme();
    const model = derive({
      ...today.plan,
      stores: [{ id: 'st:incoming', name: 'Inbound events', kind: 'topic' }],
      messages: [
        {
          id: 'msg:incoming',
          name: 'Product changed',
          topic: 'st:incoming',
          consumers: ['svc:shop-bff'],
        },
      ],
      handlers: ['products', 'order-api'].map((name) => ({
        id: `h:${name}`,
        component: `svc:${name}`,
        on: 'timer:refresh',
        steps: [{ publish: 'msg:incoming' }],
      })),
    });
    const components = ['svc:products', 'svc:order-api', 'svc:shop-bff'].map((id) => ({ id }));
    const withTopic = areaTechnicalRelationships(
      [{ id: 'shop', components: [...components, { id: 'st:incoming' }] }],
      model,
    );
    const publications = withTopic.filter((edge) => edge.to === 'st:incoming');
    expect(publications).toHaveLength(2);
    for (const name of ['products', 'order-api']) {
      expect(publications).toContainEqual(
        expect.objectContaining({
          from: `svc:${name}`,
          to: 'st:incoming',
          via: 'msg:incoming',
          kind: 'message',
          evidence: 'handler',
          evidenced: true,
          evidenceIds: [`h:${name}`],
        }),
      );
    }
    const withoutTopic = areaTechnicalRelationships([{ id: 'shop', components }], model).filter(
      (edge) => edge.kind === 'message',
    );
    expect(withoutTopic).toHaveLength(2);
    expect(new Set(withoutTopic.map((edge) => edge.id)).size).toBe(2);
    expect(
      withoutTopic.every((edge) => edge.to === 'svc:shop-bff' && edge.evidence === 'handler'),
    ).toBe(true);
    expect(withoutTopic.every((edge) => edge.detail.includes('a declared subscription'))).toBe(
      true,
    );
    expect(
      withoutTopic.every((edge) =>
        edge.detail.includes('Delivery and deployed subscription state are not established'),
      ),
    ).toBe(true);
    expect(model.asIs.messages[0]?.producer).toBeUndefined();
  });
  it('retains inbound consumption and recorded store reads without inventing a publisher or owner', () => {
    const { today } = acme();
    const model = derive({
      ...today.plan,
      stores: [
        { id: 'st:incoming', name: 'Inbound events', kind: 'topic' },
        {
          id: 'st:external-data',
          name: 'External data',
          kind: 'database',
          access: [{ svc: 'svc:products', mode: 'read' }],
        },
      ],
      messages: [
        {
          id: 'msg:incoming',
          name: 'Product changed',
          topic: 'st:incoming',
          consumers: ['svc:products'],
        },
      ],
      handlers: [{ id: 'h:incoming', on: 'msg:incoming', component: 'svc:products', steps: [] }],
    });
    const edges = areaTechnicalRelationships(
      [
        {
          id: 'products',
          components: [{ id: 'svc:products' }, { id: 'st:incoming' }, { id: 'st:external-data' }],
        },
      ],
      model,
    );
    expect(edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'st:incoming', to: 'svc:products', kind: 'message' }),
        expect.objectContaining({ from: 'svc:products', to: 'st:external-data', kind: 'data' }),
      ]),
    );
    expect(edges.some((edge) => edge.to === 'st:incoming')).toBe(false);
    expect(model.ownerService('msg:incoming')).toBeNull();
    expect(model.ownerService('st:external-data')).toBeNull();
    expect(model.layout().byId.get('st:external-data')).toMatchObject({ under: null });
    expect(model.edges('asIs', 'all').every((edge) => typeof edge.from === 'string')).toBe(true);
  });

  it('projects explicit membership, preserves qualifications and skips unavailable participants', () => {
    const { today } = acme();
    const model = derive({
      ...today.plan,
      graphs: [{ id: 'graph:shop', name: 'Shop graph', gateway: 'svc:shop-bff' }],
      subgraphs: [
        {
          id: 'sg:products',
          name: 'Products',
          graph: 'graph:shop',
          service: 'svc:products',
          summary: 'Disabled locally; deployed composition unresolved.',
        },
        { id: 'sg:duplicate', name: 'Duplicate', graph: 'graph:shop', service: 'svc:products' },
        { id: 'sg:missing', name: 'Missing', graph: 'graph:missing', service: 'svc:products' },
        { id: 'sg:outside', name: 'Outside', graph: 'graph:shop', service: 'svc:outside' },
        { id: 'sg:self', name: 'Self', graph: 'graph:shop', service: 'svc:shop-bff' },
      ],
    });
    const systems = [{ id: 'shop', components: [{ id: 'svc:shop-bff' }, { id: 'svc:products' }] }];
    const memberships = areaTechnicalRelationships(systems, model).filter(
      (edge) => edge.kind === 'membership',
    );
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({
      from: 'svc:shop-bff',
      to: 'svc:products',
      directed: false,
      supporting: true,
      endpointId: null,
      evidenced: false,
      evidence: 'configuration',
      label: 'Recorded subgraph membership',
    });
    expect(memberships[0]?.detail).toContain('not live composition');
    expect(memberships[0]?.detail).toContain('Disabled locally');
    expect(
      areaTechnicalRelationships([{ id: 'products', components: [{ id: 'svc:products' }] }], model),
    ).toEqual([]);
  });

  it('does not duplicate a real relationship in either direction', () => {
    const { today } = acme();
    const model = derive({
      ...today.plan,
      graphs: [{ id: 'graph:shop', name: 'Shop graph', gateway: 'svc:shop-bff' }],
      subgraphs: [
        { id: 'sg:products', name: 'Products', graph: 'graph:shop', service: 'svc:products' },
      ],
      interfaces: [
        {
          id: 'if:shop',
          service: 'svc:shop-bff',
          protocol: 'rest',
          endpoints: [{ id: 'api:shop', sig: 'GET /shop' }],
        },
      ],
      handlers: [
        {
          id: 'h:products',
          component: 'svc:products',
          on: 'timer:refresh',
          steps: [{ call: 'api:shop' }],
        },
      ],
    });
    const edges = areaTechnicalRelationships(
      [{ id: 'shop', components: [{ id: 'svc:shop-bff' }, { id: 'svc:products' }] }],
      model,
    );
    expect(edges.some((edge) => edge.kind === 'api')).toBe(true);
    expect(edges.some((edge) => edge.kind === 'membership')).toBe(false);
  });
});
