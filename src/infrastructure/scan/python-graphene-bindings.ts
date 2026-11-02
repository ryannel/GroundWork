import 'server-only';

import type { SourceFrameworkBinding } from '@/domain/scan/scan.generated';

import {
  polyglotFields,
  polyglotSource,
  polyglotSupport,
  pythonQualified,
} from './python-rust-fields';
import type { SourceIndex, SyntaxNode } from './source-index-types';

function classFields(index: SourceIndex, owner: SyntaxNode): readonly SourceFrameworkBinding[] {
  return index.nodes
    .filter((node) => node.kind === 'ASSIGNMENT' && index.nodes[node.parent ?? -1] === owner)
    .flatMap((node) => {
      const target = polyglotFields(index, node, 'targets')[0];
      const call = polyglotFields(index, node, 'values')[0];
      if (call === undefined || target?.symbol === undefined) return [];
      const callee = polyglotFields(index, call, 'callee')[0];
      if (
        ![
          'Field',
          'List',
          'NonNull',
          'String',
          'Boolean',
          'Int',
          'Float',
          'ID',
          'Enum',
          'InputField',
        ].some((name) => pythonQualified(index, callee) === `graphene.${name}`)
      ) {
        return [];
      }
      const expectedResolver = `resolve_${target.symbol ?? ''}`;
      const resolver = index.nodes.find(
        (candidate) =>
          candidate.kind === 'METHOD' &&
          candidate.symbol === expectedResolver &&
          index.nodes[candidate.parent ?? -1] === owner,
      );
      const source = polyglotSource(index, node);
      return [
        {
          kind: 'source_framework_binding',
          id: `binding:graphene:${source}`,
          source,
          support: polyglotSupport(index, node),
          language: 'python',
          framework: 'graphene',
          role: 'graphql_field',
          name: target.symbol,
          target_source: resolver === undefined ? null : polyglotSource(index, resolver),
          declaration: node.text,
          status: 'partial',
          limitations: [
            'Declared Graphene ObjectType field and conventional local resolver candidate only. Explicit resolver overrides, inherited defaults, camel-case wire naming, coercion and runtime schema activation remain unresolved.',
          ],
        },
      ];
    });
}
export function collectGrapheneBindings(
  indexes: readonly SourceIndex[],
): readonly SourceFrameworkBinding[] {
  return indexes
    .filter((index) => index.language === 'python' && index.diagnostics.length === 0)
    .flatMap((index) =>
      index.nodes
        .filter(
          (node) =>
            node.kind === 'CLASS' &&
            polyglotFields(index, node, 'bases').some(
              (base) => pythonQualified(index, base) === 'graphene.ObjectType',
            ),
        )
        .flatMap((node) => classFields(index, node)),
    );
}
