// @vitest-environment happy-dom
import path from 'node:path';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { domainDiagramOf } from '@/application/domain-diagram';
import { domainViewOf } from '@/application/workspace-domain';
import { landscapeOf } from '@/application/workspace-landscape';
import { systemModelOf } from '@/application/workspace-model';
import { workspaceNavOf } from '@/application/workspace-nav';
import { findWorkspace } from '@/application/workspace-paths';
import { systemViewOf } from '@/application/workspace-system';
import { readWorkspaceModel } from '@/infrastructure/workspace-model';
import { readWorkspaces } from '@/infrastructure/workspace-store';

import { CatalogueList, DomainOverview, DomainPage, LandscapePage, SystemPage } from './index';

vi.mock('server-only', () => ({}));
let pathname = '/alder-finch/order-to-delivery/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

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

  it('puts the plans first, and leads with key journeys the code suggests', async () => {
    const { workspace, model } = await alder();
    const landscape = landscapeOf(workspace, model);
    render(<LandscapePage landscape={landscape} nav={[]} plans={[]} />);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Plans',
      'Landscape',
      'Key journeys',
      'Teams',
    ]);
    expect(screen.getByText(/^Suggested from the code/)).toBeTruthy();
    expect(screen.getAllByText(/, across \d+ domains?\.$/)).toHaveLength(
      landscape.key.cards.length,
    );
    expect(
      screen.getByRole('link', { name: /^All \d+ journeys and flows/ }).getAttribute('href'),
    ).toMatch(/^\/alder-finch\/journeys\/?$/);
  });

  it('leads with the key journeys a person named, and says which it cannot find', async () => {
    const { workspace, model } = await alder();
    const first = model.asIs.flows[0]!;
    const landscape = landscapeOf({ ...workspace, keyJourneys: [first.id, 'flow:nowhere'] }, model);
    render(<LandscapePage landscape={landscape} nav={[]} />);
    expect(landscape.key.cards.map((c) => c.title)).toEqual([first.name]);
    expect(landscape.map.paths.map((p) => p.title)).toEqual([first.name]);
    expect(screen.getByText(/named in workspace\.yaml/)).toBeTruthy();
    expect(screen.getByText(/“flow:nowhere”/)).toBeTruthy();
  });

  it('says how to add a domain when there are none', async () => {
    const { workspace, model } = await alder();
    render(
      <LandscapePage landscape={landscapeOf({ ...workspace, domains: [] }, model)} nav={[]} />,
    );
    expect(screen.getByText('No domains yet')).toBeTruthy();
    expect(screen.getByText('domains/<domain>/domain.yaml')).toBeTruthy();
    expect(
      screen.getByText(`${workspace.description ?? ''} None of its systems is mapped yet.`, {
        exact: false,
      }),
    ).toBeTruthy();
  });
});

describe('DomainPage', () => {
  it('names the domain, counts what it holds and opens each way to read it as a tab', async () => {
    const { workspace, model } = await alder();
    pathname = '/alder-finch/order-to-delivery/flows/some-flow/';
    render(
      <DomainPage
        nav={workspaceNavOf(workspace, [], { domain: 'order-to-delivery' })}
        view={domainViewOf(workspace, model, 'order-to-delivery')!}
        words={3}
      >
        <p>the tab</p>
      </DomainPage>,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Order to delivery');
    expect(screen.getByText('the tab')).toBeTruthy();
    const tabs = screen.getByRole('navigation', { name: 'Ways to read Order to delivery' });
    const current = tabs.querySelector('[aria-current="page"]');
    expect(current?.textContent).toMatch(/^Flows\d+$/);
    expect(tabs.textContent).toMatch(/Language3/);
    const numbers = screen.getByRole('list', { name: 'Order to delivery in numbers' });
    expect(numbers.textContent).toMatch(/6systems/);
    expect(screen.getByRole('list', { name: 'Teams' }).children.length).toBeGreaterThan(0);
  });
});

describe('DomainOverview', () => {
  it('puts its plans first, then how its systems fit, each system and the busiest flows', async () => {
    const { workspace, model } = await alder();
    const view = domainViewOf(workspace, model, 'order-to-delivery')!;
    render(
      <DomainOverview
        diagram={domainDiagramOf(workspace, model, 'order-to-delivery')}
        parts={[{ id: 'p', title: 'A plan', href: '/p/', workItems: 4, done: 1 }]}
        view={view}
        words={{
          summary: 'What it is about.',
          words: [{ id: 'con:x', label: 'Order', glyph: '◆' }],
        }}
      />,
    );
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles.slice(0, 3)).toEqual(['Plans', 'How the systems work together', 'Systems']);
    expect(titles).toContain('Busiest flows');
    expect(titles).toContain('Language');
    expect(screen.getByText('1 of 4 work items done')).toBeTruthy();
    const hrefs = screen
      .getAllByRole('link', { name: /Payments/ })
      .map((a) => a.getAttribute('href'));
    expect(hrefs.some((h) => /^\/alder-finch\/order-to-delivery\/payments\/?$/.test(h ?? ''))).toBe(
      true,
    );
    expect(screen.getByText('What it is about.')).toBeTruthy();
  });

  it('says when no plan changes the domain', async () => {
    const { workspace, model } = await alder();
    render(
      <DomainOverview
        diagram={domainDiagramOf(workspace, model, 'order-to-delivery')}
        parts={[]}
        view={domainViewOf(workspace, model, 'order-to-delivery')!}
      />,
    );
    expect(screen.getByText('No plan changes this domain yet.')).toBeTruthy();
  });
});

describe('CatalogueList', () => {
  it('folds each row to a count, with every name a chip the inspector opens', async () => {
    const { workspace, model } = await alder();
    const view = domainViewOf(workspace, model, 'order-to-delivery')!;
    const { container } = render(<CatalogueList catalogue={view.catalogue} />);
    expect(inspectable(container, 'msg:order-placed')).not.toBeNull();
    expect(container.querySelector('#calls details summary')).not.toBeNull();
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
