// @vitest-environment happy-dom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { WorkspaceCard } from '@/application/workspace-library';

import { WorkspaceLibrary } from './workspace-library';

afterEach(cleanup);

const card = (over: Partial<WorkspaceCard>): WorkspaceCard => ({
  id: 'acme',
  name: 'Acme',
  href: '/acme/',
  description: 'The shop',
  isPrivate: false,
  isExample: false,
  location: null,
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

  it('separates examples from linked company workspaces regardless of privacy', () => {
    render(
      <WorkspaceLibrary
        library={{
          cards: [
            card({ id: 'demo', name: 'Demo', isExample: true }),
            card({ id: 'company', name: 'Company', isPrivate: true }),
          ],
        }}
      />,
    );
    expect(
      within(screen.getByRole('list', { name: 'Linked workspaces' })).getByRole('link', {
        name: 'Company',
      }),
    ).toBeTruthy();
    expect(
      within(screen.getByRole('list', { name: 'Example workspaces' })).getByRole('link', {
        name: 'Demo',
      }),
    ).toBeTruthy();
    expect(screen.getByText('Example')).toBeTruthy();
  });

  it('explains how to link a workspace when only examples are available', () => {
    render(<WorkspaceLibrary library={{ cards: [card({ isExample: true })] }} />);
    expect(screen.getByText(/No workspaces linked/u)).toBeTruthy();
    expect(screen.getByText('npm run workspace -- add <folder or repo URL>')).toBeTruthy();
  });

  it('shows linking details only when the route supplies them', () => {
    render(
      <WorkspaceLibrary
        library={{
          cards: [
            card({
              location: {
                folder: '../company-groundwork',
                repo: 'git@github.com:company/model.git',
                source: 'groundwork.local.yaml',
              },
            }),
          ],
        }}
      />,
    );
    expect(screen.getByText('../company-groundwork')).toBeTruthy();
    expect(screen.getByText('git@github.com:company/model.git')).toBeTruthy();
    expect(screen.getByText(/Registered through groundwork.local.yaml/u)).toBeTruthy();
  });
});
