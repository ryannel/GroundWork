// @vitest-environment happy-dom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { walkBeside, walkMove } from '@/features/plan/walk-keys';

import { EventSteps } from './event-steps.client';
import { closeLast, showEvent } from './show-event';

vi.mock(import('next/navigation'), () => ({ usePathname: () => '/w/plans/p/ref/events/' }));

const EVENTS = [
  { key: 'msg:a', title: 'a.made' },
  { key: 'msg:b', title: 'b.made' },
];

const lines = () => (
  <>
    <details data-event="msg:a">
      <summary>a.made</summary>
    </details>
    <details data-event="msg:b">
      <summary>b.made</summary>
    </details>
  </>
);

const stop = () => new URLSearchParams(globalThis.location.search).get('stop');
const open = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLDetailsElement>('details')]
    .filter((d) => d.open)
    .map((d) => d.dataset.event);
const step = (by: -1 | 1): boolean => {
  let took = false;
  act(() => {
    took = walkMove(by);
  });
  return took;
};

beforeEach(() => {
  globalThis.history.replaceState(null, '', '/w/plans/p/ref/events/');
});

afterEach(cleanup);

describe('showEvent', () => {
  it('opens one line, marks it current and closes the one the last step opened', () => {
    const { container } = render(lines());
    expect(showEvent(container, 'msg:a')).toBe(true);
    expect(open(container)).toEqual(['msg:a']);
    expect(showEvent(container, 'msg:b')).toBe(true);
    expect(open(container)).toEqual(['msg:b']);
    expect(container.querySelector('[data-current]')?.textContent).toBe('b.made');
    expect(showEvent(container, 'msg:none')).toBe(false);
    expect(open(container)).toEqual([]);
    expect(container.querySelector('[data-current]')).toBeNull();
  });

  it('leaves a line the reader opened by hand open', () => {
    const { container } = render(lines());
    const a = container.querySelector<HTMLDetailsElement>('[data-event="msg:a"]');
    if (a !== null) a.open = true;
    showEvent(container, 'msg:b');
    closeLast(container);
    expect(open(container)).toEqual(['msg:a']);
  });
});

describe('EventSteps', () => {
  it('steps through the events one at a time and keeps the open one in the address', () => {
    const { container } = render(<EventSteps events={EVENTS}>{lines()}</EventSteps>);
    expect(open(container)).toEqual([]);
    expect(walkBeside(1)).toBe('a.made');
    expect(step(1)).toBe(true);
    expect(stop()).toBe('msg:a');
    expect(open(container)).toEqual(['msg:a']);
    expect(step(1)).toBe(true);
    expect(stop()).toBe('msg:b');
    expect(open(container)).toEqual(['msg:b']);
    expect(step(1)).toBe(false);
    expect(step(-1)).toBe(true);
    expect(step(-1)).toBe(true);
    expect(stop()).toBe('all');
    expect(open(container)).toEqual([]);
  });

  it('opens at the event the address names', () => {
    globalThis.history.replaceState(null, '', '/w/plans/p/ref/events/?stop=msg:b');
    const { container } = render(<EventSteps events={EVENTS}>{lines()}</EventSteps>);
    expect(open(container)).toEqual(['msg:b']);
  });
});
