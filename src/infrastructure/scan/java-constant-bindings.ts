import 'server-only';

import { javaTypeName } from './java-call-types';
import { declarationChildren, declarationSource } from './java-declaration-parts';
import type { JavaField, JavaType, JavaUnit } from './java-declarations';
import type { SourceIndex, SyntaxNode } from './source-index-types';

export interface JavaConstantBinding {
  readonly kind: 'java_constant_binding';
  readonly id: string;
  readonly source: string;
  readonly value_source: string;
  readonly owner_type: string;
  readonly name: string;
  readonly type: string;
  readonly value: string | number | boolean | null;
}

const NUMBERS = new Set(['byte', 'short', 'int', 'long', 'float', 'double']);
const NUMERIC_LITERALS = new Set([
  'INT_LITERAL',
  'LONG_LITERAL',
  'FLOAT_LITERAL',
  'DOUBLE_LITERAL',
]);

function literalValue(
  node: SyntaxNode,
  type: string,
): { readonly value: JavaConstantBinding['value'] } | null {
  if (node.kind === 'NULL_LITERAL' && type === 'java.lang.String') return { value: null };
  if (
    node.kind === 'BOOLEAN_LITERAL' &&
    type === 'boolean' &&
    typeof node.literalValue === 'string' &&
    ['true', 'false'].includes(node.literalValue)
  ) {
    return { value: node.literalValue === 'true' };
  }
  return numericValue(node, type) ?? stringValue(node, type);
}

function numericValue(node: SyntaxNode, type: string): { readonly value: number } | null {
  if (
    NUMERIC_LITERALS.has(node.kind) &&
    NUMBERS.has(type) &&
    typeof node.literalValue === 'number'
  ) {
    const value = node.literalValue;
    if (Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value))) {
      return { value };
    }
  }
  return null;
}

function stringValue(node: SyntaxNode, type: string): { readonly value: string } | null {
  const stringKind = type === 'char' ? 'CHAR_LITERAL' : 'STRING_LITERAL';
  if (
    ['char', 'java.lang.String'].includes(type) &&
    node.kind === stringKind &&
    typeof node.literalValue === 'string'
  ) {
    return { value: node.literalValue };
  }
  return null;
}

function constantBinding(
  index: SourceIndex,
  unit: JavaUnit,
  entry: { readonly owner: JavaType; readonly field: JavaField },
): JavaConstantBinding[] {
  const { owner, field } = entry;
  if (!field.modifiers.includes('static') || !field.modifiers.includes('final')) return [];
  const declaration = index.nodes.find((node) => declarationSource(index, node) === field.source);
  const valueNode = declaration && declarationChildren(index, declaration, 'values')[0];
  if (!valueNode) return [];
  const type = javaTypeName(field.type, unit);
  const literal = literalValue(valueNode, type);
  return literal
    ? [
        {
          kind: 'java_constant_binding',
          id: `java-constant:${field.source}`,
          source: field.source,
          value_source: declarationSource(index, valueNode),
          owner_type: owner.qualifiedName,
          name: field.name,
          type,
          value: literal.value,
        },
      ]
    : [];
}

/** Only direct compiler literals establish constant values; source expressions remain unbound. */
export function collectJavaConstantBindings(
  indexes: readonly SourceIndex[],
  units: readonly JavaUnit[],
): JavaConstantBinding[] {
  return indexes
    .filter((index) => index.language === 'java' && index.diagnostics.length === 0)
    .flatMap((index) => {
      const unit = units.find((entry) => entry.path === index.path);
      return unit
        ? unit.types.flatMap((owner) =>
            owner.fields.flatMap((field) => constantBinding(index, unit, { owner, field })),
          )
        : [];
    });
}
