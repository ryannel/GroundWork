// @vitest-environment happy-dom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { acme } from '@/../test/workspace-kit';
import { targetViewOf } from '@/application/workspace-target';

import { DomainTarget } from './index';

afterEach(cleanup);

describe('DomainTarget', () => {
  it('draws the flow, each stage in words, then the shifts from today', () => {
    render(
      <DomainTarget flow={<p>The drawing</p>} target={targetViewOf(acme().today, 'orders')} />,
    );
    const flow = screen.getByRole('region', { name: 'Flow' });
    expect(within(flow).getByText('The drawing')).toBeTruthy();
    expect(document.querySelector('#stage-payment')?.textContent).toContain('Payment');
    expect(
      within(flow)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(['Order', 'Payment']);
    const shifts = screen.getByRole('region', { name: 'Shifts' });
    expect(within(shifts).getByText('Pay before announcing')).toBeTruthy();
    expect(within(shifts).getByText('Today')).toBeTruthy();
  });

  it('says how to start one where the domain has none', () => {
    render(<DomainTarget target={null} />);
    expect(screen.getByText('No target architecture yet')).toBeTruthy();
  });
});
