import 'server-only';

import type { JavaBindingContext } from './java-call-binding-types';
import { javaExpressionType } from './java-call-resolution';
import { javaAncestors, javaField, javaMethod } from './java-call-syntax';
import { declarationChildren, declarationSource } from './java-declaration-parts';
import type { SyntaxNode } from './source-index-types';
import { eventConstructorFields } from './spring-event-constructor';
import type { EventBinding } from './spring-event-types';
import { outboundArguments, outboundName } from './spring-outbound-syntax';

export function eventConstructions(
  context: JavaBindingContext,
  nodes: readonly SyntaxNode[],
  contexts: readonly JavaBindingContext[],
): EventBinding['constructions'] {
  const { index } = context;
  return nodes
    .filter((node) => node.kind === 'NEW_CLASS')
    .map((node) => {
      const type = javaExpressionType(context, node);
      const declaration = context.units
        .flatMap((unit) => unit.types)
        .find((entry) => entry.qualifiedName === type);
      const argumentSources = outboundArguments(index, node);
      const declarationContext =
        declaration && contexts.find((entry) => entry.unit.types.includes(declaration));
      // Record component order is a Java source contract. Ordinary field order is not constructor order.
      let fields: EventBinding['constructions'][number]['fields'] = [];
      if (declaration?.kind === 'record' && declaration.fields.length === argumentSources.length) {
        fields = declaration.fields.flatMap((field, position) => {
          const value = argumentSources.at(position);
          return value === undefined
            ? []
            : [{ field: field.name, field_source: field.source, value_source: value }];
        });
      } else if (declaration && declarationContext) {
        fields = eventConstructorFields(
          { context, arguments: declarationChildren(index, node, 'arguments') },
          { context: declarationContext, type: declaration },
        );
      }

      return {
        source: declarationSource(index, node),
        type,
        argument_sources: argumentSources,
        fields,
      };
    });
}

export function eventConditions(
  context: JavaBindingContext,
  nodes: readonly SyntaxNode[],
): EventBinding['conditions'] {
  const { index } = context;
  return nodes
    .filter((node) => node.kind === 'IF')
    .flatMap((node) => {
      const condition = javaField(index, node, 'condition');
      if (!condition) return [];
      const consequent = javaField(index, node, 'consequent');
      const alternative = javaField(index, node, 'otherwise');
      return [
        {
          source: declarationSource(index, node),
          condition_source: declarationSource(index, condition),
          consequent_source: consequent ? declarationSource(index, consequent) : null,
          alternative_source: alternative ? declarationSource(index, alternative) : null,
          return_sources: nodes
            .filter(
              (entry) =>
                entry.kind === 'RETURN' &&
                javaAncestors(index, entry).includes(node) &&
                javaMethod(index, entry) === javaMethod(index, node),
            )
            .map((entry) => declarationSource(index, entry)),
        },
      ];
    });
}

export function eventBuilders(
  context: JavaBindingContext,
  nodes: readonly SyntaxNode[],
): EventBinding['builder_calls'] {
  return nodes
    .filter((node) => node.kind === 'METHOD_INVOCATION')
    .flatMap((node) => {
      const callee = javaField(context.index, node, 'callee');
      const receiver = callee && javaField(context.index, callee, 'receiver');
      return receiver
        ? [
            {
              source: declarationSource(context.index, node),
              operation: outboundName(context.index, node),
              receiver_source: declarationSource(context.index, receiver),
              argument_sources: outboundArguments(context.index, node),
            },
          ]
        : [];
    });
}

export function eventComparisons(
  context: JavaBindingContext,
  nodes: readonly SyntaxNode[],
): EventBinding['comparisons'] {
  const operators = new Set([
    'EQUAL_TO',
    'NOT_EQUAL_TO',
    'CONDITIONAL_OR',
    'CONDITIONAL_AND',
    'LOGICAL_COMPLEMENT',
  ]);
  return nodes
    .filter((node) => operators.has(node.kind))
    .map((node) => ({
      source: declarationSource(context.index, node),
      operator: node.kind,
      operand_sources: ['left', 'right', 'operand', 'operands']
        .flatMap((field) => declarationChildren(context.index, node, field))
        .map((entry) => declarationSource(context.index, entry)),
    }));
}
