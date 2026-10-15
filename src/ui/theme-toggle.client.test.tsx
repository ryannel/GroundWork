// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ThemeToggle } from './theme-toggle.client';

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('ThemeToggle', () => {
  it('steps through system, light and dark, and remembers the choice', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-label')).toBe('Theme: follow the system. Switch to light');

    fireEvent.click(button);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('groundwork.theme')).toBe('light');
    expect(button.getAttribute('aria-label')).toBe('Theme: light. Switch to dark');

    fireEvent.click(button);
    expect(document.documentElement.dataset.theme).toBe('dark');

    fireEvent.click(button);
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('starts from the stored choice', () => {
    localStorage.setItem('groundwork.theme', 'dark');
    render(<ThemeToggle />);
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe(
      'Theme: dark. Switch to follow the system',
    );
  });
});
