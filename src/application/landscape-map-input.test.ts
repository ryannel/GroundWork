import { describe, expect, it } from 'vitest';

import { derive } from '@/application/plan/derive';
import type { Plan } from '@/domain/plan/plan.generated';
import type { Domain, Workspace } from '@/domain/workspace';

import { actorIdOf, landscapeMapInput } from './landscape-map-input';

const domain = (id: string, team: string | null): Domain => ({
  id,
  name: id,
  purpose: `Purpose ${id}`,
  systems: [
    {
      id,
      name: id,
      purpose: `Does ${id}`,
      team,
      repos: [],
      components: [
        { id: `svc:${id}`, name: id, type: 'service', does: null, tech: null, talksTo: [] },
        {
          id: `svc:${id}-external`,
          name: 'Partner',
          type: 'external',
          does: 'Supplies data',
          tech: null,
          talksTo: [],
        },
      ],
    },
  ],
});

function fixture() {
  const workspace: Workspace = {
    id: 'demo',
    name: 'Demo',
    description: null,
    isPrivate: false,
    teams: [],
    actors: [
      { id: 'actor:reader', name: 'Reader', summary: 'Reads', uses: ['svc:a'], customer: true },
    ],
    domains: [domain('c', null), domain('b', 'team:b'), domain('a', null), domain('d', null)],
  };
  const plan: Plan = {
    meta: { id: 'landscape', title: 'Landscape' },
    problem: { summary: 'Show where work happens.' },
    teams: [{ id: 'team:b', name: 'B' }],
    services: ['a', 'b', 'c', 'd'].map((id) => ({ id: `svc:${id}`, name: id, kind: 'service' })),
    interfaces: [
      {
        id: 'if:b',
        service: 'svc:b',
        protocol: 'rest',
        endpoints: [{ id: 'api:read', sig: 'GET /b' }],
      },
    ],
    domain: {
      stages: [
        { id: 'stage:a', name: 'First', services: [{ svc: 'svc:a' }] },
        { id: 'stage:b', name: 'Second', services: [{ svc: 'svc:b' }] },
      ],
    },
    flows: [
      {
        id: 'flow:read',
        name: 'Read',
        actor: 'reader',
        steps: [
          { id: 'flow:read#call', from: 'svc:a', to: 'svc:b', via: 'api:read', action: 'Read' },
        ],
      },
      { id: 'flow:repeat', name: 'Again', actor: 'Reader', steps: [] },
      { id: 'flow:partner', name: 'Partner', actor: 'actor:partner', steps: [] },
      { id: 'flow:none', name: 'System work', actor: 'System', steps: [] },
    ],
  };
  return { workspace, model: derive(plan) };
}
describe('landscape map input', () => {
  it('resolves listed actors case-insensitively, retaining explicit ids and omitting system work', () => {
    const { workspace } = fixture();
    expect(
      ['', 'System', 'reader', 'READER', 'actor:partner', 'New reader!'].map((name) =>
        actorIdOf(workspace.actors, name),
      ),
    ).toEqual([null, null, 'actor:reader', 'actor:reader', 'actor:partner', 'actor:new-reader-']);
  });
  it('orders staged domains before unstaged ones and preserves their authored details and component placement', () => {
    const { workspace, model } = fixture();
    const result = landscapeMapInput(workspace, model);
    expect(result.domains.map((d) => d.id)).toEqual([
      'domain:a',
      'domain:b',
      'domain:c',
      'domain:d',
    ]);
    expect(result.domains[1]).toEqual({
      id: 'domain:b',
      name: 'b',
      purpose: 'Purpose b',
      href: '/demo/b/',
      systems: [
        {
          id: 'sys:b',
          name: 'b',
          does: 'Does b',
          href: '/demo/b/b/',
          team: 'team:b',
          teamSlot: 1,
          parts: 1,
        },
      ],
    });
    expect(result.domains[0]?.systems[0]?.teamSlot).toBe(0);
    expect(result.homes).toEqual({
      'svc:a': 'sys:a',
      'svc:a-external': 'sys:a',
      'svc:b': 'sys:b',
      'svc:b-external': 'sys:b',
      'svc:c': 'sys:c',
      'svc:c-external': 'sys:c',
      'svc:d': 'sys:d',
      'svc:d-external': 'sys:d',
    });
    expect(result.externals).toEqual(
      ['c', 'b', 'a', 'd'].map((id) => ({
        id: `svc:${id}-external`,
        name: 'Partner',
        does: 'Supplies data',
        system: `sys:${id}`,
      })),
    );
  });
  it('keeps listed and flow-derived actors once, with explicit use and flow entry links', () => {
    const { workspace, model } = fixture();
    const result = landscapeMapInput(workspace, model);
    expect(result.actors).toEqual([
      { id: 'actor:reader', name: 'Reader', summary: 'Reads', customer: true },
      { id: 'actor:partner', name: 'partner', summary: null, customer: false },
    ]);
    expect(result.links).toEqual([
      { from: 'actor:reader', to: 'svc:a', kind: 'use', via: '' },
      { from: 'actor:reader', to: 'svc:a', kind: 'use', via: 'Read' },
      { from: 'svc:a', to: 'svc:b', kind: 'api', via: 'b REST' },
    ]);
    const serialized = JSON.stringify(result);
    const restored: unknown = JSON.parse(serialized);
    expect(restored).toEqual(result);
  });
});
