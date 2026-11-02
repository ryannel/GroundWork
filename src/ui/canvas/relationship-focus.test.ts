import { describe, expect, it } from 'vitest';

import type { ConnectedCanvasEdge } from '@/ui/connected-canvas-types';

import { matchesConnection } from './relationship-focus';

const edge: ConnectedCanvasEdge = {
  id: 'group',
  from: 'svc:caller',
  to: 'surface:offers',
  surfaceId: 'surface:REST:/offers',
  label: 'Offers',
  detail: 'Two calls',
  path: '',
  x: 0,
  y: 0,
  kind: 'api',
  relations: [
    { from: 'svc:caller', to: 'svc:offers', endpointId: 'api:get' },
    { from: 'svc:caller', to: 'svc:offers', endpointId: 'api:create' },
  ],
};

describe('component connection focus', () => {
  it('shows undirected membership at either end without claiming a dependency direction', () => {
    const membership = { ...edge, kind: 'membership' as const, directed: false };
    for (const selected of ['svc:caller', 'svc:offers']) {
      expect(matchesConnection(membership, { selected, direction: 'both' })).toBe(true);
      expect(matchesConnection(membership, { selected, direction: 'incoming' })).toBe(false);
      expect(matchesConnection(membership, { selected, direction: 'outgoing' })).toBe(false);
    }
  });
  it('finds users of the publisher after its topic is folded without reversing delivery arrows', () => {
    const message: ConnectedCanvasEdge = {
      ...edge,
      from: 'svc:publisher',
      to: 'svc:consumer',
      kind: 'message',
      relations: [
        { from: 'st:topic', to: 'svc:consumer', usageFrom: 'svc:consumer', usageTo: 'st:topic' },
        {
          from: 'svc:publisher',
          to: 'svc:consumer',
          usageFrom: 'svc:consumer',
          usageTo: 'svc:publisher',
        },
      ],
    };
    expect(matchesConnection(message, { selected: 'svc:publisher', direction: 'incoming' })).toBe(
      true,
    );
    expect(matchesConnection(message, { selected: 'svc:publisher', direction: 'outgoing' })).toBe(
      false,
    );
    expect(matchesConnection(message, { selected: 'svc:consumer', direction: 'outgoing' })).toBe(
      true,
    );
    expect(matchesConnection(message, { selected: 'svc:consumer', direction: 'incoming' })).toBe(
      false,
    );
    expect(message).toMatchObject({ from: 'svc:publisher', to: 'svc:consumer' });
  });

  it('treats consumers as users of a topic without reversing message-flow arrows', () => {
    const message = {
      ...edge,
      from: 'st:topic',
      to: 'svc:consumer',
      kind: 'message' as const,
      relations: [
        { from: 'st:topic', to: 'svc:consumer', usageFrom: 'svc:consumer', usageTo: 'st:topic' },
      ],
    };
    expect(matchesConnection(message, { selected: 'svc:consumer', direction: 'outgoing' })).toBe(
      true,
    );
    expect(matchesConnection(message, { selected: 'svc:consumer', direction: 'incoming' })).toBe(
      false,
    );
    expect(matchesConnection(message, { selected: 'st:topic', direction: 'incoming' })).toBe(true);
    expect(matchesConnection(message, { selected: 'st:topic', direction: 'outgoing' })).toBe(false);
  });

  it('distinguishes callers from dependencies while retaining grouped identities', () => {
    expect(matchesConnection(edge, { selected: 'svc:offers', direction: 'incoming' })).toBe(true);
    expect(matchesConnection(edge, { selected: 'svc:offers', direction: 'outgoing' })).toBe(false);
    expect(matchesConnection(edge, { selected: 'svc:caller', direction: 'outgoing' })).toBe(true);
    expect(matchesConnection(edge, { selected: 'svc:caller', direction: 'incoming' })).toBe(false);
  });

  it('can focus a whole API group or one operation without losing outgoing calls', () => {
    expect(
      matchesConnection(edge, {
        selected: 'svc:offers',
        endpoint: 'surface:REST:/offers',
        direction: 'both',
      }),
    ).toBe(true);
    expect(
      matchesConnection(edge, {
        selected: 'svc:offers',
        endpoint: 'api:create',
        direction: 'both',
      }),
    ).toBe(true);
    expect(
      matchesConnection(edge, { selected: 'svc:offers', endpoint: 'api:other', direction: 'both' }),
    ).toBe(false);
    expect(
      matchesConnection(edge, { selected: 'svc:caller', endpoint: 'api:other', direction: 'both' }),
    ).toBe(true);
  });

  it('shows context when nothing is selected and excludes unrelated connections otherwise', () => {
    expect(matchesConnection(edge, { direction: 'both' })).toBe(true);
    expect(matchesConnection(edge, { selected: 'svc:unrelated', direction: 'both' })).toBe(false);
  });
});
