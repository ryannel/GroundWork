// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { acme } from '@/../test/workspace-kit';
import { placementDataOf } from '@/application/plan/derive-placement';
import { systemGroups } from '@/application/plan-pages-entity-system';

import { pendingModel } from './plan-model';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');
const plan = await loadFixture('mini.yaml');

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('pendingModel', () => {
  it('derives a workspace’s model.json, which has no status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ plan })));
    const model = await pendingModel('today/model.json').model;
    expect(model?.label('svc:subs')).toBe('Subscriptions');
  });

  it('keeps an ownerless topic in its recorded system after the browser reads model.json', async () => {
    const { today } = acme();
    const placements = placementDataOf(today.model.asIs, today.model.place);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ plan: today.plan, placements })),
    );
    const browser = await pendingModel('placement/model.json').model;
    expect(browser?.ownerService('st:product-events')).toBeNull();
    expect(browser?.place('st:product-events')).toMatchObject({ system: 'sys:products' });
    if (browser === null) throw new Error('Missing browser model');
    expect(systemGroups(browser, 'sys:search')).toContainEqual({
      label: 'Gets data from',
      ids: ['sys:products'],
    });
  });

  it('gives nothing for a document that is not one', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ nothing: true })));
    await expect(pendingModel('broken/model.json').model).resolves.toBeNull();
  });
  it('shares pending and fresh reads, then refreshes after a minute', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ plan }));
    vi.stubGlobal('fetch', fetch);
    const first = pendingModel('freshness/model.json').model;
    expect(pendingModel('freshness/model.json').model).toBe(first);
    await first;
    expect(pendingModel('freshness/model.json').model).toBe(first);
    vi.advanceTimersByTime(60_001);
    const refreshed = pendingModel('freshness/model.json').model;
    expect(refreshed).not.toBe(first);
    await refreshed;
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('freshness/model.json'), {
      cache: 'no-store',
    });
  });

  it('retries failures without creating a new promise on every render', async () => {
    vi.useFakeTimers();
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(Response.json({ plan }));
    vi.stubGlobal('fetch', fetch);
    const failed = pendingModel('retry/model.json').model;
    await expect(failed).resolves.toBeNull();
    expect(pendingModel('retry/model.json').model).toBe(failed);
    vi.advanceTimersByTime(5001);
    await expect(pendingModel('retry/model.json').model).resolves.not.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('bounds settled models without discarding an active read', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ plan }));
    vi.stubGlobal('fetch', fetch);
    const oldest = pendingModel('bounded/first.json').model;
    await oldest;
    for (let index = 0; index < 21; index += 1) {
      await pendingModel(`bounded/${String(index)}.json`).model;
    }
    expect(pendingModel('bounded/first.json').model).not.toBe(oldest);
    await pendingModel('bounded/first.json').model;
  });
});
