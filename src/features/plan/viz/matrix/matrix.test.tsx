// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { shop } from '@/../test/federation-kit';
import { pauseOrders } from '@/../test/fixtures/acme/plans/pause-orders';
import { checkoutContracts } from '@/../test/fixtures/acme/plans/work-contracts';
import { dispatchDate } from '@/../test/fixtures/acme/plans/work-dispatch';
import { modelOf } from '@/../test/plan-kit';
import { NamedChip, NamedChips } from '@/features/plan/common/named-chip';
import { NoneMark, TestButton } from '@/features/plan/common/test-button';
import { ContractGaps } from '@/features/plan/viz/matrix/contract-gaps';
import { ContractMatrix } from '@/features/plan/viz/matrix/contract-matrix';
import { CoverageMatrix } from '@/features/plan/viz/matrix/coverage-matrix';
import { Honesty } from '@/features/plan/viz/matrix/honesty';
import { PyramidStrip } from '@/features/plan/viz/matrix/pyramid-strip';

vi.mock(import('next/navigation'), async (original) => {
  const actual = await original();
  return {
    ...actual,
    useSearchParams: () => new actual.ReadonlyURLSearchParams(globalThis.location.search),
  };
});

const unitCount = () => document.querySelector('[data-level="unit"]')?.textContent;

afterEach(() => {
  cleanup();
  globalThis.history.replaceState(null, '', '/');
});

const load = (plan = dispatchDate) => modelOf(plan());

describe('pyramid strip', () => {
  it('draws five levels, end-to-end first, with a count each', () => {
    const model = load();
    const { container } = render(<PyramidStrip focus="contract" model={model} />);
    const rows = [...container.querySelectorAll<HTMLElement>('[data-level]')];
    expect(rows.map((r) => r.dataset.level)).toEqual([
      'e2e',
      'integration',
      'contract',
      'service',
      'unit',
    ]);
    expect(container.querySelector('[data-level="contract"]')?.getAttribute('aria-current')).toBe(
      'true',
    );
    expect(container.textContent).toContain('end-to-end');
    expect(container.textContent).toContain(' · ');
  });

  it('turns the contract note into a link when told where the links are listed', () => {
    const model = load(checkoutContracts);
    const { container } = render(<PyramidStrip contractHref="/contracts" model={model} />);
    const note = container.querySelector('a[href="/contracts"]');
    expect(note?.textContent).toContain('without a contract test');
  });

  it('counts the team in the address when it follows the lens', () => {
    const model = load();
    const everyone = render(<PyramidStrip lensed model={model} />);
    const all = unitCount();
    everyone.unmount();
    const team = 'team:catalogue';
    expect(model.teamCut(team).changes).toHaveLength(4);
    globalThis.history.replaceState(null, '', `/?team=${team.replace('team:', '')}`);
    render(<PyramidStrip lensed model={model} />);
    expect(unitCount()).not.toBe(all);
    expect(unitCount()).toContain(`of ${String(model.teamCut(team).changes.length)} change`);
  });
});

describe('coverage matrix', () => {
  it('lists every change with a count per level and totals beneath', () => {
    const model = load();
    const { container } = render(<CoverageMatrix model={model} />);
    expect(container.querySelectorAll('tbody tr button[data-inspect^="chg:"]')).toHaveLength(
      model.plan.changes!.length,
    );
    expect(container.querySelectorAll('thead th')).toHaveLength(7);
    expect(container.querySelector('tfoot')?.textContent).toContain('of 6');
    expect(container.textContent).toContain('a planned test: nothing has run yet');
  });

  it('opens a count to the tests behind it, or to the content it is given', () => {
    const model = load();
    const first = render(<CoverageMatrix model={model} />);
    const count = screen.getAllByRole('button', { name: /planned .* tests?$/u })[0]!;
    fireEvent.click(count);
    expect(first.container.querySelector('button[data-planned]')).not.toBeNull();
    first.unmount();
    render(
      <CoverageMatrix detail={(change, level) => <p>{`${change} at ${level}`}</p>} model={model} />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: /planned .* tests?$/u })[0]!);
    expect(screen.getByText(/^chg:.* at \w+$/u)).not.toBeNull();
  });

  it('marks the gaps a change has', () => {
    const model = load(pauseOrders);
    const { container } = render(<CoverageMatrix model={model} />);
    expect(model.coverage().rows.map((r) => r.gaps)).toEqual([['no-e2e'], ['unit-only', 'no-e2e']]);
    expect(container.querySelectorAll('[title*="No "]').length).toBeGreaterThan(0);
    expect(container.textContent).toContain('unit tests only');
  });

  it('says so when a team has no changes', () => {
    const model = load();
    const { container } = render(<CoverageMatrix lens="team:nobody" model={model} />);
    expect(container.textContent).toBe('No changes for this team in this plan.');
  });
});

describe('contract matrix', () => {
  it('sets consumers against providers with the tests between them', () => {
    const model = load();
    const { container } = render(<ContractMatrix model={model} />);
    expect(
      [...container.querySelectorAll<HTMLElement>('tbody tr th [data-inspect]')].map(
        (e) => e.dataset.inspect,
      ),
    ).toEqual(['svc:search-indexer', 'svc:order-api']);
    expect(container.querySelector('[data-inspect="tst:indexer-contract"]')).not.toBeNull();
    expect(container.querySelector('[data-inspect="tst:orders-contract"]')).not.toBeNull();
    expect(container.textContent).toContain('checks');
  });

  it('folds many providers into a list per consumer and names tests that check no call', () => {
    const model = load(checkoutContracts);
    const { container } = render(<ContractMatrix model={model} />);
    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelectorAll('section h4')).toHaveLength(5);
    expect(container.querySelector('[data-inspect="tst:receipt-contract"]')).not.toBeNull();
    expect(container.textContent).toContain('check no call between services');
  });

  it('lists the changed links nothing tests, and the ones it leaves alone', () => {
    const model = load(checkoutContracts);
    const { container } = render(<ContractGaps model={model} />);
    expect(container.querySelector('h3')?.textContent).toBe('1 changed link has no contract test');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(container.textContent).toContain('no contract test either');
  });

  it('draws only the line about untouched links when nothing changed', () => {
    const model = load(pauseOrders);
    const { container } = render(<ContractGaps model={model} />);
    expect(container.querySelector('table')).toBeNull();
    expect(container.textContent).toContain('this plan doesn’t change them');
  });
});

describe('honesty', () => {
  it('names the tests that claim a change they never run, when there are any', () => {
    const cases = [
      [dispatchDate, 2],
      [checkoutContracts, 1],
      [shop, 0],
      [pauseOrders, 0],
    ] as const;
    for (const [plan, claims] of cases) {
      const model = load(plan);
      const { container, unmount } = render(<Honesty model={model} />);
      const n = model.coverage().gaps.provesWithoutWalking.length;
      expect(n).toBe(claims);
      expect(container.querySelectorAll('li')).toHaveLength(n);
      expect(container.textContent.includes('Tests that never run what they prove')).toBe(n > 0);
      unmount();
    }
  });
});

describe('named chips and test buttons', () => {
  it('shows a test or a work item without a diff status', () => {
    const model = load();
    const test = model.plan.tests![0]!.id;
    const { container } = render(<NamedChip id={test} model={model} />);
    expect(container.querySelector('button')?.dataset.status).toBe('existing');
    cleanup();
    const chips = render(<NamedChips ids={[test, model.plan.changes![0]!.id]} model={model} />);
    expect(chips.container.querySelectorAll('button')).toHaveLength(2);
    chips.unmount();
    expect(render(<NamedChips ids={[]} model={model} />).container.textContent).toBe('');
  });

  it('leads a service with its team colour', () => {
    const model = load();
    const svc = model.plan.services[0]!.id;
    const { container } = render(<NamedChip id={svc} model={model} team />);
    expect(container.querySelector('[data-slot]')).not.toBeNull();
  });

  it('prints a planned test hollow, with the level when asked', () => {
    const model = load();
    const test = model.plan.tests![0]!;
    const { container } = render(<TestButton id={test.id} level model={model} />);
    const button = container.querySelector('button')!;
    expect(button.dataset.inspect).toBe(test.id);
    expect(button.title).toContain('Planned');
    expect(button.getAttribute('aria-label')).toContain('planned');
    expect(container.textContent).toContain(model.label(test.id));
    cleanup();
    expect(render(<NoneMark />).container.textContent).toBe('·none');
  });
});
