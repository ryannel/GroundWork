// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { NamedChip, NamedChips } from '@/features/plan/common/named-chip';
import { NoneMark, TestButton } from '@/features/plan/common/test-button';
import { ContractGaps } from '@/features/plan/viz/matrix/contract-gaps';
import { ContractMatrix } from '@/features/plan/viz/matrix/contract-matrix';
import { CoverageMatrix } from '@/features/plan/viz/matrix/coverage-matrix';
import { Honesty } from '@/features/plan/viz/matrix/honesty';
import { PyramidStrip } from '@/features/plan/viz/matrix/pyramid-strip';

vi.mock('server-only', () => ({}));

afterEach(cleanup);

async function load(slug = 'delivery-promise') {
  const { readPlan } = await import('@/infrastructure/plan-store');
  const loaded = await readPlan('alder-finch', slug);
  return derive(loaded.plan!);
}

describe('pyramid strip', () => {
  it('draws five levels, end-to-end first, with a count each', async () => {
    const model = await load();
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

  it('turns the contract note into a link when told where the links are listed', async () => {
    const model = await load('storefront-graph');
    const { container } = render(<PyramidStrip contractHref="/contracts" model={model} />);
    const note = container.querySelector('a[href="/contracts"]');
    expect(note?.textContent).toContain('without a contract test');
  });

  it('says so when a team has no changes', async () => {
    const model = await load();
    const { container } = render(<PyramidStrip lens="team:nobody" model={model} />);
    expect(container.textContent).toBe('');
  });
});

describe('coverage matrix', () => {
  it('lists every change with a count per level and totals beneath', async () => {
    const model = await load();
    const { container } = render(<CoverageMatrix model={model} />);
    expect(container.querySelectorAll('tbody tr button[data-inspect^="chg:"]')).toHaveLength(
      model.plan.changes!.length,
    );
    expect(container.querySelectorAll('thead th')).toHaveLength(7);
    expect(container.querySelector('tfoot')?.textContent).toContain(
      `of ${String(model.plan.changes!.length)}`,
    );
    expect(container.textContent).toContain('a planned test: nothing has run yet');
  });

  it('opens a count to the tests behind it, or to the content it is given', async () => {
    const model = await load();
    const first = render(<CoverageMatrix model={model} />);
    const count = screen.getAllByRole('button', { name: /planned .* tests?$/ })[0]!;
    fireEvent.click(count);
    expect(first.container.querySelector('button[data-planned]')).not.toBeNull();
    first.unmount();
    render(
      <CoverageMatrix detail={(change, level) => <p>{`${change} at ${level}`}</p>} model={model} />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: /planned .* tests?$/ })[0]!);
    expect(screen.getByText(/^chg:.* at \w+$/)).not.toBeNull();
  });

  it('marks the gaps a change has', async () => {
    const model = await load('invoice-vat-number');
    const { container } = render(<CoverageMatrix model={model} />);
    const gaps = model.coverage().rows.flatMap((r) => r.gaps);
    expect(container.querySelectorAll('[title*="No "]').length).toBeGreaterThan(0);
    if (gaps.includes('unit-only')) expect(container.textContent).toContain('unit tests only');
  });

  it('says so when a team has no changes', async () => {
    const model = await load();
    const { container } = render(<CoverageMatrix lens="team:nobody" model={model} />);
    expect(container.textContent).toBe('No changes for this team in this plan.');
  });
});

describe('contract matrix', () => {
  it('sets consumers against providers with the tests between them', async () => {
    const model = await load('stock-reservation');
    const { container } = render(<ContractMatrix model={model} />);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(container.querySelectorAll('[data-inspect^="tst:"]').length).toBeGreaterThan(0);
    expect(container.textContent).toContain('checks');
  });

  it('folds many providers into a list per consumer and names tests that check no call', async () => {
    const model = await load('storefront-graph');
    const { container } = render(<ContractMatrix model={model} />);
    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelectorAll('section h4').length).toBeGreaterThan(0);
    expect(container.textContent).toContain('check no call between services');
  });

  it('lists the changed links nothing tests, and the ones it leaves alone', async () => {
    const model = await load('storefront-graph');
    const { container } = render(<ContractGaps model={model} />);
    expect(container.querySelector('h3')?.textContent).toBe('1 changed link has no contract test');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(container.textContent).toContain('no contract test either');
  });

  it('draws only the line about untouched links when nothing changed', async () => {
    const model = await load('invoice-vat-number');
    const { container } = render(<ContractGaps model={model} />);
    expect(container.querySelector('table')).toBeNull();
    expect(container.textContent).toContain('this plan doesn’t change them');
  });
});

describe('honesty', () => {
  it('names the tests that claim a change they never run, when there are any', async () => {
    for (const slug of [
      'delivery-promise',
      'stock-reservation',
      'storefront-graph',
      'invoice-vat-number',
    ]) {
      const model = await load(slug);
      const { container, unmount } = render(<Honesty model={model} />);
      const n = model.coverage().gaps.provesWithoutWalking.length;
      expect(container.querySelectorAll('li')).toHaveLength(n);
      if (n > 0) expect(container.textContent).toContain('Tests that never run what they prove');
      unmount();
    }
  });
});

describe('named chips and test buttons', () => {
  it('shows a test or a work item without a diff status', async () => {
    const model = await load();
    const test = model.plan.tests![0]!.id;
    const { container } = render(<NamedChip id={test} model={model} />);
    expect(container.querySelector('button')?.dataset.status).toBe('existing');
    cleanup();
    const chips = render(<NamedChips ids={[test, model.plan.changes![0]!.id]} model={model} />);
    expect(chips.container.querySelectorAll('button')).toHaveLength(2);
    chips.unmount();
    expect(render(<NamedChips ids={[]} model={model} />).container.textContent).toBe('');
  });

  it('leads a service with its team colour', async () => {
    const model = await load();
    const svc = model.plan.services[0]!.id;
    const { container } = render(<NamedChip id={svc} model={model} team />);
    expect(container.querySelector('[data-slot]')).not.toBeNull();
  });

  it('prints a planned test hollow, with the level when asked', async () => {
    const model = await load();
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
