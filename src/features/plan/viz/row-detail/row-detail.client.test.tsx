// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { RowDetail } from '@/features/plan/viz/row-detail/row-detail.client';

afterEach(cleanup);

const cells = [
  { key: 'name', content: 'Fulfilment' },
  {
    key: 'svc',
    button: {
      text: '2',
      title: 'Services',
      names: ['Orders', 'Stock'],
      body: <span>Orders and Stock</span>,
    },
  },
  {
    key: 'ev',
    button: { text: '1', title: 'Events', label: 'One event', body: <span>order placed</span> },
  },
];

function Table({ expand = false }: { readonly expand?: boolean }) {
  return (
    <table>
      <tbody>
        <RowDetail cells={cells} expand={expand} />
      </tbody>
    </table>
  );
}

describe('RowDetail', () => {
  it('opens the panel behind a count and shuts it again', () => {
    render(<Table />);
    const button = screen.getByRole('button', { name: 'Services: 2' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Orders and Stock')).toBeNull();
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Orders and Stock')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Services' })).toBeDefined();
    fireEvent.click(button);
    expect(screen.queryByText('Orders and Stock')).toBeNull();
  });

  it('names what is behind the count on hover, and keeps panels in column order', () => {
    const { container } = render(<Table />);
    expect(container.textContent).toContain('Orders');
    fireEvent.click(screen.getByRole('button', { name: 'One event' }));
    fireEvent.click(screen.getByRole('button', { name: 'Services: 2' }));
    const headings = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(headings).toEqual(['Services', 'Events']);
  });

  it('starts every panel open when asked to expand', () => {
    render(<Table expand />);
    expect(screen.getByText('Orders and Stock')).toBeDefined();
    expect(screen.getByText('order placed')).toBeDefined();
  });
});
