import type { CurrentRecord } from '@/domain/scan-explorer/current-contracts';
import type { ExplorerService, ExplorerSource } from '@/domain/service-explorer';

import { currentSourceIds } from './current-source-ids';
import { isVisualBoundary } from './visual-boundary';
import { visualEntries } from './visual-entries';
import type { VisualContext, VisualInput } from './visual-types';

interface ContextOptions {
  readonly snapshot: string;
  readonly purpose: ExplorerService['purpose'];
  readonly fileFor: (id: string) => string;
  readonly externalSources: readonly ExplorerSource[];
}
export function visualContext(input: VisualInput, options: ContextOptions): VisualContext {
  const semantic = input.records.filter((record) => record.kind === 'semantic_node');
  const nodes = new Map(semantic.map((node) => [node.id, node]));
  const edges = new Map<string, Extract<CurrentRecord, { readonly kind: 'semantic_edge' }>[]>();
  const recordsAt = new Map<string, CurrentRecord[]>();
  for (const record of input.records) {
    for (const source of currentSourceIds(record)) {
      recordsAt.set(source, [...(recordsAt.get(source) ?? []), record]);
    }
    if (record.kind === 'semantic_edge') {
      edges.set(record.from, [...(edges.get(record.from) ?? []), record]);
    }
  }
  const bound = boundSources(input);
  const entries = visualEntries(input.records).filter((entry) => bound.has(entry.source));
  const sources = [
    ...new Set([
      ...entries.map((entry) => entry.source),
      ...semantic
        .filter((node) => node.nodeKind === 'function' && bound.has(node.source))
        .map((node) => node.source),
    ]),
  ];
  const schemas = input.records.filter(
    (record) => record.kind === 'schema_binding' || record.kind === 'contract',
  );
  const files = new Map(
    [
      ...sources,
      ...schemas.map((schema) => schema.id),
      ...input.records.filter(isVisualBoundary).map((record) => record.id),
      'overview',
      'callers',
      'schemas:index',
      ...new Set(entries.map((entry) => `entries:${entry.kind}`)),
    ].map((id) => [id, options.fileFor(id)]),
  );
  return {
    snapshot: options.snapshot,
    input,
    files,
    recordsAt,
    nodes,
    nodeOrder: new Map(semantic.map((node, index) => [node.id, index])),
    functions: new Map(
      semantic.filter((node) => node.nodeKind === 'function').map((node) => [node.source, node]),
    ),
    sources: new Map(
      [...input.sources, ...input.binding.declarations].map((source) => [source.id, source]),
    ),
    edges,
    entries,
    purpose: options.purpose,
    externalSources: options.externalSources,
  };
}

function boundSources(input: VisualInput): ReadonlySet<string> {
  return new Set(
    input.sources
      .filter(
        (source) =>
          source.repo === input.binding.repo &&
          source.commit === input.binding.commit &&
          input.binding.modulePaths.some(
            (path) => path === '' || (path.endsWith('/') && source.path.startsWith(path)),
          ),
      )
      .map((source) => source.id),
  );
}
