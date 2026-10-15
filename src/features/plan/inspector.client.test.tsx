// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { Inspector } from './inspector.client';

vi.mock('server-only', () => ({}));

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

describe('Inspector', () => {
  it('opens the thing a chip names and puts it in the address', async () => {
    render(
      <>
        {chip('svc:subs')}
        <Inspector plan={at} src="plan.json" />
      </>,
    );
    expect(screen.queryByRole('heading')).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByText('svc:subs'));
      await Promise.resolve();
    });
    expect(globalThis.location.hash).toBe('#i-svc-subs');
    const heading = await screen.findByRole('heading', { level: 2 }, { timeout: 4000 });
    expect(heading.textContent).toBe('Subscriptions');
  });

  it('hops to a thing inside the panel, steps back and closes', async () => {
    globalThis.history.pushState(null, '', '/#i-flow-cancel');
    render(<Inspector plan={at} src="plan.json" />);
    expect(await screen.findByRole('heading', { level: 2 })).toBeTruthy();
    const hop = screen.getAllByRole('button').find((b) => b.dataset.inspect === 'svc:subs');
    if (hop === undefined) throw new Error('no chip to hop to');
    fireEvent.click(hop);
    expect(globalThis.location.hash).toBe('#i-svc-subs');
    expect(screen.getByRole('button', { name: /back to the previous/i })).toBeTruthy();
    expect(await screen.findByRole('heading', { level: 2, name: 'Subscriptions' })).toBeTruthy();
    const crumbs = screen.getByRole('navigation', { name: 'What you opened' });
    expect(crumbs.querySelector('button')?.title).toBe('Cancel a subscription');
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
      await Promise.resolve();
    });
  });

  it('says so when the plan has no such thing', async () => {
    globalThis.history.pushState(null, '', '/#i-svc-nope');
    render(<Inspector plan={at} src="plan.json" />);
    expect(await screen.findByText(/nothing called svc:nope/i)).toBeTruthy();
  });

  it('switches between today and with the plan, and copies a link', async () => {
    const copied: string[] = [];
    const writeText = vi.fn(async (text: string) => {
      copied.push(text);
      await Promise.resolve();
    });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    globalThis.history.pushState(null, '', '/#i-svc-subs');
    render(<Inspector plan={at} src="plan.json" />);
    await screen.findByRole('heading', { level: 2 });
    const today = screen.getByRole('radio', { name: 'today' });
    expect(today).toHaveProperty('checked', false);
    fireEvent.click(today);
    expect(screen.getByRole('radio', { name: 'today' })).toHaveProperty('checked', true);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy a link/i }));
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledOnce();
    expect(copied).toEqual([globalThis.location.href]);
    expect(await screen.findByText('Copied')).toBeTruthy();
  });

  it('shows a card while the pointer rests on a chip', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <>
        {chip('svc:subs')}
        <Inspector plan={at} src="plan.json" />
      </>,
    );
    const target = screen.getByText('svc:subs');
    fireEvent.pointerMove(target, { pointerType: 'mouse' });
    fireEvent.pointerOver(target, { pointerType: 'mouse' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(await screen.findByText('Click to inspect', {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByText('Subscriptions')).toBeTruthy();
    fireEvent.pointerOut(target, { pointerType: 'mouse' });
    expect(screen.queryByText('Click to inspect')).toBeNull();
    vi.useRealTimers();
  });
});
