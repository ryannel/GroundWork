// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { dispatchDate } from '@/../test/fixtures/acme/plans/work-dispatch';
import { modelOf } from '@/../test/plan-kit';
import { OwnershipTable } from '@/features/plan/viz/owners/ownership-table';

afterEach(cleanup);

const load = dispatchDate;

const facts = (container: HTMLElement, team: string): string =>
  container.querySelector<HTMLElement>(`[data-facts-of="own:${team}"]`)!.dataset.facts!;
const flagged = (el: Element): boolean => el.hasAttribute(`data-dim`);

describe('OwnershipTable', () => {
  it('has a row per team and a column per kind of thing', () => {
    const model = modelOf(load());
    const teams = model.plan.teams.map((t) => t.id);
    const { container } = render(<OwnershipTable model={model} teamIds={teams} />);
    expect(container.querySelectorAll('thead th')).toHaveLength(10);
    expect(teams).toHaveLength(4);
    expect(container.querySelectorAll('[data-facts-of]')).toHaveLength(teams.length);
    expect(container.textContent).toContain('events published');
    expect(container.textContent).toContain('#team-orders');
    expect(facts(container, 'team:catalogue').split('|')).toEqual([
      '4',
      '3',
      '1',
      '2',
      '4',
      '4',
      '3',
      '0',
      'not yet',
    ]);
  });

  it('opens a count to show its names as chips', () => {
    const model = modelOf(load());
    const { container } = render(<OwnershipTable model={model} teamIds={['team:catalogue']} />);
    expect(container.querySelector('section')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Work items: /u }));
    const panel = container.querySelector('section')!;
    expect(panel.querySelector('[data-inspect="wi:publish-v2"]')).not.toBeNull();
  });

  it('starts every count open on the team page, with the name unlinked', () => {
    const model = modelOf(load());
    const { container } = render(
      <OwnershipTable expand link={false} model={model} teamIds={['team:catalogue']} />,
    );
    expect(container.querySelectorAll('section').length).toBeGreaterThan(3);
    expect(container.querySelector('tbody [data-inspect="team:catalogue"]')).toBeNull();
  });

  it('shows a faint dot for nothing, and dims the teams outside the lens', () => {
    const model = modelOf(load());
    const { container } = render(
      <OwnershipTable
        lens="team:catalogue"
        model={model}
        teamIds={['team:payments', 'team:catalogue']}
      />,
    );
    const rows = container.querySelectorAll('tbody tr');
    expect(flagged(rows[0]!)).toBe(true);
    expect(flagged(rows[1]!)).toBe(false);
    expect(container.querySelector('[title="No work items"]')).not.toBeNull();
  });

  it('says the confidence, and flags a low one', () => {
    const plan = load();
    const model = modelOf({
      ...plan,
      commitment: [{ team: 'team:catalogue', confidence: 2 }],
    });
    const { container } = render(<OwnershipTable model={model} teamIds={['team:catalogue']} />);
    expect(facts(container, 'team:catalogue').endsWith('|2 of 5')).toBe(true);
    expect(container.querySelector('[data-low]')!.textContent).toBe('2 of 5');
  });

  it('says so when there are no teams', () => {
    render(<OwnershipTable model={modelOf(load())} teamIds={[]} />);
    expect(screen.getByText('No teams in this plan.')).toBeTruthy();
  });
});
