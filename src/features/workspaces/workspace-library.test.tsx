// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { WorkspaceCard } from '@/application/workspace-library';

import { WorkspaceLibrary } from './workspace-library';

const card = (over: Partial<WorkspaceCard>): WorkspaceCard => ({
  id: 'acme',
  name: 'Acme',
  href: '/acme/',
  description: 'The shop',
  isPrivate: false,
  facts: ['3 domains'],
  domains: [
    { id: 'storefront', name: 'Storefront', href: '/acme/storefront/', systems: '2 systems' },
  ],
  plans: [
    {
      id: 'p',
      title: 'Show a delivery date',
      href: '/acme/plans/p/',
      group: 'delivery',
      note: '2 of five work items done',
      late: false,
      done: 2,
      total: 5,
    },
  ],
  morePlans: 0,
  ...over,
});

describe('WorkspaceLibrary', () => {
  it('shows each workspace with its domains and plans, and says when it is private', () => {
    render(
      <WorkspaceLibrary
        library={{
          cards: [
            card({}),
            card({ id: 'personal', name: 'Personal', isPrivate: true, plans: [], domains: [] }),
          ],
        }}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Workspaces');
    expect(screen.getByRole('link', { name: 'Acme' }).getAttribute('href')).toMatch(/^\/acme\/?$/u);
    expect(screen.getByRole('link', { name: /Storefront/u }).getAttribute('href')).toMatch(
      /^\/acme\/storefront\/?$/u,
    );
    expect(screen.getByText('In delivery')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: /Show a delivery date/u }).getAttribute('href'),
    ).toMatch(/^\/acme\/plans\/p\/?$/u);
    expect(screen.getByText('Private')).toBeTruthy();
    expect(screen.getByText(/No plans yet/u)).toBeTruthy();
  });

  it('points to the workspace for plans it leaves out', () => {
    render(<WorkspaceLibrary library={{ cards: [card({ morePlans: 3 })] }} />);
    expect(screen.getByText('3 more plans →')).toBeTruthy();
  });
});
