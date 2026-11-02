import 'server-only';

import type { EnumBinding } from '@/domain/scan/scan.generated';

import {
  declarationAnnotations,
  declarationChildren,
  declarationSource,
  declarationText,
} from './java-declaration-parts';
import type { JavaType, JavaUnit } from './java-declarations';
import type { SourceIndex, SyntaxNode } from './source-index-types';

const PROPERTY = 'com.fasterxml.jackson.annotation.JsonProperty';
const VALUE = 'com.fasterxml.jackson.annotation.JsonValue';

function propertyName(index: SourceIndex, node: SyntaxNode) {
  const annotations = declarationAnnotations(index, node).filter(
    (annotation) => annotation.name === PROPERTY,
  );
  const annotation = annotations.length === 1 ? annotations[0] : undefined;
  const syntax =
    annotation &&
    index.nodes.find((entry) => declarationSource(index, entry) === annotation.source);
  const values = syntax
    ? declarationChildren(index, syntax, 'arguments').flatMap((argument) => {
        if (argument.kind !== 'ASSIGNMENT') return [argument];
        const key = declarationText(index, argument, 'targets')[0];
        return key === 'value' ? declarationChildren(index, argument, 'values') : [];
      })
    : [];
  const value = values.length === 1 ? values[0] : undefined;
  const known =
    value?.kind === 'STRING_LITERAL' &&
    typeof value.literalValue === 'string' &&
    value.literalValue !== '';
  return {
    declared_json_name: known ? value.literalValue : null,
    json_name_source: known ? declarationSource(index, value) : null,
    annotation_sources: annotations.map((entry) => entry.source),
  };
}

function constants(index: SourceIndex, type: JavaType): EnumBinding['constants'] {
  return type.fields.flatMap((field) => {
    const node = index.nodes.find((entry) => declarationSource(index, entry) === field.source);
    const initializer = node && declarationChildren(index, node, 'values')[0];
    if (!node || field.type !== '' || !type.enumValues.includes(field.name)) return [];
    if (initializer !== undefined && initializer.kind !== 'NEW_CLASS') return [];
    return [
      {
        name: field.name,
        source: field.source,
        ...propertyName(index, node),
        argument_sources: (initializer
          ? declarationChildren(index, initializer, 'arguments')
          : []
        ).map((argument) => declarationSource(index, argument)),
      },
    ];
  });
}

function valueMethods(type: JavaType): string[] {
  return type.methods
    .filter((method) => method.annotations.some((annotation) => annotation.name === VALUE))
    .map((method) => method.source);
}

/** Declared constant annotations stay distinct from effective Jackson serialisation. */
export function collectEnumBindings(input: {
  readonly indexes: readonly SourceIndex[];
  readonly units: readonly JavaUnit[];
}): readonly EnumBinding[] {
  return input.indexes
    .filter((index) => index.diagnostics.length === 0)
    .flatMap((index) => {
      const unit = input.units.find((entry) => entry.path === index.path);
      return (unit?.types ?? [])
        .filter((type) => type.kind === 'enum')
        .map((type): EnumBinding => ({
          kind: 'enum_binding',
          id: `enum:${type.source}`,
          source: type.source,
          type: type.qualifiedName,
          constants: [...constants(index, type)],
          value_method_sources: valueMethods(type),
          codec: 'unobserved',
          completeness: 'partial',
          gaps: [
            'Enum names and Jackson annotations are source declarations; effective mapper configuration, JsonValue bodies and wire serialisation remain unobserved.',
          ],
        }));
    });
}
