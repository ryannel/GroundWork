// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { acme as acmeKit } from '@/../test/workspace-kit';
import { domainMapOf } from '@/application/landscape-domains';
import { landscapeOf } from '@/application/workspace-landscape';

import { LandscapePage, PeoplePage } from './index';

vi.mock(import('next/navigation'), () => ({ usePathname: () => '/acme/' }));

afterEach(cleanup);

function acme() {
  const { workspace, today } = acmeKit();
  return { workspace, model: today.model };
}

describe('LandscapePage', () => {
  it('says what is true and maps the domains and the people in them', () => {
    const { workspace, model } = acme();
    render(
      <LandscapePage
        landscape={landscapeOf(workspace, model)}
        nav={[]}
        overlays={<p>the inspector</p>}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Acme');
    expect(screen.getByText(/^Acme runs 6 systems in 3 domains/u)).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Map']);
    expect(screen.getByRole('img', { name: /customer, the domains and the people/u })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Order clerk' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Storefront' }).getAttribute('href')).toMatch(
      /^\/acme\/storefront\/?$/u,
    );
    expect(screen.getByText('the inspector')).toBeTruthy();
  });

  it('says how to add a domain when there are none', () => {
    const { workspace, model } = acme();
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

describe('PeoplePage', () => {
  it('lists the customer first, finds people by name, and opens their journeys', () => {
    const { workspace, model } = acme();
    render(<PeoplePage map={domainMapOf(workspace, model)} />);
    expect(screen.getByText('4 people, 1 customer')).toBeTruthy();
    const names = screen.getAllByRole('button', { pressed: false }).map((b) => b.textContent);
    expect(names[0]).toMatch(/^CustomerFinds/u);
    fireEvent.click(screen.getByRole('button', { name: /^Customer/u }));
    const panel = screen.getByRole('region', { name: "Customer's journeys" });
    expect(
      within(panel)
        .getByRole('link', { name: /Buy a product/u })
        .getAttribute('href'),
    ).toMatch(/^\/acme\/journeys\/uj-buy\/?$/u);
    expect(within(panel).queryByRole('link', { name: /Publish a product/u })).toBeNull();
    fireEvent.click(within(panel).getByRole('button', { name: 'Close' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a person' }), {
      target: { value: 'nobody at all' },
    });
    expect(screen.getByText('Nobody matches.')).toBeTruthy();
  });

  it('says how to add people when there are none', () => {
    render(<PeoplePage map={{ people: [], domains: [], links: [], journeys: [] }} />);
    expect(screen.getByText('Nobody yet')).toBeTruthy();
  });
});
