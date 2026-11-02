import 'server-only';

import path from 'node:path';

import type { Gap, GraphqlDocumentBinding, Source } from '@/domain/scan/scan.generated';

import { parseGraphqlSource } from './graphql-source-document';
import { sourceDigest } from './source-index';

interface GraphqlSource {
  readonly repo: string;
  readonly commit: string;
  readonly blob: string;
  readonly path: string;
  readonly content: string;
}

function sourceAt(input: GraphqlSource, start: number, end: number): Source {
  const identity = sourceDigest(
    [input.repo, input.commit, input.path, input.blob, String(start), String(end)].join(':'),
  ).slice(0, 24);
  const hostIdentity = sourceDigest(`${input.repo}:unknown`).slice(0, 16);
  return {
    kind: 'source',
    id: `source:${identity}`,
    repo: input.repo,
    commit: input.commit,
    blob: input.blob,
    path: input.path,
    host: `host:${hostIdentity}`,
    authority: 'declared',
    lines: [
      input.content.slice(0, start).split('\n').length,
      input.content.slice(0, Math.max(start, end - 1)).split('\n').length,
    ],
  };
}

/** Query text establishes only a source document, never an executable remote schema. */
export function graphqlDocumentBindings(input: GraphqlSource): {
  readonly bindings: readonly GraphqlDocumentBinding[];
  readonly sources: readonly Source[];
  readonly gaps: readonly Gap[];
} {
  const root = sourceAt(input, 0, input.content.length);
  const sources = new Map([[root.id, root]]);
  const anchor = (start: number, end: number): string => {
    const source = sourceAt(input, start, end);
    sources.set(source.id, source);
    return source.id;
  };
  try {
    const parsed = parseGraphqlSource(input.content);
    const binding: GraphqlDocumentBinding = {
      kind: 'graphql_document_binding',
      id: `graphql-document:${root.id}`,
      source: root.id,
      document_name: path.basename(input.path, '.graphql'),
      operation_type: parsed.operation_type,
      operation_name: parsed.operation_name,
      variables: parsed.variables.map((variable) => ({
        name: variable.name,
        type: variable.type,
        source: anchor(variable.start, variable.end),
      })),
      selections: parsed.selections.map((selection) => ({
        path: selection.path,
        field_name: selection.field_name,
        source: anchor(selection.start, selection.end),
        arguments: selection.arguments.map((argument) => ({
          name: argument.name,
          variable: argument.variable,
          source: anchor(argument.start, argument.end),
        })),
      })),
    };
    return { bindings: [binding], sources: [...sources.values()], gaps: [] };
  } catch (error) {
    return {
      bindings: [],
      sources: [root],
      gaps: [
        {
          kind: 'gap',
          id: `gap:graphql-document:${root.id}`,
          source: root.id,
          reason: 'unsupported',
          description:
            error instanceof Error ? error.message : 'Unsupported GraphQL source document.',
        },
      ],
    };
  }
}
