import { describe, expect, it } from 'vitest';

import { acme as acmeKit } from '@/../test/workspace-kit';
import { keyJourneysOf } from '@/application/key-journeys';
import { domainScopeOf, systemScopeOf, workspaceScopeOf } from '@/application/model-scope';
import { catalogueOf } from '@/application/today-catalogue';
import { todayJourneysOf } from '@/application/today-journeys';
import { mapScopeOf, outsideOf } from '@/application/today-scope';
import { domainViewOf } from '@/application/workspace-domain';
import { workspaceNavOf } from '@/application/workspace-nav';

function acme() {
  const { workspace, today } = acmeKit();
  return { workspace, model: today.model };
}

describe('the rail of a workspace read today', () => {
  it('counts every journey, names the key ones and marks the one being walked', () => {
    const { workspace, model } = acme();
    const all = todayJourneysOf(model);
    const first = workspaceNavOf(workspace, [], { today: model, section: 'journeys' });
    const journeys = first.find((group) => group.key === 'journeys')!;
    expect(journeys.count).toBe(String(all.length));
    expect(journeys.items.map((item) => item.title)).toEqual(
      keyJourneysOf(workspace, model).picked.map((k) => k.journey.title),
    );
    const named = new Set(journeys.items.map((item) => item.title));
    expect([...named]).toEqual(['Buy a product', 'Publish a product']);
    const other = all.find((j) => !named.has(j.title))!;
    expect(other.title).toBe('Cancel an order');
    const nav = workspaceNavOf(workspace, [], {
      today: model,
      section: 'journeys',
      key: other.key,
    });
    const open = nav.find((group) => group.key === 'journeys')!;
    expect(open.current).toBe(true);
    expect(open.items).toHaveLength(journeys.items.length + 1);
    expect(open.items.filter((item) => item.current).map((item) => item.title)).toEqual([
      other.title,
    ]);
  });

  it('lists the kinds of reference and marks the one being read', () => {
    const { workspace, model } = acme();
    const nav = workspaceNavOf(workspace, [], {
      today: model,
      section: 'reference',
      key: 'stores',
    });
    const reference = nav.find((group) => group.key === 'reference')!;
    expect(reference.open).toBe(true);
    expect(reference.items.find((item) => item.current)?.href).toBe('/acme/reference/stores/');
  });
});

describe('scopes', () => {
  it('draws the whole landscape and marks neighbours outside a domain', () => {
    const { workspace } = acme();
    const whole = workspaceScopeOf(workspace);
    expect(mapScopeOf(workspace, whole).focus).toBeNull();
    expect(outsideOf(whole)).toBeNull();
    const storefront = domainScopeOf(workspace, 'storefront')!;
    expect(mapScopeOf(workspace, storefront).focus).toContain('sys:shop');
    expect(mapScopeOf(workspace, storefront).focus).not.toContain('sys:ordering');
    expect(mapScopeOf(workspace, storefront).places['sys:products']).toBe('Catalogue');
    expect(outsideOf(storefront)).toBe('outside this domain, one step away');
    expect(domainScopeOf(workspace, 'nowhere')).toBeNull();
  });

  it("names a neighbour's domain only when it lies outside the system's own", () => {
    const { workspace } = acme();
    const shop = workspace.domains.find((d) => d.id === 'storefront')!;
    const places = mapScopeOf(workspace, systemScopeOf(workspace, 'shop')!).places;
    expect(Object.keys(places).some((key) => places[key] === shop.name)).toBe(false);
    expect(places['sys:products']).toBe('Catalogue');
  });

  it('keeps only what the components in a domain own in its catalogue', () => {
    const { workspace, model } = acme();
    const all = catalogueOf(model, workspaceScopeOf(workspace));
    const one = catalogueOf(model, domainScopeOf(workspace, 'storefront')!);
    expect(JSON.stringify(one).length).toBeLessThan(JSON.stringify(all).length);
  });
});

describe('a domain read today', () => {
  it('says what it does and who runs it', () => {
    const { workspace, model } = acme();
    const view = domainViewOf(workspace, model, 'orders')!;
    expect(JSON.stringify(view)).toMatch(/team/u);
    expect(view.purpose).toBe('Takes an order from placed to paid.');
    expect(view.teams.map((t) => t.name)).toEqual(['Orders', 'Payments']);
    expect(domainViewOf(workspace, model, 'nowhere')).toBeNull();
  });
});
