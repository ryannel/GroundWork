import { describe, expect, it } from 'vitest';

import { emptyQueryModel, queryModel } from '@/../test/fixtures/model-queries';
import { indexOf } from '@/application/model-index';
import type { ModelSystem, WorkspaceModel } from '@/domain/workspace-model';

import { modelLandscapeOf } from './model-landscape';

function fixture(): WorkspaceModel {
  const base = queryModel();
  const domain = base.domains[0];
  if (domain === undefined) throw new Error('Missing fixture domain');
  const example = domain.systems[0];
  if (example === undefined) throw new Error('Missing fixture system');
  const unrelated: ModelSystem = {
    ...example,
    id: 'sys:unrelated',
    name: 'Unrelated',
    mapped: false,
    components: [],
    interfaces: [],
    handlers: [],
    relationships: [],
    connections: [],
  };
  return {
    ...base,
    actors: [
      { id: 'actor:customer', name: 'Customer', customer: true, uses: ['svc:a'] },
      { id: 'actor:staff', name: 'Staff', uses: ['st:remote'] },
    ],
    domains: [
      { ...domain, systems: domain.systems.filter((system) => system.id === 'sys:a') },
      {
        ...domain,
        id: 'dom:remote',
        name: 'Remote',
        systems: domain.systems.filter((system) => system.id === 'sys:b'),
      },
      { ...domain, id: 'dom:unrelated', name: 'Unrelated', systems: [unrelated] },
    ],
    flows: [
      {
        id: 'flow:story',
        name: 'Narrated only',
        actor: 'Customer',
        steps: [
          {
            id: 'story',
            from: 'svc:a',
            to: 'sys:unrelated',
            action: 'A narrative without execution backing',
            transport: 'Unknown',
          },
        ],
      },
      { id: 'flow:unknown', name: 'Unknown instigator', actor: 'A person not declared', steps: [] },
    ],
    journeys: [
      {
        id: 'jny:story',
        name: 'A narrated journey',
        actor: 'actor:customer',
        flows: ['flow:story'],
      },
    ],
  };
}

describe('native workspace landscape', () => {
  it('draws declared native domains and people using containment independently of resource ownership', () => {
    const model = fixture();
    const before = JSON.stringify(model);
    const index = indexOf(model);
    const landscape = modelLandscapeOf(index);
    expect(landscape.map.people.find((person) => person.id === 'actor:customer')).toMatchObject({
      customer: true,
      domains: ['dom:queries'],
    });
    expect(landscape.map.people.find((person) => person.id === 'actor:staff')?.domains).toEqual([
      'dom:remote',
    ]);
    expect(landscape.map.domains.find((domain) => domain.id === 'dom:remote')).toMatchObject({
      people: ['actor:staff'],
      href: '/queries/remote/',
    });
    expect(landscape.drawing.boxes.map((box) => box.id)).toEqual(
      expect.arrayContaining(['dom:queries', 'dom:remote', 'dom:unrelated', 'actor:customer']),
    );
    expect(landscape.map.links.find((link) => link.id === 'dom:queries|dom:remote')?.kinds).toEqual(
      ['msg', 'data'],
    );
    expect(landscape.provenance).toEqual(index.edges());
    expect(landscape.facts).toContain('1 system with unmapped implementation');
    const serialised = JSON.stringify(landscape);
    expect(JSON.parse(serialised)).toEqual(landscape);
    expect(JSON.stringify(model)).toBe(before);
    expect(landscape).toMatchSnapshot(
      'mapped people, scoped evidence and exact domain connections',
    );
  });

  it('retains narrated journey placement without adding execution links or inventing unknown actors', () => {
    const landscape = modelLandscapeOf(indexOf(fixture()));
    const journey = landscape.map.journeys.find((row) => row.key === 'jny-story');
    expect(journey).toMatchObject({
      actor: 'actor:customer',
      href: '/queries/journeys/jny-story/',
      domains: ['dom:queries', 'dom:unrelated'],
      lines: ['actor:customer|dom:queries'],
    });
    expect(landscape.map.links.some((link) => [link.a, link.b].includes('dom:unrelated'))).toBe(
      false,
    );
    expect(landscape.map.people.map((person) => person.id)).toEqual([
      'actor:customer',
      'actor:staff',
    ]);
    expect(landscape.map.journeys.find((row) => row.key === 'flow-unknown')?.actor).toBeNull();
    expect(landscape.gaps).toContainEqual(
      expect.objectContaining({
        id: 'flow:unknown',
        kind: 'unknown_actor',
        reference: 'A person not declared',
      }),
    );
    expect(landscape.map.journeys.map((row) => row.key)).toEqual([
      'jny-story',
      'flow-story',
      'flow-unknown',
    ]);
  });

  it('keeps an empty native workspace empty', () => {
    const landscape = modelLandscapeOf(indexOf(emptyQueryModel()));
    expect(landscape.map).toEqual({ people: [], domains: [], links: [], journeys: [] });
    expect(landscape.drawing.boxes).toEqual([]);
    expect(landscape.headline).toBe("None of Query fixture's systems is mapped yet.");
    expect(landscape.provenance).toEqual([]);
    expect(landscape.gaps).toEqual([]);
  });
});
