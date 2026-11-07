import { describe, expect, it } from 'vitest';

import { emptyQueryModel, queryModel } from '@/../test/fixtures/model-queries';
import { indexOf } from '@/application/model-index';
import type { WorkspaceModel } from '@/domain/workspace-model';

import { modelWorkspaceNavOf } from './model-navigation';

function fixture(): WorkspaceModel {
  return {
    ...queryModel(),
    teams: [{ id: 'team:partner', name: 'Partner', partner: true }],
    programmes: [{ id: 'prog:one', title: 'A programme', outcome: 'A recorded outcome' }],
    journeys: [{ id: 'jny:one', name: 'A journey' }],
    flows: [{ id: 'flow:one', name: 'A flow', steps: [] }],
  };
}

describe('native workspace navigation', () => {
  it('retains the real workspace paths and native counts, including entry flows and legacy services', () => {
    const nav = modelWorkspaceNavOf(indexOf(fixture()), ['one']);
    expect(nav.map((group) => [group.title, group.href])).toEqual([
      ['Landscape', '/queries/'],
      ['Plans', '/queries/plans/'],
      ['Programmes', '/queries/programmes/'],
      ['Partners', '/queries/partners/'],
      ['Queries', '/queries/queries/'],
      ['Journeys', '/queries/journeys/'],
      ['Entry flows', '/queries/entries/'],
      ['Services', '/queries/explorer/'],
      ['Reference', '/queries/reference/'],
    ]);
    expect(nav.find((group) => group.key === 'plans')?.count).toBe('1');
    expect(nav.find((group) => group.key === 'dom:queries')).toMatchObject({
      heading: 'Domains',
      count: '3',
    });
    expect(nav.find((group) => group.key === 'journeys')).toMatchObject({
      heading: 'Look up',
      count: '2',
      items: [],
    });
    expect(nav.find((group) => group.key === 'entries')?.count).toBe('4');
    expect(nav.find((group) => group.key === 'reference')?.items).toEqual([
      { href: '/queries/reference/components/', title: 'Components', count: '3', current: false },
      { href: '/queries/reference/stores/', title: 'Stores', count: '2', current: false },
      { href: '/queries/reference/apis/', title: 'APIs', count: '2', current: false },
      { href: '/queries/reference/schemas/', title: 'Schemas', count: '1', current: false },
      { href: '/queries/reference/events/', title: 'Events', count: '1', current: false },
      { href: '/queries/reference/flows/', title: 'Flows', count: '1', current: false },
    ]);
  });

  it('selects each overview section and leaves the map unselected on unrelated pages', () => {
    const index = indexOf(fixture());
    expect(modelWorkspaceNavOf(index, [])[0]).toMatchObject({ current: true, open: true });
    for (const section of ['language', 'people', 'value-flows'] as const) {
      const overview = modelWorkspaceNavOf(index, [], { section })[0];
      expect(overview?.open).toBe(true);
      expect(overview?.items.filter((item) => item.current)).toHaveLength(1);
    }
    expect(modelWorkspaceNavOf(index, [], { section: 'area' })[0]?.current).toBe(true);
    expect(
      modelWorkspaceNavOf(index, [], { section: 'entries' }).find((group) => group.current)?.key,
    ).toBe('entries');
    expect(
      modelWorkspaceNavOf(index, [], { domain: 'queries' }).find((group) => group.current)?.key,
    ).toBe('dom:queries');
    expect(
      modelWorkspaceNavOf(index, [], { domain: 'dom:queries' }).find((group) => group.current)?.key,
    ).toBe('dom:queries');
    const reference = modelWorkspaceNavOf(index, [], { section: 'reference', key: 'stores' }).find(
      (group) => group.key === 'reference',
    );
    expect(reference).toMatchObject({ current: true, open: true });
    expect(reference?.items.filter((item) => item.current).map((item) => item.title)).toEqual([
      'Stores',
    ]);
    const journeys = modelWorkspaceNavOf(index, [], { section: 'journeys', key: 'jny-one' }).find(
      (group) => group.key === 'journeys',
    );
    expect(journeys?.items).toEqual([
      { href: '/queries/journeys/jny-one/', title: 'A journey', current: true },
    ]);
  });

  it('keeps empty real sections while omitting unavailable work and reference kinds', () => {
    const nav = modelWorkspaceNavOf(indexOf(emptyQueryModel()), []);
    expect(nav.map((group) => group.key)).toEqual([
      'landscape',
      'plans',
      'journeys',
      'entries',
      'explorer',
      'reference',
    ]);
    expect(nav.find((group) => group.key === 'plans')).not.toHaveProperty('count');
    expect(nav.find((group) => group.key === 'journeys')).not.toHaveProperty('count');
    expect(nav.find((group) => group.key === 'reference')?.items).toEqual([]);
  });
});
