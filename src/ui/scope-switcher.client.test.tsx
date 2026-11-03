// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AppBar } from './app-bar';
import { ScopeProvider } from './scope-switcher.client';

afterEach(cleanup);

const current = { label: 'Company', href: '/company/', group: 'Workspaces' };
const example = { label: 'Demo', href: '/demo/', group: 'Examples', note: 'example' };

describe('ScopeSwitcher', () => {
  it('does not add a switcher outside a named scope', () => {
    render(<AppBar title="Workspaces" />);
    expect(screen.queryByRole('navigation', { name: 'Switch workspace' })).toBeNull();
  });

  it('keeps the current scope visible and switches to a workspace root, not a nested page', () => {
    render(
      <ScopeProvider
        scope={{
          label: 'Workspace',
          current,
          links: [current, example],
          index: { label: 'All workspaces', href: '/' },
        }}
      >
        <AppBar title="Plan" />
      </ScopeProvider>,
    );
    expect(screen.getByText('Workspace')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Workspace: Company. Switch workspace' }));
    const selected = screen.getByRole('link', { name: 'Company' });
    expect(selected.getAttribute('aria-current')).toBe('true');
    expect(selected.getAttribute('href')).toMatch(/^\/company\/?$/u);
    expect(screen.getByRole('link', { name: 'Demo' }).getAttribute('href')).toMatch(/^\/demo\/?$/u);
    expect(screen.getByText('Examples')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'All workspaces' }).getAttribute('href')).toBe('/');
    fireEvent.click(selected);
    expect(screen.queryByRole('navigation', { name: 'Switch workspace' })).toBeNull();
  });

  it('labels an example as the current scope', () => {
    render(
      <ScopeProvider
        scope={{
          label: 'Workspace',
          current: example,
          links: [example],
          index: { label: 'All workspaces', href: '/' },
        }}
      >
        <AppBar title="Map" />
      </ScopeProvider>,
    );
    expect(screen.getByText('Demo (example)')).toBeTruthy();
  });
});
