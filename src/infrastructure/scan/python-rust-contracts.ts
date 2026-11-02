import 'server-only';

import type {
  Contract,
  Shape,
  ShapeField,
  SourceFrameworkBinding,
} from '@/domain/scan/scan.generated';

import {
  polyglotFields,
  polyglotSource,
  polyglotSupport,
  pythonQualified,
} from './python-rust-fields';
import type { SourceIndex, SyntaxNode } from './source-index-types';

const scalars: Readonly<Record<string, 'string' | 'integer' | 'number' | 'boolean'>> = {
  String: 'string',
  bool: 'boolean',
  Boolean: 'boolean',
  Int: 'integer',
  Float: 'number',
  ID: 'string',
  i32: 'integer',
  i64: 'integer',
  u32: 'integer',
  u64: 'integer',
  usize: 'integer',
  f32: 'number',
  f64: 'number',
};
function shape(spelling: string): Shape {
  const scalar = scalars[spelling];
  return scalar === undefined
    ? {
        kind: 'unresolved',
        reason: 'missing_dependency',
        spelling: spelling.length > 0 ? spelling : 'unknown',
      }
    : { kind: 'scalar', name: scalar, spelling };
}
function pythonField(index: SourceIndex, node: SyntaxNode): ShapeField | null {
  const target = polyglotFields(index, node, 'targets')[0];
  const call = polyglotFields(index, node, 'values')[0];
  const callee = call ? polyglotFields(index, call, 'callee')[0] : undefined;
  const qualified = pythonQualified(index, callee);
  if (!qualified.startsWith('graphene.') || target?.symbol === undefined) return null;
  const type = qualified.slice('graphene.'.length);
  const argument = call ? polyglotFields(index, call, 'arguments')[0] : undefined;
  return {
    name: target.symbol,
    presence: 'optional',
    nullable: true,
    shape:
      type === 'List'
        ? {
            kind: 'array',
            spelling: call?.text ?? type,
            item: shape(pythonQualified(index, argument).replace('graphene.', '')),
          }
        : shape(type),
  };
}
function rustField(index: SourceIndex, node: SyntaxNode): ShapeField {
  const type = polyglotFields(index, node, 'type')[0]?.text ?? '';
  const optional = type.startsWith('Option<');
  const inner = optional ? type.slice('Option<'.length, -1) : type;
  return {
    name: node.symbol ?? '',
    presence: optional ? 'optional' : 'required',
    nullable: optional,
    shape: shape(inner),
  };
}
function descendants(index: SourceIndex, owner: SyntaxNode): readonly SyntaxNode[] {
  return index.nodes.filter((node) => node.start > owner.start && node.end <= owner.end);
}
/** Source DTO fields only; serializers, custom coercion and effective wire policy stay unresolved. */
export function collectPythonRustContracts(indexes: readonly SourceIndex[]): readonly Contract[] {
  return indexes
    .filter(
      (index) => ['python', 'rust'].includes(index.language) && index.diagnostics.length === 0,
    )
    .flatMap((index) =>
      index.nodes
        .filter((node) => node.kind === 'CLASS')
        .flatMap((node) => {
          if (
            index.language === 'python' &&
            !polyglotFields(index, node, 'bases').some(
              (base) => pythonQualified(index, base) === 'graphene.ObjectType',
            )
          ) {
            return [];
          }
          const fields =
            index.language === 'python'
              ? descendants(index, node)
                  .filter(
                    (child) =>
                      child.kind === 'ASSIGNMENT' && index.nodes[child.parent ?? -1] === node,
                  )
                  .flatMap((child) => {
                    const field = pythonField(index, child);
                    return field ? [field] : [];
                  })
              : descendants(index, node)
                  .filter((child) => child.kind === 'PropertyDeclaration')
                  .map((child) => rustField(index, child));
          return [
            {
              kind: 'contract',
              id: `contract:polyglot:${polyglotSource(index, node)}`,
              support: polyglotSupport(index, node),
              shape: {
                kind: 'object',
                spelling: node.symbol ?? '',
                enforcement: 'source',
                additionalProperties: true,
                fields,
              },
            },
          ];
        }),
    );
}
function serdeDerived(index: SourceIndex, declaration: SyntaxNode): boolean {
  const imported = index.nodes.filter(
    (node) => node.kind === 'IMPORT' && node.text.startsWith('use serde::'),
  );
  const importedNames = new Set(
    imported.flatMap((owner) =>
      descendants(index, owner)
        .filter((node) => node.kind === 'IDENTIFIER')
        .map((node) => node.symbol),
    ),
  );
  return polyglotFields(index, declaration, 'annotations').some((annotation) => {
    const attribute = descendants(index, annotation).find((node) => node.kind === 'attribute');
    if (attribute === undefined) return false;
    const attributeIndex = index.nodes.indexOf(attribute);
    const name = index.nodes.find(
      (node) => node.parent === attributeIndex && node.kind === 'IDENTIFIER',
    );
    if (name?.symbol !== 'derive') return false;
    return descendants(index, attribute).some(
      (node) =>
        node.kind === 'IDENTIFIER' &&
        ['Deserialize', 'Serialize'].includes(node.symbol ?? '') &&
        importedNames.has(node.symbol),
    );
  });
}
export function collectPolyglotSchemaBindings(
  indexes: readonly SourceIndex[],
): readonly SourceFrameworkBinding[] {
  return indexes
    .filter(
      (index) => ['python', 'rust'].includes(index.language) && index.diagnostics.length === 0,
    )
    .flatMap((index) =>
      index.nodes
        .filter(
          (node) =>
            node.kind === 'CLASS' &&
            (index.language === 'python'
              ? polyglotFields(index, node, 'bases').some(
                  (base) => pythonQualified(index, base) === 'graphene.ObjectType',
                )
              : serdeDerived(index, node)),
        )
        .map((node) => {
          const source = polyglotSource(index, node);
          return {
            kind: 'source_framework_binding',
            id: `binding:schema:${source}`,
            source,
            support: polyglotSupport(index, node),
            language: index.language === 'python' ? 'python' : 'rust',
            framework: index.language === 'python' ? 'graphene' : 'serde',
            role: 'declared_schema',
            name: node.symbol ?? '',
            target_source: null,
            declaration: node.text,
            status: 'partial',
            limitations: [
              'Source fields only. Inheritance, custom serializers, aliases, rename/flatten/default/skip policies and actual JSON/GraphQL wire enforcement require framework context.',
            ],
          };
        }),
    );
}
