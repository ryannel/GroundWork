import { describe, expect, it } from 'vitest';

import { homeOf, repoNamesOf, type System, type Workspace } from './workspace';
import { checkWorkspace } from './workspace-check';
import { domainLinks, systemLinks } from './workspace-links';

const system = (id: string, overrides: Partial<System> = {}): System => ({
  id,
  name: id,
  team: 'team:a',
  repos: [{ repo: `org/${id}`, path: null }],
  components: [{ id: `${id}:c`, name: 'C', type: 'service', tech: null, does: null, talksTo: [] }],
  ...overrides,
});

const workspace = (domains: Workspace['domains']): Workspace => ({
  id: 'w',
  name: 'W',
  description: null,
  isPrivate: false,
  teams: [{ id: 'team:a', name: 'A', colour: null, channel: null }],
  actors: [],
  domains,
});

const via = (to: string, kind: 'api' | 'message') => ({ to, via: kind });

describe('checkWorkspace', () => {
  it('names an actor used twice, or one who uses a component no system holds', () => {
    const map: Workspace = {
      ...workspace([{ id: 'd', name: 'D', purpose: null, systems: [system('s')] }]),
      actors: [
        { id: 'actor:a', name: 'A', summary: null, uses: ['s:c'], customer: false },
        { id: 'actor:a', name: 'A', summary: null, uses: ['gone'], customer: false },
      ],
    };
    expect(checkWorkspace(map).errors).toEqual([
      'actor actor:a: the id is used twice',
      'actor actor:a: uses gone, which no system holds',
    ]);
  });

  it('passes a sound map', () => {
    expect(
      checkWorkspace(workspace([{ id: 'd', name: 'D', purpose: null, systems: [system('s')] }])),
    ).toEqual({
      errors: [],
      warnings: [],
    });
  });

  it('finds the rules that span files', () => {
    const talker = system('t', {
      team: 'team:x',
      repos: [{ repo: 'org/s', path: null }],
      components: [
        {
          id: 's:c',
          name: 'C',
          type: 'queue',
          tech: null,
          does: null,
          talksTo: [{ to: 'gone', via: 'api' }],
        },
      ],
    });
    const { errors, warnings } = checkWorkspace(
      workspace([
        { id: 'plans', name: 'P', purpose: null, systems: [system('s'), talker] },
        {
          id: 'plans',
          name: 'P',
          purpose: null,
          systems: [system('s', { team: null, components: [] })],
        },
      ]),
    );
    expect(errors).toEqual([
      'domain plans: the id is reserved for the plans pages',
      'domain plans: the id is reserved for the plans pages',
      'domain plans: the id is used twice',
      'system s: the id is used twice',
      'component s:c: the id is used twice',
      'repo org/s: listed by two systems; when systems share a repo, give each its own folder of it with path:',
      'system t: team team:x is not in workspace.yaml',
      'system s: no team owns it',
      'component s:c: talks to gone, which no system holds',
    ]);
    expect(warnings).toEqual(['system s: has no components yet']);
    expect(
      checkWorkspace(workspace([{ id: 'd', name: 'D', purpose: null, systems: [system('flows')] }]))
        .errors,
    ).toContain("system flows: the id is reserved for the domain's flows pages");
    expect(checkWorkspace({ ...workspace([]), id: 'design' }).errors).toContain(
      'workspace design: the id is reserved for the design page',
    );
    expect(
      checkWorkspace(workspace([{ id: 'd', name: 'D', purpose: null, systems: [] }])).warnings,
    ).toEqual(['domain d: has no systems yet']);
  });
});

const sharing = (b: System['repos']): Workspace =>
  workspace([
    {
      id: 'd',
      name: 'D',
      purpose: null,
      systems: [
        system('a', { repos: [{ repo: 'org/mono', path: null }] }),
        system('b', { repos: b }),
        system('c', { repos: [{ repo: 'org/mono', path: 'dgs/c' }] }),
      ],
    },
  ]);

describe('a repo shared by folder', () => {
  it('lets systems share a repo when each holds its own folder', () => {
    expect(checkWorkspace(sharing([{ repo: 'org/mono', path: 'dgs/b' }])).errors).toEqual([]);
    expect(checkWorkspace(sharing([{ repo: 'org/mono', path: 'dgs/c' }])).errors).toEqual([
      'repo org/mono/dgs/c: listed by two systems; when systems share a repo, give each its own folder of it with path:',
    ]);
  });

  it('gives a file to the system with the deepest folder that holds it', () => {
    const map = sharing([{ repo: 'org/mono', path: 'dgs' }]);
    expect(homeOf(map, 'org/mono', 'dgs/c/schema.gql')?.system).toBe('c');
    expect(homeOf(map, 'org/mono', 'dgs/cart/schema.gql')?.system).toBe('b');
    expect(homeOf(map, 'org/mono', 'dgs')?.system).toBe('b');
    expect(homeOf(map, 'org/mono', 'router.yaml')?.system).toBe('a');
    expect(homeOf(map, 'org/other', 'x')).toBeNull();
    expect(repoNamesOf(map.domains[0]!.systems[0]!)).toEqual(['org/mono']);
  });
});

describe('links', () => {
  const domains: Workspace['domains'] = [
    {
      id: 'one',
      name: 'One',
      purpose: null,
      systems: [
        system('a', {
          components: [
            {
              id: 'a1',
              name: 'A1',
              type: 'service',
              tech: null,
              does: null,
              talksTo: [via('a2', 'api'), via('b1', 'api'), via('c1', 'message'), via('zz', 'api')],
            },
            {
              id: 'a2',
              name: 'A2',
              type: 'service',
              tech: null,
              does: null,
              talksTo: [via('b1', 'message'), via('c1', 'message')],
            },
          ],
        }),
        system('b', {
          components: [
            { id: 'b1', name: 'B1', type: 'service', tech: null, does: null, talksTo: [] },
          ],
        }),
      ],
    },
    {
      id: 'two',
      name: 'Two',
      purpose: null,
      systems: [
        system('c', {
          components: [
            {
              id: 'c1',
              name: 'C1',
              type: 'queue',
              tech: null,
              does: null,
              talksTo: [via('b1', 'api')],
            },
          ],
        }),
      ],
    },
  ];

  it('sums component connections into links between systems', () => {
    expect(systemLinks(domains)).toEqual([
      { from: 'a', to: 'b', via: ['api', 'message'], count: 2 },
      { from: 'a', to: 'c', via: ['message'], count: 2 },
      { from: 'c', to: 'b', via: ['api'], count: 1 },
    ]);
  });

  it('sums them again into links between domains', () => {
    expect(domainLinks(domains)).toEqual([
      { from: 'one', to: 'two', via: ['message'], count: 2 },
      { from: 'two', to: 'one', via: ['api'], count: 1 },
    ]);
  });
});
