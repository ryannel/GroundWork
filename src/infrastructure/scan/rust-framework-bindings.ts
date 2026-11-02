import 'server-only';

import type { SourceFrameworkBinding } from '@/domain/scan/scan.generated';

import { polyglotFields, polyglotSource, polyglotSupport } from './python-rust-fields';
import type { SourceIndex, SyntaxNode } from './source-index-types';

function apolloImport(index: SourceIndex): boolean {
  return index.nodes.some(
    (node) => node.kind === 'IMPORT' && node.text.startsWith('use apollo_router::'),
  );
}
function pluginMethod(index: SourceIndex, node: SyntaxNode): boolean {
  if (
    node.kind !== 'METHOD' ||
    !['supergraph_service', 'subgraph_service', 'router_service', 'execution_service'].includes(
      node.symbol ?? '',
    )
  ) {
    return false;
  }
  let parent = node.parent;
  while (parent !== null) {
    const owner = index.nodes[parent];
    if (owner === undefined) return false;
    if (owner.kind === 'RustImpl') {
      return polyglotFields(index, owner, 'trait')[0]?.text === 'Plugin';
    }
    parent = owner.parent;
  }
  return false;
}
/** Apollo Plugin trait implementations are source entry candidates; runtime activation stays partial. */
export function collectRustFrameworkBindings(
  indexes: readonly SourceIndex[],
): readonly SourceFrameworkBinding[] {
  return indexes
    .filter(
      (index) => index.language === 'rust' && index.diagnostics.length === 0 && apolloImport(index),
    )
    .flatMap((index) =>
      index.nodes
        .filter((node) => pluginMethod(index, node))
        .map((node) => {
          const source = polyglotSource(index, node);
          return {
            kind: 'source_framework_binding',
            id: `binding:rust:${source}`,
            source,
            support: polyglotSupport(index, node),
            language: 'rust',
            framework: 'apollo-router',
            role: 'plugin_entry',
            name: node.symbol ?? '',
            target_source: source,
            declaration: node.text,
            status: 'partial',
            limitations: [
              'Declared Apollo Plugin method. Macro expansion, plugin configuration, middleware scheduling, external trait resolution and live activation remain unresolved.',
            ],
          };
        }),
    );
}
