// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { pendingModel } from './plan-model';

vi.mock('server-only', () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');
const plan = await loadFixture('mini.yaml');

describe('pendingModel', () => {
  it('derives a workspace’s model.json, which has no status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ plan })));
    const model = await pendingModel('today/model.json').model;
    expect(model?.label('svc:subs')).toBe('Subscriptions');
  });

  it('gives nothing for a document that is not one', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ nothing: true })));
    expect(await pendingModel('broken/model.json').model).toBeNull();
  });
});
