import { describe, expect, it, vi } from 'vitest';

import { parseGraphqlSource } from './graphql-source-document';

vi.mock(import('server-only'), () => ({}));

describe('bounded GraphQL source syntax', () => {
  it('parses operation, list variable types, argument joins and nested field paths', () => {
    const content =
      '# source only\nquery Lookup($ids: [ID!]!, $market: String) { partners(ids: $ids, market: $market) { id address { city } } }';
    const result = parseGraphqlSource(content);
    expect(result.operation_name).toBe('Lookup');
    expect(result.variables.map(({ name, type }) => ({ name, type }))).toEqual([
      { name: 'ids', type: '[ID!]!' },
      { name: 'market', type: 'String' },
    ]);
    expect(result.selections.map((field) => field.path)).toEqual([
      'partners',
      'partners.id',
      'partners.address',
      'partners.address.city',
    ]);
    expect(
      result.selections[0]?.arguments.map((argument) =>
        content.slice(argument.start, argument.end),
      ),
    ).toEqual(['ids: $ids', 'market: $market']);
  });

  it.each([
    'query Q { alias: field }',
    'query Q { field(id: "literal") }',
    'query Q { field(id: $missing) }',
    'query Q { field ...Parts }',
    'query Q { field @skip(if: $enabled) }',
    'query Q { field } query Other { another }',
    'query Q($id: ID, $id: ID) { field }',
  ])('rejects unsupported or conflicting syntax without recovery: %s', (content) => {
    expect(() => parseGraphqlSource(content)).toThrow(
      /GraphQL|Unsupported|Duplicate|Undeclared|Expected/u,
    );
  });
});
