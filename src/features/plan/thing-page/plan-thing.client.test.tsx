// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { PlanThing } from './plan-thing.client';

vi.mock(import('server-only'), () => ({}));
vi.mock(import('next/navigation'), () => ({
  useSearchParams: () => new URLSearchParams(globalThis.location.search) as never,
  useRouter: () => ({ push: vi.fn<() => void>() }) as never,
}));

const { derive } = await import('@/application/plan/derive');
const { outlineOf } = await import('@/application/plan-pages');
const { loadFixture } = await import('@/infrastructure/plan-fixture');
const plan = await loadFixture('mini.yaml');
const outline = outlineOf(derive(plan, { status: {} }), { workspace: 'shop', slug: 'mini' });
const fetched = vi.fn<(src: string) => Promise<Response>>(async (src) => {
  await Promise.resolve();
  return src.endsWith('/gone.json') ? new Response('', { status: 404 }) : Response.json({ plan });
});

beforeAll(() => {
  vi.stubGlobal('fetch', fetched);
});

afterEach(cleanup);

async function open(search: string, src = 'plan.json') {
  globalThis.history.replaceState(null, '', `/shop/plans/mini/things/${search}`);
  await act(async () => {
    render(
      <Suspense fallback="Loading…">
        <PlanThing outline={outline} src={src} />
      </Suspense>,
    );
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
}

describe('the plan’s things page', () => {
  it('draws the thing ?id= names from the plan’s model, with the pager on its siblings', async () => {
    await open('?id=svc-subs');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Subscriptions');
    const pager = screen.getByRole('navigation', { name: 'Screens' });
    expect(pager.querySelector('[rel="next"]')?.getAttribute('href')).toBe(
      '/shop/plans/mini/things?id=svc-billing',
    );
  });

  it('says so when the id names nothing, or the plan cannot be had', async () => {
    await open('?id=svc-nope');
    expect(screen.getByText('This plan has nothing by that name.')).toBeTruthy();
    cleanup();
    await open('?id=svc-subs', 'gone.json');
    expect(screen.getByText('The plan could not be loaded.')).toBeTruthy();
  });
});
