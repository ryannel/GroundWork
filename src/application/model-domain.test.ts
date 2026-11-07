import { describe, expect, it } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';
import { indexOf } from '@/application/model-index';
import type { WorkspaceModel } from '@/domain/workspace-model';

import {
  modelDomainNavOf,
  modelDomainViewOf,
  modelDomainWordsOf,
  modelSystemCataloguesOf,
} from './model-domain';

function fixture(): WorkspaceModel {
  const base = queryModel();
  const original = base.domains[0];
  if (original === undefined) throw new Error('Missing domain');
  return {
    ...base,
    teams: [
      { id: 'team:a', name: 'A team', colour: 4 },
      { id: 'team:b', name: 'B team' },
    ],
    domains: [
      {
        ...original,
        purpose: 'Describe A',
        language: {
          summary: 'A words',
          concepts: [{ id: 'con:a', name: 'A term', means: 'A meaning' }],
        },
        systems: original.systems.filter((system) => system.id !== 'sys:b'),
      },
      {
        ...original,
        id: 'dom:remote',
        name: 'Remote',
        systems: original.systems.filter((system) => system.id === 'sys:b'),
      },
    ],
    actors: [{ id: 'actor:customer', name: 'Customer', customer: true }],
    flows: [
      {
        id: 'flow:story',
        name: 'Recorded story',
        actor: 'Customer',
        trigger: 'An authored trigger',
        outcome: 'An authored outcome',
        steps: [
          {
            id: 'go',
            from: 'svc:a',
            to: 'svc:b',
            action: 'A narrated exchange',
            transport: 'Unknown',
          },
        ],
      },
    ],
    journeys: [
      { id: 'jny:story', name: 'Customer journey', actor: 'actor:customer', flows: ['flow:story'] },
    ],
  };
}

describe('native domain views', () => {
  it('reuses the canonical domain in one index and rebuilds every value for a new index', () => {
    const model = fixture();
    const index = indexOf(model);
    const first = modelDomainViewOf(index, 'queries');
    expect(modelDomainViewOf(index, 'dom:queries')).toBe(first);
    expect(modelDomainViewOf(index, 'remote')).not.toBe(first);
    expect(modelDomainViewOf(index, 'missing')).toBeNull();
    const sameFacts = modelDomainViewOf(indexOf(model), 'queries');
    expect(sameFacts).toEqual(first);
    expect(sameFacts).not.toBe(first);
    const changed = indexOf({
      ...model,
      domains: model.domains.map((domain) =>
        domain.id === 'dom:queries'
          ? { ...domain, name: 'Renamed domain', purpose: 'New purpose' }
          : domain,
      ),
    });
    expect(modelDomainViewOf(changed, 'queries')).toMatchObject({
      name: 'Renamed domain',
      purpose: 'New purpose',
    });
    expect(first).toMatchObject({ name: 'Queries', purpose: 'Describe A' });
  });

  it('keeps canonical cards, exact domain counts and source-selected team colours', () => {
    const model = fixture();
    const before = JSON.stringify(model);
    const index = indexOf(model);
    const view = modelDomainViewOf(index, 'queries');
    expect(view).toMatchObject({
      domainId: 'dom:queries',
      name: 'Queries',
      href: '/queries/queries/',
      purpose: 'Describe A',
      counts: { systems: 2, components: 1, flows: 1, calls: 1, events: 1, stores: 0 },
      teams: [{ name: 'A team', slot: 4 }],
    });
    expect(view?.systems.find((system) => system.id === 'sys:unmapped')?.does).toBe(
      'Implementation not mapped.',
    );
    expect(view?.systems.find((system) => system.id === 'sys:a')).toMatchObject({
      href: '/queries/queries/a/',
      repos: ['fixture/a'],
      team: { slot: 4 },
    });
    const remote = modelDomainViewOf(index, 'dom:remote');
    expect(remote?.teams).toEqual([{ name: 'B team', slot: 2 }]);
    expect(remote?.catalogue.data[0]).toMatchObject({
      head: { id: 'st:remote' },
      note: 'Kept by A',
    });
    expect(view?.neighbours.reaches.map((row) => row.id)).toEqual(
      expect.arrayContaining(['sys:b', 'ext:supplier']),
    );
    expect(view?.provenance).toEqual(
      index
        .edges()
        .filter(
          (edge) =>
            index.place(edge.from)?.domain === 'dom:queries' ||
            index.place(edge.to)?.domain === 'dom:queries',
        ),
    );
    expect(view?.gaps).toContainEqual({
      id: 'api:supplier',
      kind: 'no_handler',
      message: 'No handler detail is recorded.',
    });
    const serialised = JSON.stringify(view);
    expect(JSON.parse(serialised)).toEqual(view);
    expect(JSON.stringify(model)).toBe(before);
    expect({ view, remote }).toMatchSnapshot('declared scope, placement, neighbours and gaps');
  });

  it('retains authored journey and flow wording without deriving execution from narration', () => {
    const model = fixture();
    const index = indexOf(model);
    const edges = index.edges();
    const view = modelDomainViewOf(index, 'queries');
    expect(view?.flows[0]).toMatchObject({
      id: 'flow:story',
      href: '/queries/queries/flows/story/',
      steps: 1,
      here: 1,
      entry: 'A',
    });
    expect(view?.journeys.map((card) => card.key)).toEqual(['jny-story', 'flow-story']);
    expect(view?.journeys[0]).toMatchObject({
      actor: 'Customer',
      trigger: 'An authored trigger',
      outcome: 'An authored outcome',
      systems: ['sys:a', 'sys:b'],
      through: 'A and B',
    });
    expect(index.edges()).toEqual(edges);
    expect(edges.some((edge) => edge.from === 'svc:a' && edge.to === 'svc:b')).toBe(false);
    expect(modelDomainWordsOf(index, 'queries')).toMatchObject({
      summary: 'A words',
      words: [{ id: 'con:a', label: 'A term' }],
    });
    expect(modelDomainWordsOf(index, 'remote')).toBeNull();
  });

  it('uses the same catalogue projection for domain totals and each system and retains domain navigation', () => {
    const index = indexOf(fixture());
    const view = modelDomainViewOf(index, 'queries');
    if (view === null) throw new Error('Missing domain view');
    const catalogues = modelSystemCataloguesOf(index, 'queries');
    expect(catalogues.map((system) => system.id)).toEqual(['sys:a']);
    expect(catalogues[0]?.catalogue).toEqual(view.catalogue);
    const nav = modelDomainNavOf(index, view, 2);
    expect(nav.top).toEqual({
      back: { label: 'Query fixture', href: '/queries/' },
      title: 'Queries',
    });
    expect(nav.groups[0]?.items.find((item) => item.title === 'Plans')?.count).toBe('2');
    expect(modelDomainViewOf(index, 'missing')).toBeNull();
    expect(modelDomainWordsOf(index, 'missing')).toBeNull();
    expect(modelSystemCataloguesOf(index, 'missing')).toEqual([]);
  });
});
