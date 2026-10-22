import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';

import { storeContentsOf } from './today-store';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const model = derive(await loadFixture('handlers.yaml'));

describe('storeContentsOf', () => {
  it('lists the tables a database keeps, with their columns', () => {
    const contents = storeContentsOf(model, 'st:pricing-db');
    expect(
      contents?.tables.map(({ chip, columns }) => [chip.id, columns.map((c) => c.name)]),
    ).toEqual([['sch:price-rule', ['id']]]);
    expect(contents?.messages).toEqual([]);
  });

  it('lists the messages on a topic, who announces them and what they carry', () => {
    const [message] = storeContentsOf(model, 'st:price-events')?.messages ?? [];
    expect(message?.chip.id).toBe('msg:price-changed');
    expect(message?.payload?.id).toBe('sch:price-changed');
    expect(message?.producer?.id).toBe('svc:pricing');
  });

  it('gives nothing for what is not a store', () => {
    expect(storeContentsOf(model, 'svc:pricing')).toBeNull();
  });
});
