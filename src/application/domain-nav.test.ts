import { describe, expect, it } from 'vitest';

import { acme } from '@/../test/workspace-kit';

import { domainNavOf, sectionId, systemSectionsOf } from './domain-nav';
import { domainViewOf } from './workspace-domain';

function orders() {
  const { workspace, today } = acme();
  return { workspace, view: domainViewOf(workspace, today.model, 'orders')! };
}

describe('domainNavOf', () => {
  it('steps back to the workspace and lists the domain’s pages, then its systems', () => {
    const { workspace, view } = orders();
    const nav = domainNavOf(workspace, view, { words: 3 });
    expect(nav.top).toEqual({
      back: { label: workspace.name, href: view.workspace.href },
      title: 'Orders',
    });
    const [pages, systems] = nav.groups;
    expect(pages).toMatchObject({ bare: true, byPath: true });
    expect(pages!.items.map((item) => item.title)).toContain('Language');
    expect(pages!.items[0]).toMatchObject({ title: 'Overview', current: true });
    expect(pages!.items[1]).toMatchObject({
      title: 'Target architecture',
      href: `${view.href}target/`,
    });
    expect(pages!.items[1]).not.toHaveProperty('count');
    expect(pages!.items[2]).toMatchObject({ title: 'Plans', href: `${view.href}plans/` });
    expect(pages!.items[2]).not.toHaveProperty('count');
    const counted = domainNavOf(workspace, view, { words: 3, plans: 2, stages: 5 }).groups[0]!;
    expect(counted.items[1]).toMatchObject({ title: 'Target architecture', count: '5' });
    expect(counted.items[2]).toMatchObject({ title: 'Plans', count: '2' });
    expect(systems).toMatchObject({ heading: 'Systems', bare: true });
    expect(systems!.items.map((item) => item.title)).toEqual(view.systems.map((s) => s.name));
    expect(systems!.items.every((item) => item.items === undefined)).toBe(true);
  });

  it('leaves out the language when the domain has no words', () => {
    const { workspace, view } = orders();
    const titles = domainNavOf(workspace, view, { words: 0 }).groups[0]!.items.map((i) => i.title);
    expect(titles).not.toContain('Language');
  });

  it('opens the system being read to the sections of its page', () => {
    const { workspace, view } = orders();
    const reading = view.systems[0]!;
    const nav = domainNavOf(workspace, view, {
      words: 0,
      system: { id: reading.id, flows: false, data: true },
    });
    expect(nav.groups[0]).toMatchObject({ byPath: false });
    expect(nav.groups[0]!.items.some((item) => item.current)).toBe(false);
    const open = nav.groups[1]!.items.find((item) => item.current)!;
    expect(open.title).toBe(reading.name);
    expect(open.items?.map((item) => item.title)).toEqual([
      'Plans',
      'Map',
      'Edges',
      'Components',
      'Data',
      'User journeys',
      'Code',
    ]);
    expect(open.items?.at(-1)?.href).toBe(`${reading.href}#code`);
  });
});

describe('systemSectionsOf', () => {
  it('always lists the plans first, and the flows only when there are some', () => {
    expect(systemSectionsOf({ id: 'x', flows: true, data: false })).toContain('Flows');
    expect(systemSectionsOf({ id: 'x', flows: false, data: false })[0]).toBe('Plans');
    expect(sectionId('User journeys')).toBe('user-journeys');
  });
});
