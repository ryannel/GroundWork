import { expect, it } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';
import { indexOf } from '@/application/model-index';

import { domainLanguageOf } from './language-page';
import { modelLanguageOf } from './model-language';

it('retains full authored language and places words by their explicit origin rather than resource ownership', () => {
  const base = queryModel();
  const model = {
    ...base,
    language: {
      summary: 'Our words',
      source: { title: 'Dictionary', url: 'https://example.test/dictionary', status: 'draft' },
      groups: [{ id: 'group:sales', name: 'Sales' }],
      terms: [
        {
          id: 'term:order',
          name: 'Order',
          group: 'group:sales',
          means: 'A complete agreement. Retain this second sentence.',
          aliases: ['purchase'],
          examples: [{ context: 'company' as const, sentence: 'A customer places an order.' }],
          anchors: [{ to: 'con:order', fit: 'renamed' as const, note: 'A source distinction.' }],
          relates: [{ to: 'con:unwritten', as: 'depends on' }],
        },
      ],
    },
    domains: base.domains.map((domain) => ({
      ...domain,
      language: {
        summary: 'Domain words',
        concepts: [
          {
            id: 'con:order',
            name: 'Order record',
            means: 'The full code meaning.',
            born_in: 'st:remote',
            terms: ['purchase record'],
            aka: [{ in: 'svc:a', as: 'purchase', at: 'sch:a', note: 'Naming note.' }],
            relates: [{ to: 'con:unwritten', as: 'needs' }],
          },
          { id: 'con:unwritten', name: 'Unwritten' },
        ],
      },
    })),
  };
  const page = modelLanguageOf(indexOf(model));
  expect(page.details['term:order']).toMatchObject({
    means: 'A complete agreement. Retain this second sentence.',
    examples: [{ context: 'company', sentence: 'A customer places an order.', analogy: null }],
    places: [
      {
        where: { domain: { id: 'dom:queries' }, system: { id: 'sys:b' }, component: 'Remote' },
        fit: 'renamed',
        note: 'A source distinction.',
      },
    ],
  });
  expect(page.details['con:order']).toMatchObject({
    means: 'The full code meaning.',
    names: [{ as: 'purchase', in: 'A', at: 'sch:a', note: 'Naming note.' }],
    aliases: ['purchase record'],
  });
  expect(page.details['con:unwritten']?.means).toBe('Meaning not recorded.');
  expect(domainLanguageOf(page, 'dom:queries', 'Scoped summary').words).toHaveLength(2);
  expect(page.source).toEqual({
    title: 'Dictionary',
    url: 'https://example.test/dictionary',
    status: 'draft',
  });
  expect(model.domains[0]?.language.concepts[1]).not.toHaveProperty('means');
});
