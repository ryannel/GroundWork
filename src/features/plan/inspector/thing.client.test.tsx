// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { planReaderOf } from '@/application/plan-pages-things';
import { todayReaderOf, type Reader } from '@/application/today-reader';
import type { Plan } from '@/domain/plan/plan.generated';

import { Thing } from './thing.client';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');
const mini = await loadFixture('mini.yaml');
const at = { workspace: 'w', slug: 'p' };

const plan: Plan = {
  ...mini,
  meta: {
    ...mini.meta,
    version: '1.1',
    revisions: [
      { version: '1.0', status: 'approved', date: '2024-01-02' },
      { version: '1.1', status: 'proposed', date: '2024-02-03' },
      { version: '0.9', status: 'rejected', date: '2023-12-01' },
    ],
  },
};
const older: Plan = {
  ...mini,
  services: mini.services.map((s) => (s.id === 'svc:subs' ? { ...s, name: 'Subs, as was' } : s)),
};
const status = {
  'wi:pause-endpoint': { state: 'closed', closed_at: '2024-03-04', url: 'https://x/1' },
};

beforeAll(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      await Promise.resolve();
      if (url.includes('revisions/1.0/')) return Response.json({ plan: older, status });
      if (url.includes('revisions/')) return new Response('none', { status: 404 });
      return Response.json({ plan, status });
    }),
  );
});

afterEach(cleanup);

// React draws what a suspended tree was waiting for only inside an awaited act, so the step that suspends runs in one.
async function inAct(
  step: () => void,
  wait = async (): Promise<void> => {
    await Promise.resolve();
  },
) {
  await act(async () => {
    step();
    await wait();
  });
}

const pause = async () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 50);
  });

async function show(id: string, reader: Reader = planReaderOf(at, 'plan.json')): Promise<void> {
  await inAct(() => {
    render(
      <Suspense fallback={<p>loading</p>}>
        <Thing id={id} reader={reader} />
      </Suspense>,
    );
  }, pause);
}

describe('Thing', () => {
  it('links to the thing’s own page', async () => {
    await show('svc:subs');
    const link = await screen.findByRole('link', { name: 'Open as page' });
    expect(link.getAttribute('href')).toBe('/w/plans/p/things?id=svc-subs');
  });

  it('opens the thing as it stood at another version, or says no copy was kept', async () => {
    await show('svc:subs');
    const pick = await screen.findByRole('combobox', { name: 'As at' });
    await inAct(() => {
      fireEvent.change(pick, { target: { value: '1.0' } });
    });
    await expect(
      screen.findByRole('heading', { level: 2, name: 'Subs, as was' }),
    ).resolves.toBeTruthy();
    await inAct(() => {
      fireEvent.change(screen.getByRole('combobox', { name: 'As at' }), {
        target: { value: '0.9' },
      });
    });
    await expect(screen.findByText('No copy of version 0.9 was kept.')).resolves.toBeTruthy();
  });

  it('draws a flow and offers it as Mermaid', async () => {
    await show('flow:cancel');
    await expect(screen.findByText('The flow with this plan')).resolves.toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy as Mermaid' })).toBeTruthy();
  });

  it('shows a work item’s issue: its title, state and link', async () => {
    await show('wi:pause-endpoint');
    const issue = await screen.findByRole('region', { name: 'Its GitHub issue' });
    expect(issue.textContent).toContain('Pause endpoint');
    expect(issue.textContent).toMatch(/closed 4 Mar/u);
    expect(issue.querySelector('a')?.getAttribute('href')).toBe('https://x/1');
  });

  it('reads today with no versions, no switch and its own page under the workspace', async () => {
    await show('svc:subs', todayReaderOf('w', 0));
    const link = await screen.findByRole('link', { name: 'Open as page' });
    expect(link.getAttribute('href')).toBe('/w/things?id=svc-subs');
    expect(screen.queryByRole('combobox', { name: 'As at' })).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(document.body.textContent).not.toMatch(/\bplan\b/iu);
  });
});
