// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CHEAT_EVENT } from './cheat-sheet.client';
import { PlanKeys } from './keys.client';
import { PeekToday } from './peek.client';
import { PLANS_EVENT } from './plan-switch.client';

const push = vi.fn<(href: string) => void>();
vi.mock(import('next/navigation'), async (original) => {
  const actual = await original();
  return {
    ...actual,
    useSearchParams: () => new actual.ReadonlyURLSearchParams(),
    useRouter: () => ({ push }) as unknown as ReturnType<typeof actual.useRouter>,
  };
});

afterEach(() => {
  cleanup();
  push.mockReset();
});

const keys = <PlanKeys next="/n/" nextChapter="/nc/" previous="/p/" previousChapter="/pc/" />;

function heard(name: string): () => number {
  let count = 0;
  globalThis.addEventListener(name, () => {
    count += 1;
  });
  return () => count;
}

describe('PlanKeys', () => {
  it('goes to the next chapter on J and the previous screen on k', () => {
    render(keys);
    fireEvent.keyDown(globalThis.window, { key: 'J', shiftKey: true });
    fireEvent.keyDown(globalThis.window, { key: 'k' });
    expect(push.mock.calls).toEqual([['/nc/'], ['/p/']]);
  });

  it('asks for the cheat sheet on ? and the plan switcher on ⌘⇧P, but not while typing', () => {
    const cheats = heard(CHEAT_EVENT);
    const plans = heard(PLANS_EVENT);
    render(
      <>
        {keys}
        <input aria-label="field" />
      </>,
    );
    fireEvent.keyDown(globalThis.window, { key: '?', shiftKey: true });
    fireEvent.keyDown(globalThis.window, { key: 'P', metaKey: true, shiftKey: true });
    fireEvent.keyDown(screen.getByLabelText('field'), { key: '?', shiftKey: true });
    expect([cheats(), plans()]).toEqual([1, 1]);
  });

  it('steps a reference page through its views on d', () => {
    render(
      <>
        {keys}
        <div data-cycle="" role="radiogroup">
          <input aria-label="today" defaultChecked name="show" type="radio" />
          <input aria-label="plan" name="show" type="radio" />
        </div>
      </>,
    );
    fireEvent.keyDown(globalThis.window, { key: 'd' });
    expect(screen.getByLabelText<HTMLInputElement>('plan').checked).toBe(true);
  });

  it('fades the new parts of a What changes screen while ⌥ is held, and on the toggle', () => {
    const { container } = render(
      <>
        {keys}
        <PeekToday>
          <span data-status="added">new</span>
        </PeekToday>
      </>,
    );
    const root = (): Element | null => container.querySelector('[data-peek]');
    fireEvent.keyDown(globalThis.window, { key: 'Alt', altKey: true });
    expect(root()).not.toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Let go of');
    fireEvent.keyUp(globalThis.window, { key: 'Alt' });
    expect(root()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show today' }));
    expect(root()).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Show with this plan' })).toBeTruthy();
  });
});
