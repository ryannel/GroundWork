// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { planReaderOf } from '@/application/plan-pages-things';

import { Inspector } from './inspector.client';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');
const plan = await loadFixture('mini.yaml');
const at = { workspace: 'w', slug: 'p' };

beforeAll(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ plan, status: {} })));
});

afterEach(() => {
  cleanup();
  globalThis.history.replaceState(null, '', '/');
});

const chip = (id: string) => (
  <button data-inspect={id} type="button">
    {id}
  </button>
);

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

describe('Inspector', () => {
  it('opens the thing a chip names and puts it in the address', async () => {
    render(
      <>
        {chip('svc:subs')}
        <Inspector reader={planReaderOf(at, 'plan.json')} />
      </>,
    );
    expect(screen.queryByRole('heading')).toBeNull();
    await inAct(() => {
      fireEvent.click(screen.getByText('svc:subs'));
    });
    expect(globalThis.location.hash).toBe('#i-svc-subs');
    const heading = await screen.findByRole('heading', { level: 2 }, { timeout: 4000 });
    expect(heading.textContent).toBe('Subscriptions');
  });

  it('hops to a thing inside the panel, steps back and closes', async () => {
    globalThis.history.pushState(null, '', '/#i-flow-cancel');
    render(<Inspector reader={planReaderOf(at, 'plan.json')} />);
    await expect(screen.findByRole('heading', { level: 2 })).resolves.toBeTruthy();
    const hop = screen.getAllByRole('button').find((b) => b.dataset.inspect === 'svc:subs');
    if (hop === undefined) throw new Error('no chip to hop to');
    fireEvent.click(hop);
    expect(globalThis.location.hash).toBe('#i-svc-subs');
    expect(screen.getByRole('button', { name: /back to the previous/iu })).toBeTruthy();
    await expect(
      screen.findByRole('heading', { level: 2, name: 'Subscriptions' }),
    ).resolves.toBeTruthy();
    const crumbs = screen.getByRole('navigation', { name: 'What you opened' });
    expect(crumbs.querySelector('button')?.title).toBe('Cancel a subscription');
    fireEvent.keyDown(document, { key: 'Escape' });
    await act(async () => {
      await Promise.resolve();
    });
  });

  it('says so when the plan has no such thing', async () => {
    globalThis.history.pushState(null, '', '/#i-svc-nope');
    render(<Inspector reader={planReaderOf(at, 'plan.json')} />);
    await expect(screen.findByText(/nothing called svc:nope/iu)).resolves.toBeTruthy();
  });

  it('switches between today and with the plan, and copies a link', async () => {
    const copied: string[] = [];
    const writeText = vi.fn<(text: string) => Promise<void>>(async (text: string) => {
      copied.push(text);
      await Promise.resolve();
    });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    globalThis.history.pushState(null, '', '/#i-svc-subs');
    render(<Inspector reader={planReaderOf(at, 'plan.json')} />);
    await screen.findByRole('heading', { level: 2 });
    const today = screen.getByRole('radio', { name: 'today' });
    expect(today).toHaveProperty('checked', false);
    fireEvent.click(today);
    expect(screen.getByRole('radio', { name: 'today' })).toHaveProperty('checked', true);
    fireEvent.click(screen.getByRole('button', { name: /copy a link/iu }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledOnce();
    expect(copied).toEqual([globalThis.location.href]);
    await expect(screen.findByText('Copied')).resolves.toBeTruthy();
  });

  it('shows a card while the pointer rests on a chip', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <>
        {chip('svc:subs')}
        <Inspector reader={planReaderOf(at, 'plan.json')} />
      </>,
    );
    const target = screen.getByText('svc:subs');
    fireEvent.pointerMove(target, { pointerType: 'mouse' });
    fireEvent.pointerOver(target, { pointerType: 'mouse' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await expect(
      screen.findByText('Click to inspect', {}, { timeout: 4000 }),
    ).resolves.toBeTruthy();
    expect(screen.getByText('Subscriptions')).toBeTruthy();
    fireEvent.pointerOut(target, { pointerType: 'mouse' });
    expect(screen.queryByText('Click to inspect')).toBeNull();
    vi.useRealTimers();
  });
});
