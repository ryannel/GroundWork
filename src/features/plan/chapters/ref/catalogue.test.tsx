// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { filterRows } from './catalogue-filter';
import { Catalogue } from './catalogue.client';

vi.mock(import('next/navigation'), async (original) => {
  const actual = await original();
  return {
    ...actual,
    useSearchParams: () => new actual.ReadonlyURLSearchParams(globalThis.location.search),
    useRouter: () =>
      ({ push: vi.fn<(href: string) => void>() }) as unknown as ReturnType<typeof actual.useRouter>,
  };
});

const TEAMS = { 'team:a': 'Team A', 'team:b': 'Team B' };

const page = (
  <div>
    <section data-group="">
      <div data-search="alpha one" data-teams="team:a">
        alpha
        <div data-search="inner">nested</div>
      </div>
      <div data-search="beta two" data-teams="team:b">
        beta
      </div>
    </section>
    <section data-group="">
      <div data-search="gamma three">gamma</div>
    </section>
  </div>
);

const rowsOf = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[data-search]')];

beforeEach(() => {
  globalThis.history.replaceState(null, '', '/');
});
afterEach(cleanup);

describe('filterRows', () => {
  it('shows every row for no words and no lens', () => {
    const { container } = render(page);
    expect(filterRows(container, '', null)).toEqual({ shown: 3, inLens: 3, total: 3 });
    expect(rowsOf(container).every((r) => r.hidden === false)).toBe(true);
  });

  it('needs every word to match', () => {
    const { container } = render(page);
    expect(filterRows(container, 'beta two', null).shown).toBe(1);
    expect(filterRows(container, 'beta nope', null).shown).toBe(0);
  });

  it('hides the rows outside a team cut but keeps rows that name no team', () => {
    const { container } = render(page);
    expect(filterRows(container, '', 'team:a')).toEqual({ shown: 2, inLens: 2, total: 3 });
  });

  it('hides a group none of whose rows show, and leaves a nested row to its parent', () => {
    const { container } = render(page);
    filterRows(container, 'gamma', null);
    const groups = container.querySelectorAll<HTMLElement>('[data-group]');
    expect(groups[0]?.hidden).toBe(true);
    expect(groups[1]?.hidden).toBe(false);
    filterRows(container, 'alpha', null);
    expect(container.querySelector<HTMLElement>('[data-search="inner"]')?.hidden).toBe(false);
  });
});

describe('Catalogue', () => {
  const bodies = { asis: <p data-search="old">old</p>, tobe: <p data-search="new">new</p> };

  it('shows the first mode and switches with ?show=', async () => {
    const { container } = render(<Catalogue bodies={bodies} noun="things" teams={TEAMS} />);
    expect(container.textContent).toContain('old');
    fireEvent.click(screen.getByLabelText('With this plan'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(globalThis.location.search).toBe('?show=tobe');
  });

  it('reads the mode from the address', () => {
    globalThis.history.replaceState(null, '', '/?show=tobe');
    const { container } = render(<Catalogue bodies={bodies} noun="things" teams={TEAMS} />);
    expect(container.textContent).toContain('new');
    expect(container.textContent).not.toContain('old');
  });

  it('cuts to the lens team, says so, and lets go of it', async () => {
    globalThis.history.replaceState(null, '', '/?team=a');
    const { container } = render(<Catalogue bodies={{ diff: page }} noun="things" teams={TEAMS} />);
    expect(container.textContent).toContain('Team A’s');
    expect(rowsOf(container).find((r) => r.dataset.search === 'beta two')?.hidden).toBe(true);
    fireEvent.click(screen.getByText('Show everyone'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(globalThis.location.search).toBe('');
  });

  it('counts the matches while words are typed and clears them on Escape', async () => {
    const { container } = render(<Catalogue bodies={{ diff: page }} noun="things" teams={TEAMS} />);
    const box = screen.getByRole('searchbox');
    fireEvent.change(box, { target: { value: 'gamma' } });
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.textContent).toContain('1 of 3');
    fireEvent.keyDown(box, { key: 'Escape' });
    await act(async () => {
      await Promise.resolve();
    });
    expect((box as HTMLInputElement).value).toBe('');
  });

  it('leaves the box off when the rows carry no words', () => {
    render(<Catalogue bodies={{ diff: <p>x</p> }} noun="things" search={false} teams={TEAMS} />);
    expect(screen.queryByRole('searchbox')).toBeNull();
  });
});
