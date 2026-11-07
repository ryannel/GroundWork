// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';
import { acme } from '@/../test/workspace-kit';
import { placementDataOf } from '@/application/plan/derive-placement';
import { systemGroups } from '@/application/plan-pages-entity-system';

import { pendingLegacyModel } from './legacy-plan-model';
import { pendingNativeModel } from './plan-model';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');
const plan = await loadFixture('mini.yaml');

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('pendingLegacyModel', () => {
  it('derives a workspace’s model.json, which has no status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ plan })));
    const model = await pendingLegacyModel('today/model.json').model;
    expect(model?.label('svc:subs')).toBe('Subscriptions');
  });

  it('keeps an ownerless topic in its recorded system after the browser reads model.json', async () => {
    const { today } = acme();
    const placements = placementDataOf(today.model.asIs, today.model.place);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ plan: today.plan, placements })),
    );
    const browser = await pendingLegacyModel('placement/model.json').model;
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
    await expect(pendingLegacyModel('broken/model.json').model).resolves.toBeNull();
  });
  it('shares pending and fresh reads, then refreshes after a minute', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ plan }));
    vi.stubGlobal('fetch', fetch);
    const first = pendingLegacyModel('freshness/model.json').model;
    expect(pendingLegacyModel('freshness/model.json').model).toBe(first);
    await first;
    expect(pendingLegacyModel('freshness/model.json').model).toBe(first);
    vi.advanceTimersByTime(60_001);
    const refreshed = pendingLegacyModel('freshness/model.json').model;
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
    const failed = pendingLegacyModel('retry/model.json').model;
    await expect(failed).resolves.toBeNull();
    expect(pendingLegacyModel('retry/model.json').model).toBe(failed);
    vi.advanceTimersByTime(5001);
    await expect(pendingLegacyModel('retry/model.json').model).resolves.not.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('bounds settled models without discarding an active read', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ plan }));
    vi.stubGlobal('fetch', fetch);
    const oldest = pendingLegacyModel('bounded/first.json').model;
    await oldest;
    for (let index = 0; index < 21; index += 1) {
      await pendingLegacyModel(`bounded/${String(index)}.json`).model;
    }
    expect(pendingLegacyModel('bounded/first.json').model).not.toBe(oldest);
    await pendingLegacyModel('bounded/first.json').model;
  });
});

it('shares native current reads and builds only the supplied canonical query index', async () => {
  const model = queryModel();
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ model }));
  vi.stubGlobal('fetch', fetch);
  const first = pendingNativeModel('native-current/model.json').model;
  expect(pendingNativeModel('native-current/model.json').model).toBe(first);
  const context = await first;
  expect(context?.plan).toBeNull();
  expect(context?.beforeIndex).toBe(context?.afterIndex);
  expect(context?.afterIndex.get('h:a#call')?.data.call).toBe('api:supplier');
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('queries the supplied plan projection without replaying its operations in the browser', async () => {
  const before = queryModel();
  const payload = {
    plan: {
      meta: { id: 'plan:read', title: 'Read server facts' },
      changes: [{ ops: [{ remove: 'api:a' }] }],
    },
    before,
    after: before,
  };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(payload)));
  const context = await pendingNativeModel('native-plan/plan.json').model;
  expect(context?.afterIndex.get('api:a')?.id).toBe('api:a');
  expect(context?.plan?.meta.title).toBe('Read server facts');
});
