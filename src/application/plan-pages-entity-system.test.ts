import { describe, expect, it } from 'vitest';

import { acme } from '@/../test/workspace-kit';

import { systemGroups } from './plan-pages-entity-system';
import { systemPagesOf } from './workspace-paths';

const groups = (id: string) =>
  Object.fromEntries(systemGroups(acme().today.model, id).map((g) => [g.label, g.ids]));

describe('systemGroups', () => {
  it('names who a system leans on, who leans on it, its parts, stores and flows', () => {
    expect(groups('sys:ordering')).toEqual({
      'Gets data from': ['sys:payments'],
      'Gives data to': ['sys:shop'],
      Parts: ['svc:order-api', 'svc:order-mailer', 'svc:order-desk'],
      Stores: ['st:orders-db', 'st:order-events'],
      'Flows it takes part in': ['flow:cancel-order', 'flow:place-order'],
    });
  });

  it('has a consumer depend on the system whose events it reads', () => {
    expect(groups('sys:search')['Gets data from']).toEqual(['sys:products']);
    expect(groups('sys:products')['Gives data to']).toEqual(['sys:search']);
  });

  it('leaves out empty groups, and says nothing of anything but a system', () => {
    expect(Object.keys(groups('sys:accounts'))).toEqual(['Parts']);
    expect(systemGroups(acme().today.model, 'svc:order-api')).toEqual([]);
  });
});

describe('systemPagesOf', () => {
  it('gives each system its own page, under its domain', () => {
    const pages = systemPagesOf(acme().workspace);
    expect(pages['sys:ordering']).toBe('/acme/orders/ordering/');
    expect(Object.keys(pages)).toHaveLength(6);
  });
});
