import 'server-only';

import type { JavaCollectionBinding } from '@/domain/scan/scan.generated';

import type { CallBinding } from './java-call-binding-types';
import { javaVariable } from './java-call-syntax';
import { javaTypeName } from './java-call-types';
import { collectJavaConstantBindings } from './java-constant-bindings';
import { declarationChildren, declarationSource } from './java-declaration-parts';
import type { JavaField, JavaType, JavaUnit } from './java-declarations';
import type { SourceIndex, SyntaxNode } from './source-index-types';
import type { OutboundInput } from './spring-outbound-provenance';

interface CollectionInput extends OutboundInput {
  readonly constants: ReturnType<typeof collectJavaConstantBindings>;
}

function element(
  input: CollectionInput,
  index: SourceIndex,
  entry: { readonly argument: SyntaxNode; readonly position: number },
): JavaCollectionBinding['elements'][number] | undefined {
  const { argument, position } = entry;
  const source = declarationSource(index, argument);
  if (argument.kind === 'STRING_LITERAL' && typeof argument.literalValue === 'string') {
    return { position, source, constant_source: null, value: argument.literalValue };
  }
  const reference = input.values.find(
    (value) => value.relation === 'reference' && value.to === source,
  );
  const constant = input.constants.find(
    (constantEntry) =>
      constantEntry.source === reference?.from && constantEntry.type === 'java.lang.String',
  );
  return typeof constant?.value === 'string'
    ? { position, source, constant_source: constant.source, value: constant.value }
    : undefined;
}

function collectionFactory(
  input: OutboundInput,
  index: SourceIndex,
  entry: { readonly initializer: SyntaxNode; readonly unit: JavaUnit },
): CallBinding | undefined {
  const { initializer, unit } = entry;
  const factory = input.calls.find((call) => call.call === declarationSource(index, initializer));
  const callee = declarationChildren(index, initializer, 'callee')[0];
  const receiver = callee && declarationChildren(index, callee, 'receiver')[0];
  if (!receiver || javaVariable({ index, unit, units: input.units }, receiver) !== null) {
    return undefined;
  }
  if (javaTypeName(receiver.text, unit) !== 'java.util.List') return undefined;
  return factory?.receiverType === 'java.util.List' &&
    factory.receiver === declarationSource(index, receiver) &&
    factory.methodName === 'of'
    ? factory
    : undefined;
}

function collection(
  input: CollectionInput,
  index: SourceIndex,
  entry: { readonly unit: JavaUnit; readonly owner: JavaType; readonly field: JavaField },
): JavaCollectionBinding[] {
  const { unit, owner, field } = entry;
  if (!['static', 'final'].every((modifier) => field.modifiers.includes(modifier))) return [];
  const declaredType = javaTypeName(field.type, unit);
  if (declaredType !== 'java.util.List<java.lang.String>') return [];
  const declaration = index.nodes.find((node) => declarationSource(index, node) === field.source);
  const initializer = declaration && declarationChildren(index, declaration, 'values')[0];
  if (initializer?.kind !== 'METHOD_INVOCATION') return [];
  const valueSource = declarationSource(index, initializer);
  const factory = collectionFactory(input, index, { initializer, unit });
  if (!factory) return [];
  const factoryArguments = declarationChildren(index, initializer, 'arguments');
  const elements = factoryArguments.flatMap((argument, position) => {
    const value = element(input, index, { argument, position });
    return value ? [value] : [];
  });
  if (elements.length !== factoryArguments.length) return [];
  return [
    {
      kind: 'java_collection_binding',
      id: `java-collection:${field.source}`,
      source: field.source,
      owner_source: owner.source,
      owner_type: owner.qualifiedName,
      name: field.name,
      declared_type: declaredType,
      factory: 'java.util.List.of',
      factory_call_binding_id: factory.id,
      value_source: valueSource,
      elements,
      completeness: 'partial',
      gaps: [
        'Source-declared immutable list factory and element values; runtime initialisation remains unobserved.',
      ],
    },
  ];
}

/** Preserve ordered string literals/constants only for the nominal JDK immutable list factory. */
export function collectJavaCollectionBindings(
  input: OutboundInput,
): readonly JavaCollectionBinding[] {
  const context = { ...input, constants: collectJavaConstantBindings(input.indexes, input.units) };
  return input.indexes
    .filter((index) => index.language === 'java' && index.diagnostics.length === 0)
    .flatMap((index) => {
      const unit = input.units.find((entry) => entry.path === index.path);
      return unit
        ? unit.types.flatMap((owner) =>
            owner.fields.flatMap((field) => collection(context, index, { unit, owner, field })),
          )
        : [];
    });
}
