// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { holdKeys } from '@/features/plan/walk-keys';

import { ProgressStrip, teamOf } from './progress-strip.client';
import { cutRail } from './rail-cut.client';

vi.mock(import('next/navigation'), async (original) => {
  const actual = await original();
  return {
    ...actual,
    useSearchParams: () => new actual.ReadonlyURLSearchParams(globalThis.location.search),
  };
});

beforeEach(() => {
  globalThis.history.replaceState(null, '', '/');
});
afterEach(cleanup);

const teams = [
  { id: 'team:web', name: 'Web', at: 2, of: 5 },
  { id: 'team:ops', name: 'Ops', at: null, of: 3 },
];
const strip = () => render(<ProgressStrip crumb={['3 · The journey', 'Pausing']} teams={teams} />);

describe('ProgressStrip', () => {
  it('names the chapter and the screen, and nothing about teams for everyone', () => {
    strip();
    const nav = screen.getByRole('navigation', { name: 'Where you are' });
    expect([...nav.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      '3 · The journey',
      'Pausing',
    ]);
    expect(screen.queryByRole('button', { name: 'Read the full plan' })).toBeNull();
  });

  it('places the screen among a team’s pages and leads back to the full plan', () => {
    globalThis.history.replaceState(null, '', '/?team=web');
    strip();
    expect(screen.getByText('Web’s pages · 2 of 5')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Read the full plan' }));
    expect(globalThis.location.search).toBe('');
  });

  it('says when the screen is not one of the team’s', () => {
    globalThis.history.replaceState(null, '', '/?team=team:ops');
    strip();
    expect(screen.getByText('Not one of Ops’ pages')).toBeTruthy();
  });

  it('shows the step a walk stands on', () => {
    strip();
    const releases: (() => void)[] = [];
    act(() => {
      releases.push(holdKeys({ move: () => false, here: () => 'Ask to pause · 2 of 4' }));
    });
    expect(screen.getByText('Ask to pause · 2 of 4')).toBeTruthy();
    act(() => {
      for (const release of releases) release();
    });
    expect(screen.queryByText('Ask to pause · 2 of 4')).toBeNull();
  });

  it('finds the team with or without its prefix', () => {
    expect(teamOf(teams, 'web')?.id).toBe('team:web');
    expect(teamOf(teams, 'team:ops')?.id).toBe('team:ops');
    expect(teamOf(teams, 'nobody')).toBeNull();
    expect(teamOf(teams, null)).toBeNull();
  });
});

const rail = (): HTMLElement => {
  const nav = document.createElement('nav');
  nav.innerHTML = '<ul><li><a href="/p/a/">A</a></li><li><a href="/p/b/">B</a></li></ul>';
  return nav;
};
const shown = (nav: HTMLElement): (string | null)[] =>
  [...nav.querySelectorAll('li')].filter((li) => li.hidden !== true).map((li) => li.textContent);

describe('cutRail', () => {
  it('hides the screens the lens leaves out, and shows them again without one', () => {
    const nav = rail();
    cutRail(nav, 'web', { 'team:web': ['/p/b/'] });
    expect(shown(nav)).toEqual(['A']);
    cutRail(nav, null, { 'team:web': ['/p/b/'] });
    expect(shown(nav)).toEqual(['A', 'B']);
  });

  it('leaves the rail whole for a team it does not know', () => {
    const nav = rail();
    cutRail(nav, 'nobody', { 'team:web': ['/p/b'] });
    expect(shown(nav)).toEqual(['A', 'B']);
  });
});
