// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { BarActions } from './bar-actions.client';
import { Menu } from './menu.client';

afterEach(cleanup);

describe('Menu', () => {
  it('opens on its button and closes on Esc or a click outside', () => {
    render(
      <Menu button="v2" label="Version history">
        <p>Inside</p>
      </Menu>,
    );
    const button = screen.getByRole('button', { name: 'Version history' });
    fireEvent.click(button);
    expect(screen.getByText('Inside')).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Inside')).toBeNull();
    fireEvent.click(button);
    fireEvent.click(document.body);
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('BarActions', () => {
  it('folds the actions behind More, which opens and closes them', () => {
    render(
      <BarActions>
        <button type="button">Search</button>
      </BarActions>,
    );
    const more = screen.getByRole('button', { name: /more/i });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(more);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
  });
});
