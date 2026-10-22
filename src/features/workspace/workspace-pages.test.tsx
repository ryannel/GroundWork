// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { acme as acmeKit } from '@/../test/workspace-kit';
import { domainNavOf } from '@/application/domain-nav';
import { domainViewOf } from '@/application/workspace-domain';
import { systemViewOf } from '@/application/workspace-system';

import { CatalogueList, DomainOverview, DomainPage, DomainTab, SystemPage } from './index';

let pathname = '/acme/orders/';
vi.mock(import('next/navigation'), () => ({ usePathname: () => pathname }));

afterEach(cleanup);

function acme() {
  const { workspace, today } = acmeKit();
  return { workspace, today, model: today.model };
}

const inspectable = (container: HTMLElement, id: string): Element | null =>
  container.querySelector(`[data-inspect="${id}"]`);

describe('DomainPage', () => {
  it('lists each way to read the domain down the rail, leaving the header to the page being read', () => {
    const { workspace, model } = acme();
    pathname = '/acme/orders/flows/some-flow/';
    const view = domainViewOf(workspace, model, 'orders')!;
    render(
      <DomainPage nav={domainNavOf(workspace, view, { words: 3 })} view={view}>
        <p>the tab</p>
      </DomainPage>,
    );
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.getByText('the tab')).toBeTruthy();
    const rail = screen.getByRole('navigation', { name: 'Workspace' });
    expect(rail.textContent).toMatch(/^←\s*Acme/u);
    const current = rail.querySelector('[aria-current="page"]');
    expect(current?.textContent).toMatch(/Flows\d+$/u);
    expect(rail.textContent).toMatch(/Language3/u);
    expect(screen.queryByRole('list', { name: 'Orders in numbers' })).toBeNull();
  });
});

describe('DomainTab', () => {
  it('names the page under the domain it belongs to', () => {
    const { workspace, model } = acme();
    const view = domainViewOf(workspace, model, 'orders')!;
    render(<DomainTab says="Every flow." title="Flows" view={view} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Flows');
    expect(screen.getByRole('link', { name: 'Orders' }).getAttribute('href')).toMatch(
      /^\/acme\/orders\/?$/u,
    );
    expect(screen.getByText('Every flow.')).toBeTruthy();
  });
});

describe('DomainOverview', () => {
  it('puts each system first, then its edges and the busiest flows', () => {
    const { workspace, model } = acme();
    const view = domainViewOf(workspace, model, 'orders')!;
    render(
      <DomainOverview
        view={view}
        words={{
          summary: 'What it is about.',
          words: [{ id: 'con:x', label: 'Order', glyph: '◆' }],
        }}
      />,
    );
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles.slice(0, 2)).toEqual(['Systems', 'Edges']);
    expect(titles).not.toContain('Plans');
    expect(titles).toContain('Busiest flows');
    expect(titles).toContain('Language');
    const hrefs = screen
      .getAllByRole('link', { name: /Payments/u })
      .map((a) => a.getAttribute('href'));
    expect(hrefs.some((h) => /^\/acme\/orders\/payments\/?$/u.test(h ?? ''))).toBe(true);
    expect(screen.getByText('What it is about.')).toBeTruthy();
    const numbers = screen.getByRole('list', { name: 'Orders in numbers' });
    expect(numbers.textContent).toMatch(/2systems/u);
    expect(numbers.textContent).not.toMatch(/words/u);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Orders');
    expect(screen.getByRole('list', { name: 'Teams' }).children.length).toBeGreaterThan(0);
  });
});

describe('CatalogueList', () => {
  it('folds each row to a count, with every name a chip the inspector opens', () => {
    const { workspace, model } = acme();
    const view = domainViewOf(workspace, model, 'orders')!;
    const { container } = render(<CatalogueList catalogue={view.catalogue} />);
    expect(inspectable(container, 'msg:order-placed')).not.toBeNull();
    expect(container.querySelector('#calls details summary')).not.toBeNull();
  });
});

describe('SystemPage', () => {
  it('shows its code, its flows and each component with what it does', () => {
    const { workspace, today } = acme();
    const view = systemViewOf(workspace, today, { domain: 'storefront', system: 'shop' })!;
    const place = domainViewOf(workspace, today.model, 'storefront')!;
    const nav = domainNavOf(workspace, place, {
      words: 0,
      system: { id: 'shop', flows: true, data: false },
    });
    const { container } = render(<SystemPage flows={<p>the flows</p>} nav={nav} view={view} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Shop');
    expect(screen.getByText(/^Not scanned yet/u)).toBeTruthy();
    expect(screen.getByText('the flows')).toBeTruthy();
    expect(inspectable(container, 'svc:shop-bff')).not.toBeNull();
    const rail = screen.getByRole('navigation', { name: 'Workspace' });
    expect(rail.querySelector('[aria-current="page"]')?.textContent).toMatch(/Shop/u);
    expect(rail.querySelector('a[href*="shop"][href$="#components"]')).not.toBeNull();
    expect(container.querySelector('section#components')).not.toBeNull();
  });

  it('shows the plans landing on it, and how to make the first when none do', () => {
    const { workspace, today } = acme();
    const view = systemViewOf(workspace, today, { domain: 'storefront', system: 'shop' })!;
    const nav = {
      top: { back: { label: 'Acme', href: '/acme/' }, title: 'Storefront' },
      groups: [],
    };
    const { rerender } = render(<SystemPage nav={nav} parts={[]} view={view} />);
    expect(screen.getByRole('heading', { name: 'Plans' })).toBeTruthy();
    expect(screen.getByText('No plan changes Shop yet')).toBeTruthy();
    expect(screen.getByText(/groundwork-plan to plan a change to Shop/u)).toBeTruthy();
    rerender(
      <SystemPage
        nav={nav}
        parts={[{ id: 'p', title: 'New prices', href: '/a/plans/p/', workItems: 4, done: 2 }]}
        view={view}
      />,
    );
    expect(screen.getByText('2 of 4 work items done')).toBeTruthy();
  });
});
