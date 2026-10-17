// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { shop } from '@/../test/federation-kit';
import { derive } from '@/application/plan/derive';

import { ChangesAhead } from './changes-ahead.client';
import { PinAhead } from './pin-ahead.client';
import { clearPins, pinsOf, setTrayOpen } from './tray-store';

const model = derive(shop());
const settled = Object.assign(Promise.resolve(model), { status: 'fulfilled', value: model });
vi.mock(import('@/features/plan/plan-model'), () => ({ pendingModel: () => ({ model: settled }) }));
vi.mock(import('next/navigation'), () => ({
  usePathname: () => '/acme/plans/shop/journey/browse/',
}));

const plan = { workspace: 'acme', slug: 'shop' };
const contracts = '/acme/plans/shop/changes/contracts/';

afterEach(() => {
  cleanup();
  setTrayOpen(false);
  clearPins('acme/shop');
});

describe('the changes-ahead tray', () => {
  it('shows nothing until something is pinned', () => {
    const { container } = render(<ChangesAhead here="/x/" plan={plan} src="plan.json" />);
    expect(container.innerHTML).toBe('');
  });

  it('pins what a marked step carries, and opens the tray from the mark', async () => {
    render(
      <>
        <PinAhead ids={['sch:gql-product', 'gql:product-page']} reasons={['price changes']} />
        <ChangesAhead here="/x/" plan={plan} src="plan.json" />
      </>,
    );
    expect(pinsOf('acme/shop').map((p) => p.from)).toEqual([
      '/acme/plans/shop/journey/browse/',
      '/acme/plans/shop/journey/browse/',
    ]);
    expect(screen.getByRole('button', { name: '◇ 2 changes ahead' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '◇ Changes ahead' }));
    await act(async () => {
      await settled;
    });
    const link = screen.getByRole('link', { name: '4.2 Interfaces that get a new version' });
    expect(link.getAttribute('href')).toContain('/acme/plans/shop/changes/contracts');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Changes ahead' })).toBeNull();
  });

  it('ticks a pin off once the screen that shows its change is read', async () => {
    render(<PinAhead ids={['sch:gql-product']} reasons={[]} />);
    render(<ChangesAhead here={contracts} plan={plan} src="plan.json" />);
    await act(async () => {
      await settled;
    });
    expect(screen.getByRole('button', { name: 'All 1 planned changes seen ✓' })).toBeTruthy();
  });
});
