// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Neighbours } from '@/application/plan-pages';
import { Pager } from '@/features/plan/pager.client';
import { SegTabs } from '@/features/plan/viz/query-plan/seg-tabs.client';
import { leaveFor, walkBeside, walkMove } from '@/features/plan/walk-keys';

import { Stops } from './stops.client';

vi.mock('next/navigation', () => ({ usePathname: () => '/w/plans/p/today/system/' }));

const STOPS = [
  { key: 'owners', title: 'Who owns what', headline: 'Eleven teams own it.', lede: 'Owners.' },
  { key: 'calls', title: 'Who calls whom', headline: 'Checkout calls three.', lede: 'Calls.' },
  { key: 'events', title: 'What is announced', headline: 'Two topics carry it.', lede: 'Events.' },
];

const NEIGHBOURS: Neighbours = {
  previous: {
    chapter: 'today',
    screen: 'domain',
    title: 'The domain',
    href: '/w/plans/p/today/domain/',
  },
  next: {
    chapter: 'today',
    screen: 'screens',
    title: 'What people see today',
    href: '/w/plans/p/today/screens/',
  },
  previousChapter: null,
  nextChapter: null,
  opens: null,
  end: null,
};

const step = (by: -1 | 1): boolean => {
  let took = false;
  act(() => {
    took = walkMove(by);
  });
  return took;
};

beforeEach(() => {
  globalThis.history.replaceState(null, '', '/w/plans/p/today/system/');
});

afterEach(cleanup);

describe('a screen read in stops', () => {
  it('steps through its stops with the keys, keeps the stop in the address, and lets go at the end', () => {
    render(<Stops stops={STOPS} title="The system map" />);
    expect(screen.getByText('Eleven teams own it.')).toBeTruthy();
    expect(walkBeside(1)).toBe('Who calls whom');
    expect(walkBeside(-1)).toBeNull();
    expect(step(1)).toBe(true);
    expect(screen.getByText('Checkout calls three.')).toBeTruthy();
    expect(new URLSearchParams(globalThis.location.search).get('stop')).toBe('calls');
    expect(step(1)).toBe(true);
    expect(step(1)).toBe(false);
    expect(step(-1)).toBe(true);
    expect(screen.getByText('Checkout calls three.')).toBeTruthy();
  });

  it('opens on the stop the address names', () => {
    globalThis.history.replaceState(null, '', '/w/plans/p/today/system/?stop=events');
    render(<Stops stops={STOPS} title="The system map" />);
    expect(screen.getByText('Two topics carry it.')).toBeTruthy();
  });

  it('opens on its last stop when the reader steps back into it', () => {
    leaveFor('/w/plans/p/today/system', -1);
    render(<Stops stops={STOPS} title="The system map" />);
    expect(screen.getByText('Two topics carry it.')).toBeTruthy();
  });

  it('turns the pager into Next step until the last stop', () => {
    render(
      <>
        <Stops stops={STOPS} title="The system map" />
        <Pager neighbours={NEIGHBOURS} />
      </>,
    );
    const next = screen.getByRole('button', { name: /next step/i });
    expect(next.textContent).toContain('Who calls whom');
    expect(screen.queryByRole('button', { name: /previous step/i })).toBeNull();
    fireEvent.click(next);
    expect(screen.getByText('Checkout calls three.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /previous step/i }).textContent).toContain(
      'Who owns what',
    );
    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    expect(screen.queryByRole('button', { name: /next step/i })).toBeNull();
    expect(screen.getByRole('link', { name: /what people see today/i })).toBeTruthy();
  });
});

describe('stepped tabs', () => {
  const tabs = [
    { key: 'flow:a', label: 'Flow A', content: <p>Panel A</p> },
    { key: 'flow:b', label: 'Flow B', content: <p>Panel B</p> },
  ];

  it('are the screen’s stops: the keys move between them and the address names one', () => {
    render(<SegTabs label="Flows that change" stepped tabs={tabs} />);
    expect(screen.getByText('Panel B').closest('[hidden]')).not.toBeNull();
    expect(step(1)).toBe(true);
    expect(screen.getByText('Panel A').closest('[hidden]')).not.toBeNull();
    expect(new URLSearchParams(globalThis.location.search).get('stop')).toBe('flow:b');
    expect(step(1)).toBe(false);
  });

  it('leave the keys alone when not stepped', () => {
    render(<SegTabs label="Show as" tabs={tabs} />);
    expect(step(1)).toBe(false);
  });
});
