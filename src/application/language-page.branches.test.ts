import { describe, expect, it } from 'vitest';

import type { Concept } from '@/domain/plan/plan.generated';
import type { Workspace } from '@/domain/workspace';
import type { DomainLanguage, KeyTerm, KeyTerms } from '@/domain/workspace-model';

import { languagePageOf } from './language-page';
import { placesOf } from './language-places';

const workspace: Workspace = {
  id: 'shop',
  name: 'Shop',
  description: null,
  isPrivate: false,
  teams: [],
  actors: [],
  domains: [
    {
      id: 'sales',
      name: 'Sales',
      purpose: null,
      systems: [
        {
          id: 'till',
          name: 'Till',
          team: null,
          repos: [],
          components: [
            {
              id: 'svc:till',
              name: 'Till API',
              type: 'service',
              tech: null,
              does: null,
              talksTo: [],
            },
          ],
        },
      ],
    },
    { id: 'stock', name: 'Stock', purpose: null, systems: [] },
  ],
};

const basket: Concept = {
  id: 'con:basket',
  name: 'Basket',
  means: 'What a customer means to buy. See [[con:receipt]].',
  born_in: 'svc:till',
  aka: [
    { in: 'svc:till', as: 'Cart' },
    { in: 'sys:till', as: 'Trolley', at: 'sch:trolley', note: 'Kept by [[sys:gone]].' },
    { in: 'elsewhere', as: 'Bag' },
  ],
};
const receipt: Concept = { id: 'con:receipt', name: 'Receipt', means: 'Proof of a sale.' };
const pallet: Concept = {
  id: 'con:pallet',
  name: 'Pallet',
  terms: ['skid'],
  means: 'A stack of stock.',
  born_in: 'svc:nowhere',
  relates: [
    { to: 'con:basket', as: 'fills' },
    { to: 'con:unknown', as: 'holds' },
  ],
};

const languages: readonly DomainLanguage[] = [
  { domain: 'sales', summary: null, concepts: [basket, receipt] },
  { domain: 'stock', summary: null, concepts: [pallet] },
  { domain: 'ghost', summary: null, concepts: [{ id: 'con:ghost', name: 'Ghost', means: 'Boo.' }] },
];

function term(id: string, group: string | null, anchors: KeyTerm['anchors']): KeyTerm {
  return {
    id,
    name: id.replace('term:', ''),
    group,
    aliases: [],
    means: `The ${id}.`,
    examples: [],
    relates: [],
    anchors,
  };
}

const keyTerms: KeyTerms = {
  summary: null,
  source: null,
  groups: [{ id: 'selling', name: 'Selling' }],
  terms: [
    term('term:basket', 'selling', [
      { to: 'con:basket', fit: 'close', note: null },
      { to: 'con:gone', fit: 'clash', note: 'No such word.' },
    ]),
    term('term:loose', 'unnamed', [{ to: 'sys:till', fit: 'lives-in', note: null }]),
    { ...term('term:none', null, []), relates: [{ to: 'term:basket', as: 'see' }] },
  ],
};

describe('placesOf, for words', () => {
  const places = placesOf(workspace, languages);

  it('puts a word where it was born, or in its domain when its birthplace is unknown', () => {
    expect(places.of('con:basket')?.component).toBe('Till API');
    expect(places.of('con:receipt')).toMatchObject({ domain: { id: 'sales' }, system: null });
    expect(places.of('con:pallet')).toMatchObject({ domain: { id: 'stock' }, component: null });
  });

  it('finds no place for a word whose domain is not in the workspace, or an unknown id', () => {
    expect(places.of('con:ghost')).toBeNull();
    expect(places.of('svc:missing')).toBeNull();
    expect(places.of('dom:stock')?.domain?.name).toBe('Stock');
  });
});

describe('languagePageOf, for loose and unanchored terms', () => {
  const page = languagePageOf(workspace, languages, keyTerms);

  it('puts terms with an unknown or no group under other key terms, with their closest fit', () => {
    expect(page.groups.map((g) => [g.id, g.terms.map((t) => [t.id, t.fit])])).toStrictEqual([
      ['selling', [['term:basket', 'close']]],
      [
        'other',
        [
          ['term:loose', 'lives-in'],
          ['term:none', null],
        ],
      ],
    ]);
    expect(page.details['term:loose']?.group).toBe('unnamed');
    expect(page.details['term:none']?.group).toBeNull();
  });

  it('opens a key term onto the words it anchors to, and nowhere for a word that does not exist', () => {
    const detail = page.details['term:basket'];
    expect(detail?.places.map((p) => [p.word?.name ?? null, p.where.domain?.id ?? null])).toEqual([
      ['Basket', 'sales'],
      [null, null],
    ]);
    expect(detail?.names).toStrictEqual([
      { as: 'Cart', in: 'Till API', at: null, note: null },
      { as: 'Trolley', in: 'Till', at: 'sch:trolley', note: 'Kept by gone.' },
      { as: 'Bag', in: 'elsewhere', at: null, note: null },
    ]);
    expect(page.details['term:none']?.relates).toStrictEqual([
      { id: 'term:basket', name: 'basket', as: 'see' },
    ]);
  });

  it('opens a word onto its aliases, its links and no place when it lives nowhere', () => {
    const stack = page.details['con:pallet'];
    expect(stack?.aliases).toStrictEqual(['skid']);
    expect(stack?.relates).toStrictEqual([
      { id: 'con:basket', name: 'Basket', as: 'fills' },
      { id: null, name: 'con:unknown', as: 'holds' },
    ]);
    expect(page.details['con:receipt']?.aliases).toStrictEqual([]);
    expect(page.details['con:ghost']?.places).toStrictEqual([]);
    expect(page.words.find((w) => w.id === 'con:basket')?.gist).toBe(
      'What a customer means to buy.',
    );
    expect(page.words.find((w) => w.id === 'con:ghost')?.domains).toStrictEqual([]);
  });
});
