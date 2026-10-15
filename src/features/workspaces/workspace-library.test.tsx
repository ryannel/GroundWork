// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { WorkspaceCard } from '@/application/workspace-library';

import { WorkspaceLibrary } from './workspace-library';

const card = (over: Partial<WorkspaceCard>): WorkspaceCard => ({
  id: 'alder-finch',
  name: 'Alder & Finch',
  href: '/alder-finch/',
  description: 'The shop',
  isPrivate: false,
  facts: ['3 domains'],
  domains: [{ id: 'web', name: 'Website', href: '/alder-finch/web/', systems: '4 systems' }],
  plans: [
    {
      id: 'p',
      title: 'Show a delivery date',
      href: '/alder-finch/plans/p/',
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
    expect(screen.getByRole('link', { name: 'Alder & Finch' }).getAttribute('href')).toMatch(
      /^\/alder-finch\/?$/,
    );
    expect(screen.getByRole('link', { name: /Website/ }).getAttribute('href')).toMatch(
      /^\/alder-finch\/web\/?$/,
    );
    expect(screen.getByText('In delivery')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Show a delivery date/ }).getAttribute('href')).toMatch(
      /^\/alder-finch\/plans\/p\/?$/,
    );
    expect(screen.getByText('Private')).toBeTruthy();
    expect(screen.getByText(/No plans yet/)).toBeTruthy();
  });

  it('points to the workspace for plans it leaves out', () => {
    render(<WorkspaceLibrary library={{ cards: [card({ morePlans: 3 })] }} />);
    expect(screen.getByText('3 more on the workspace page →')).toBeTruthy();
  });
});
