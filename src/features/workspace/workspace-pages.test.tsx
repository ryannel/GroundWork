// @vitest-environment happy-dom
import path from 'node:path';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { domainViewOf } from '@/application/workspace-domain';
import { landscapeOf } from '@/application/workspace-landscape';
import { systemModelOf } from '@/application/workspace-model';
import { workspaceNavOf } from '@/application/workspace-nav';
import { findWorkspace } from '@/application/workspace-paths';
import { systemViewOf } from '@/application/workspace-system';
import { readWorkspaceModel } from '@/infrastructure/workspace-model';
import { readWorkspaces } from '@/infrastructure/workspace-store';

import { DomainPage, LandscapePage, SystemPage } from './index';

vi.mock('server-only', () => ({}));

afterEach(cleanup);

const root = path.resolve(import.meta.dirname, '../../../workspaces');

async function alder() {
  const workspace = findWorkspace(await readWorkspaces(root), 'alder-finch')!;
  const today = systemModelOf(workspace, await readWorkspaceModel(workspace, root));
  return { workspace, today, model: today.model };
}

const inspectable = (container: HTMLElement, id: string): Element | null =>
  container.querySelector(`[data-inspect="${id}"]`);

describe('LandscapePage', () => {
  it('says what is true, draws the landscape, and links journeys, domains and teams', async () => {
    const { workspace, model } = await alder();
    render(
      <LandscapePage
        folder="alder-finch"
        landscape={landscapeOf(workspace, model)}
        nav={[]}
        overlays={<p>the inspector</p>}
        plans={[]}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Alder & Finch');
    expect(screen.getByText(/^Alder & Finch runs 14 systems in 3 domains/)).toBeTruthy();
    expect(screen.getByRole('img', { name: /people, domains and outside services/ })).toBeTruthy();
    expect(screen.getByText('#team-checkout')).toBeTruthy();
    expect(screen.getByText('the inspector')).toBeTruthy();
    const buy = screen
      .getAllByRole('link')
      .find((a) => (a.getAttribute('href') ?? '').includes('/journeys/'));
    expect(buy).toBeTruthy();
    expect(screen.getByRole('link', { name: /^Website/ }).getAttribute('href')).toMatch(
      /^\/alder-finch\/website\/?$/,
    );
    expect(screen.getByText('No plans yet.')).toBeTruthy();
  });

  it('says how to add a domain when there are none', async () => {
    const { workspace, model } = await alder();
    render(
      <LandscapePage
        folder="shop"
        landscape={landscapeOf({ ...workspace, domains: [] }, model)}
        nav={[]}
      />,
    );
    expect(screen.getByText('No domains yet')).toBeTruthy();
    expect(screen.getByText('workspaces/shop/domains/')).toBeTruthy();
  });
});

describe('DomainPage', () => {
  it('shows its edges, its systems and what it offers as chips the inspector opens', async () => {
    const { workspace, model } = await alder();
    const { container } = render(
      <DomainPage
        nav={workspaceNavOf(workspace, [], { domain: 'order-to-delivery' })}
        parts={[]}
        view={domainViewOf(workspace, model, 'order-to-delivery')!}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Order to delivery');
    const hrefs = screen
      .getAllByRole('link', { name: 'Checkout' })
      .map((a) => a.getAttribute('href'));
    expect(hrefs.some((h) => /^\/alder-finch\/website\/checkout\/?$/.test(h ?? ''))).toBe(true);
    expect(inspectable(container, 'msg:order-placed')).not.toBeNull();
    expect(screen.getByText('No plan changes this domain yet.')).toBeTruthy();
  });
});

describe('SystemPage', () => {
  it('shows its code, its flows and each component with what it does', async () => {
    const { workspace, today } = await alder();
    const view = systemViewOf(workspace, today, { domain: 'website', system: 'checkout' })!;
    const { container } = render(
      <SystemPage
        flows={<p>the flows</p>}
        nav={workspaceNavOf(workspace, [], { domain: 'website', system: 'checkout' })}
        view={view}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Checkout');
    expect(screen.getByText(/^Not scanned yet/)).toBeTruthy();
    expect(screen.getByText('the flows')).toBeTruthy();
    expect(inspectable(container, 'svc:checkout')).not.toBeNull();
    expect(screen.queryByText('Plans')).toBeNull();
  });

  it('shows the plans landing on it, or says none do', async () => {
    const { workspace, today } = await alder();
    const view = systemViewOf(workspace, today, { domain: 'website', system: 'checkout' })!;
    const { rerender } = render(<SystemPage nav={[]} parts={[]} view={view} />);
    expect(screen.getByText('No plan changes this system yet.')).toBeTruthy();
    rerender(
      <SystemPage
        nav={[]}
        parts={[{ id: 'p', title: 'New prices', href: '/a/plans/p/', workItems: 4, done: 2 }]}
        view={view}
      />,
    );
    expect(screen.getByText('2 of 4 work items done')).toBeTruthy();
  });
});
