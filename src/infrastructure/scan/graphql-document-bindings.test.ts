import { describe, expect, it, vi } from 'vitest';

import { graphqlDocumentBindings } from './graphql-document-bindings';

vi.mock(import('server-only'), () => ({}));

const input = {
  repo: 'fixture/repo',
  commit: 'a'.repeat(40),
  blob: 'b'.repeat(40),
  path: 'core/src/main/resources/graphql-documents/profile.graphql',
  content: 'query Profile($id: ID!) {\n person(id: $id) {\n  name\n }\n}',
};

describe('GraphQL source document contracts', () => {
  it('pins variables and nested fields to their actual source lines', () => {
    const result = graphqlDocumentBindings(input);
    expect(result.gaps).toEqual([]);
    expect(result.bindings).toHaveLength(1);
    const document = result.bindings[0]!;
    expect(document).toMatchObject({
      document_name: 'profile',
      operation_name: 'Profile',
      operation_type: 'query',
      variables: [{ name: 'id', type: 'ID!' }],
      selections: [
        { path: 'person', field_name: 'person', arguments: [{ name: 'id', variable: 'id' }] },
        { path: 'person.name', field_name: 'name', arguments: [] },
      ],
    });
    const byId = new Map(result.sources.map((source) => [source.id, source]));
    expect(byId.get(document.source)?.lines).toEqual([1, 5]);
    expect(byId.get(document.variables[0]!.source)?.lines).toEqual([1, 1]);
    expect(byId.get(document.selections[1]!.source)?.lines).toEqual([3, 3]);
    expect(
      result.sources.every(
        (source) => source.commit === input.commit && source.blob === input.blob,
      ),
    ).toBe(true);
    expect(graphqlDocumentBindings(input)).toEqual(result);
    const moved = graphqlDocumentBindings({ ...input, path: 'other/profile.graphql' });
    expect(moved.bindings[0]?.source).not.toBe(document.source);
  });
  it.each([
    'query Broken { ...Fragment }',
    'query Broken { person(id: $undeclared) { name } }',
    'query Broken { person @skip(if: true) { name } }',
  ])('retains an explicit source gap for unsupported or invalid syntax: %s', (content) => {
    const result = graphqlDocumentBindings({ ...input, content });
    expect(result.bindings).toEqual([]);
    expect(result.sources).toHaveLength(1);
    expect(result.gaps).toMatchObject([{ reason: 'unsupported', source: result.sources[0]!.id }]);
  });
});
