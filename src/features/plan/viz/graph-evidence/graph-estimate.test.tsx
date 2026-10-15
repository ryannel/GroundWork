// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';

import { GraphEstimate } from './graph-estimate';

vi.mock('server-only', () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const plan = await loadFixture('shop.yaml');
const model = derive(plan);

afterEach(cleanup);

describe('GraphEstimate', () => {
  it('calls a changed query plan a derived estimate', () => {
    const { container } = render(<GraphEstimate id="gql:product-page" model={model} />);
    expect(container.textContent).toBe('Derived estimate');
    expect(container.querySelector('[data-facts-of="gql:product-page"]')).not.toBeNull();
  });

  it('is silent when the registry check is the one on record', () => {
    const { container } = render(<GraphEstimate id="gql:product-page" mode="asIs" model={model} />);
    expect(container.textContent).toBe('');
  });

  it('is silent about something that is not an operation', () => {
    const { container } = render(<GraphEstimate id="gql:nope" model={model} />);
    expect(container.textContent).toBe('');
  });

  it('links the open registry question', () => {
    const asked = derive({
      ...plan,
      questions: [
        {
          id: 'q:plan-check',
          question: 'Does the registry check cover [[gql:product-page]] query plan?',
          status: 'open',
        },
      ],
    });
    render(<GraphEstimate id="gql:product-page" model={asked} />);
    expect(screen.getByRole('button', { name: 'registry check open' }).dataset.inspect).toBe(
      'q:plan-check',
    );
  });
});
