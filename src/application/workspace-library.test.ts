import { describe, expect, it } from 'vitest';

import type { Workspace } from '@/domain/workspace';

import { libraryOf } from './workspace-library';

const workspace = (id: string, isPrivate: boolean, systems: number): Workspace => ({
  id,
  name: id,
  description: null,
  isPrivate,
  teams: [],
  actors: [],
  domains: [
    {
      id: 'd',
      name: 'D',
      purpose: null,
      systems: Array.from({ length: systems }, (_, index) => ({
        id: `s${String(index)}`,
        name: 'S',
        team: null,
        repos: [],
        components: [{ id: 'c', name: 'C', type: 'service', tech: null, does: null, talksTo: [] }],
      })),
    },
  ],
});

const NO_PLANS = new Map<string, readonly never[]>();
const TODAY = new Date('2026-01-01');

describe('libraryOf', () => {
  it('puts shared workspaces before private ones', () => {
    const { cards } = libraryOf(
      [workspace('a-private', true, 1), workspace('z-shared', false, 1)],
      NO_PLANS,
      TODAY,
    );
    expect(cards.map((card) => card.id)).toEqual(['z-shared', 'a-private']);
  });

  it('orders workspaces of the same kind by name', () => {
    const { cards } = libraryOf(
      [workspace('beta', false, 1), workspace('alpha', false, 1)],
      NO_PLANS,
      TODAY,
    );
    expect(cards.map((card) => card.id)).toEqual(['alpha', 'beta']);
  });

  it('counts domains, systems, components and plans in plain words', () => {
    const [card] = libraryOf([workspace('w', false, 2)], NO_PLANS, TODAY).cards;
    expect(card?.facts).toEqual(['1 domain', '2 systems', '2 components', '0 plans']);
  });

  it('links each domain with its size', () => {
    const [card] = libraryOf([workspace('w', false, 2)], NO_PLANS, TODAY).cards;
    expect(card?.domains).toEqual([{ id: 'd', name: 'D', href: '/w/d/', systems: '2 systems' }]);
  });
});
