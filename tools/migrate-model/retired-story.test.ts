import { expect, it } from 'vitest';

import { modelRecord } from '@/domain/workspace-model';

import { migrationReview } from './review';
import { migrateWorkspace } from './workspace';

const input = [
  { path: 'workspace.yaml', value: { id: 'story-example', name: 'Example' }, text: '' },
  { path: 'domains/shop/domain.yaml', value: { id: 'shop', name: 'Shop' }, text: '' },
  {
    path: 'domains/shop/systems/products/system.yaml',
    value: {
      id: 'products',
      name: 'Products',
      components: [{ id: 'svc:products', name: 'Products', type: 'service' }],
    },
    text: '',
  },
  {
    path: 'story.yaml',
    value: {
      summary: 'Retain the full workspace explanation.',
      concepts: [
        {
          id: 'con:product',
          name: 'Product',
          means: 'Something sold.',
          terms: ['product', 'item'],
          born_in: 'svc:products',
          origin: 'curated',
        },
      ],
      stages: [
        {
          id: 'stage:publish',
          name: 'Publish',
          services: [{ svc: 'svc:products' }],
          flows: ['flow:publish'],
        },
      ],
    },
    text: 'Exact retained source bytes',
  },
];
it('moves a retained concept by explicit born_in containment and makes retired story stages explicit without inventing execution', () => {
  const result = migrateWorkspace(input, migrationReview());
  expect(result.files.get('domains/shop/language.yaml')?.value).toEqual({
    concepts: [
      {
        id: 'con:product',
        name: 'Product',
        means: 'Something sold.',
        terms: ['product', 'item'],
        born_in: 'svc:products',
      },
    ],
  });
  expect(result.files.has('story.yaml')).toBe(false);
  const retired = modelRecord(
    modelRecord(result.files.get('aliases.yaml')?.value)?.['stage:publish'],
  );
  expect(retired?.to).toBeNull();
  expect(retired?.reason).toContain('retired');
  expect(result.files.has('journeys/publish.yaml')).toBe(false);
  expect(
    result.files.get('domains/shop/systems/products/contracts.yaml')?.value,
  ).not.toHaveProperty('handlers');
});
it('refuses to guess a domain for an unplaced global concept', () => {
  const source = input.map((file) =>
    file.path === 'story.yaml'
      ? {
          ...file,
          value: {
            concepts: [{ id: 'con:unknown', name: 'Unknown', means: 'No recorded placement.' }],
          },
        }
      : file,
  );
  expect(() => migrateWorkspace(source, migrationReview())).toThrow(
    'no uniquely recorded born_in domain',
  );
});
