// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { DesignPage } from './design-page';

afterEach(cleanup);

describe('DesignPage', () => {
  it('shows a specimen of each piece, with what it is for', () => {
    render(<DesignPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Design system' })).toBeDefined();
    for (const name of [
      'Text',
      'Button',
      'SearchField',
      'Select',
      'FilterChips',
      'Badge',
      'List',
      'DataTable',
      'Stack',
      'Cluster',
      'SplitView',
    ]) {
      expect(screen.getByRole('heading', { level: 3, name })).toBeDefined();
    }
  });

  it('lets each control be tried by hand', () => {
    render(<DesignPage />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search plans' }), {
      target: { value: 'tax' },
    });
    expect(screen.getByRole<HTMLInputElement>('searchbox', { name: 'Search plans' }).value).toBe(
      'tax',
    );
    const toggle = screen.getByRole('button', { name: 'Toggle' });
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });
});
