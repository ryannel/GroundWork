// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { acme as acmeKit } from '@/../test/workspace-kit';
import { domainDiagramOf } from '@/application/domain-diagram';
import { domainViewOf } from '@/application/workspace-domain';
import { workspaceNavOf } from '@/application/workspace-nav';
import { systemViewOf } from '@/application/workspace-system';

import { CatalogueList, DomainOverview, DomainPage, SystemPage } from './index';

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
  it('names the domain, counts what it holds and opens each way to read it as a tab', () => {
    const { workspace, model } = acme();
    pathname = '/acme/orders/flows/some-flow/';
    render(
      <DomainPage
        nav={workspaceNavOf(workspace, [], { domain: 'orders' })}
        view={domainViewOf(workspace, model, 'orders')!}
        words={3}
      >
        <p>the tab</p>
      </DomainPage>,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Orders');
    expect(screen.getByText('the tab')).toBeTruthy();
    const tabs = screen.getByRole('navigation', { name: 'Ways to read Orders' });
    const current = tabs.querySelector('[aria-current="page"]');
    expect(current?.textContent).toMatch(/^Flows\d+$/u);
    expect(tabs.textContent).toMatch(/Language3/u);
    const numbers = screen.getByRole('list', { name: 'Orders in numbers' });
    expect(numbers.textContent).toMatch(/2systems/u);
    expect(screen.getByRole('list', { name: 'Teams' }).children.length).toBeGreaterThan(0);
  });
});

describe('DomainOverview', () => {
  it('puts its plans first, then how its systems fit, each system and the busiest flows', () => {
    const { workspace, model } = acme();
    const view = domainViewOf(workspace, model, 'orders')!;
    render(
      <DomainOverview
        diagram={domainDiagramOf(workspace, model, 'orders')}
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
      .getAllByRole('link', { name: /Payments/u })
      .map((a) => a.getAttribute('href'));
    expect(hrefs.some((h) => /^\/acme\/orders\/payments\/?$/u.test(h ?? ''))).toBe(true);
    expect(screen.getByText('What it is about.')).toBeTruthy();
  });

  it('says when no plan changes the domain', () => {
    const { workspace, model } = acme();
    render(
      <DomainOverview
        diagram={domainDiagramOf(workspace, model, 'orders')}
        parts={[]}
        view={domainViewOf(workspace, model, 'orders')!}
      />,
    );
    expect(screen.getByText('No plan changes this domain yet.')).toBeTruthy();
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
    const { container } = render(
      <SystemPage
        flows={<p>the flows</p>}
        nav={workspaceNavOf(workspace, [], { domain: 'storefront', system: 'shop' })}
        view={view}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Shop');
    expect(screen.getByText(/^Not scanned yet/u)).toBeTruthy();
    expect(screen.getByText('the flows')).toBeTruthy();
    expect(inspectable(container, 'svc:shop-bff')).not.toBeNull();
    expect(screen.queryByRole('heading', { name: 'Plans' })).toBeNull();
  });

  it('shows the plans landing on it, or says none do', () => {
    const { workspace, today } = acme();
    const view = systemViewOf(workspace, today, { domain: 'storefront', system: 'shop' })!;
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
