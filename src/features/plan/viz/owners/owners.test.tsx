// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { OwnershipTable } from '@/features/plan/viz/owners/ownership-table';

vi.mock('server-only', () => ({}));

afterEach(cleanup);

async function load() {
  const { readPlan } = await import('@/infrastructure/plan-store');
  const loaded = await readPlan('alder-finch', 'delivery-promise');
  return loaded.plan!;
}

const facts = (container: HTMLElement, team: string): string =>
  container.querySelector<HTMLElement>(`[data-facts-of="own:${team}"]`)!.dataset.facts!;
const flagged = (el: Element): boolean => el.hasAttribute(`data-dim`);

describe('OwnershipTable', () => {
  it('has a row per team and a column per kind of thing', async () => {
    const model = derive(await load());
    const teams = model.plan.teams.map((t) => t.id);
    const { container } = render(<OwnershipTable model={model} teamIds={teams} />);
    expect(container.querySelectorAll('thead th')).toHaveLength(10);
    expect(container.querySelectorAll('[data-facts-of]')).toHaveLength(teams.length);
    expect(container.textContent).toContain('events published');
    expect(container.textContent).toContain('#team-fulfilment');
    expect(facts(container, 'team:fulfilment').split('|')).toHaveLength(9);
  });

  it('opens a count to show its names as chips', async () => {
    const model = derive(await load());
    const { container } = render(<OwnershipTable model={model} teamIds={['team:fulfilment']} />);
    expect(container.querySelector('section')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Work items: / }));
    const panel = container.querySelector('section')!;
    expect(panel.querySelector('[data-inspect="wi:promise-service"]')).not.toBeNull();
  });

  it('starts every count open on the team page, with the name unlinked', async () => {
    const model = derive(await load());
    const { container } = render(
      <OwnershipTable expand link={false} model={model} teamIds={['team:fulfilment']} />,
    );
    expect(container.querySelectorAll('section').length).toBeGreaterThan(3);
    expect(container.querySelector('tbody [data-inspect="team:fulfilment"]')).toBeNull();
  });

  it('shows a faint dot for nothing, and dims the teams outside the lens', async () => {
    const model = derive(await load());
    const { container } = render(
      <OwnershipTable
        lens="team:fulfilment"
        model={model}
        teamIds={['team:legal', 'team:fulfilment']}
      />,
    );
    const rows = container.querySelectorAll('tbody tr');
    expect(flagged(rows[0]!)).toBe(true);
    expect(flagged(rows[1]!)).toBe(false);
    expect(container.querySelector('[title="No work items"]')).not.toBeNull();
  });

  it('says the confidence, and flags a low one', async () => {
    const plan = await load();
    const model = derive({
      ...plan,
      commitment: [{ team: 'team:fulfilment', confidence: 2 }],
    });
    const { container } = render(<OwnershipTable model={model} teamIds={['team:fulfilment']} />);
    expect(facts(container, 'team:fulfilment').endsWith('|2 of 5')).toBe(true);
    expect(container.querySelector('[data-low]')!.textContent).toBe('2 of 5');
  });

  it('says so when there are no teams', async () => {
    render(<OwnershipTable model={derive(await load())} teamIds={[]} />);
    expect(screen.getByText('No teams in this plan.')).toBeTruthy();
  });
});
