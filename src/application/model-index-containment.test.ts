import { describe, expect, it } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';
import { entitiesIn } from '@/domain/workspace-model';

import { indexOf } from './model-index';

describe('cross-system model queries', () => {
  it('projects through containment when a store owner belongs to the calling system', () => {
    const index = indexOf(queryModel());
    expect(index.place('st:remote')).toEqual({
      workspace: 'queries',
      domain: 'dom:queries',
      system: 'sys:b',
      component: 'st:remote',
    });
    expect(index.resourceOwner('st:remote')).toBe('svc:a');
    expect(index.owningTeam('st:remote')).toBe('team:b');
    expect(index.codeHomes('st:remote')).toEqual([{ key: 'b', repo: 'fixture/b', path: 'worker' }]);
    expect(index.freshness('st:remote')).toEqual([]);
    const cross = index.edges('sys:a', { level: 'system', direction: 'out' });
    expect(cross.map((edge) => [edge.to, edge.kind, edge.site])).toEqual([
      ['sys:b', 'read', 'h:a#read'],
      ['sys:b', 'write', 'h:a#write'],
      ['sys:b', 'publish', 'h:a#publish'],
      ['ext:supplier', 'call', 'h:a#call'],
    ]);
    expect(
      index.edges('sys:b', { level: 'system', direction: 'in', kinds: ['read'] }),
    ).toHaveLength(1);
    expect(index.edges('sys:b', { level: 'system', direction: 'out', kinds: ['consume'] })).toEqual(
      [expect.objectContaining({ to: 'sys:a', site: 'rel:consume' })],
    );
    expect(index.edges('svc:b', { direction: 'out', kinds: ['read'] })).toEqual([
      expect.objectContaining({
        to: 'st:remote',
        source: 'relationship',
        handler: null,
        entry: null,
      }),
    ]);
    expect(index.gaps('sys:a')).not.toContainEqual(
      expect.objectContaining({ kind: 'unbacked_connection' }),
    );
  });
  it('keeps message bindings distinct from a topic-only relationship and derives entry roles', () => {
    const index = indexOf(queryModel());
    expect(index.producers('msg:remote')).toEqual(['svc:a']);
    expect(index.consumers('msg:remote')).toEqual(['svc:b']);
    expect(index.roles('svc:a')).toEqual(['api']);
    expect(index.roles('svc:b')).toEqual(['worker', 'job']);
    expect(index.entries('svc:b').map((entry) => entry.id)).toEqual(['sub:b', 'job:b']);
    expect(index.callers('api:supplier')).toEqual([
      expect.objectContaining({ site: 'h:a#call', handler: 'h:a', entry: 'api:a' }),
    ]);
    expect(index.flowOf('sub:b')?.callers).toEqual([
      expect.objectContaining({ from: 'svc:a', via: 'msg:remote' }),
    ]);
    expect(index.storeAccess('st:remote').map((edge) => [edge.from, edge.kind])).toEqual([
      ['svc:a', 'read'],
      ['svc:a', 'write'],
      ['svc:b', 'read'],
    ]);
    expect(index.label('api:a')).toBe('GET /a');
    expect(index.label('h:a#read')).toBe('h:a#read');
    expect(index.href('sub:b')).toBe('/queries/entries/?id=sub%3Ab');
  });
  it('keeps supplied loader gaps, cited owners and unresolved backing explicit', () => {
    const model = queryModel();
    const store = entitiesIn(model).find((entity) => entity.id === 'st:remote');
    if (store === undefined) throw new Error('Missing store');
    Object.assign(store.data, { owner: { id: 'svc:a', cites: [] } });
    const index = indexOf({
      ...model,
      problems: [
        {
          id: 'st:remote',
          kind: 'unresolved_cite',
          reference: 'missing:File.ts',
          message: 'No pin is recorded.',
        },
      ],
    });
    expect(index.resourceOwner('st:remote')).toBeNull();
    expect(index.gaps('st:remote')).toEqual([
      expect.objectContaining({ kind: 'unresolved_cite' }),
      expect.objectContaining({ kind: 'no_owner' }),
    ]);
    expect(index.gaps('absent')).toEqual([]);
    expect(index.cites('absent')).toEqual([]);
  });
});

it('keeps an unknown retry stopping condition visible without reversing the original wording', () => {
  const model = queryModel();
  const node = entitiesIn(model).find((entity) => entity.id === 'h:a#read');
  if (node === undefined) throw new Error('Missing fixture step');
  Object.assign(node.data, { retry: { description: 'timeout or error', times: 3 }, steps: [] });
  expect(indexOf(model).gaps(node.id)).toContainEqual(
    expect.objectContaining({ kind: 'no_retry_condition' }),
  );
});

it('keeps publications of different messages on one topic distinct', () => {
  const model = queryModel();
  const system = entitiesIn(model).find((node) => node.id === 'sys:b');
  const source = entitiesIn(model).find((node) => node.id === 'sys:a');
  if (system === undefined || source === undefined) throw new Error('Missing fixture systems');
  Object.assign(system.data, {
    messages: [
      { id: 'msg:remote', topic: 'top:remote', payload: 'sch:remote' },
      { id: 'msg:other', topic: 'top:remote', payload: 'sch:remote' },
    ],
  });
  Object.assign(source.data, {
    relationships: [
      {
        id: 'rel:other',
        from: 'svc:a',
        to: 'msg:other',
        kind: 'publish',
        says: 'Publishes the other event',
        reason: 'Only the contract records this publication',
        cites: [{ kind: 'evidence', id: 'ev:source' }],
      },
    ],
  });
  const index = indexOf(model);
  expect(index.producers('msg:remote')).toEqual(['svc:a']);
  expect(index.producers('msg:other')).toEqual(['svc:a']);
});
it('rejects a message-consumption relationship already established by a subscription', () => {
  const model = queryModel();
  const system = entitiesIn(model).find((node) => node.id === 'sys:b');
  if (system === undefined) throw new Error('Missing fixture system');
  Object.assign(system.data, {
    relationships: [
      {
        id: 'rel:duplicate',
        from: 'svc:b',
        to: 'msg:remote',
        kind: 'consume',
        says: 'Consumes the event',
        reason: 'A duplicate claim',
        cites: [{ kind: 'evidence', id: 'ev:source' }],
      },
    ],
  });
  expect(() => indexOf(model)).toThrow('duplicates recorded handler or operation detail');
});
