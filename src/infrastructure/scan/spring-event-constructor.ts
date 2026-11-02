import 'server-only';

import type { JavaBindingContext } from './java-call-binding-types';
import { javaExpressionType } from './java-call-resolution';
import { javaField } from './java-call-syntax';
import { javaTypeName } from './java-call-types';
import { declarationChildren, declarationSource } from './java-declaration-parts';
import type { JavaType } from './java-declarations';
import type { SyntaxNode } from './source-index-types';
import type { EventBinding } from './spring-event-types';

type FieldBindings = EventBinding['constructions'][number]['fields'];

/** Ordinary classes require an explicit, straight-line initialiser assignment, not field order. */
export function eventConstructorFields(
  construction: { readonly context: JavaBindingContext; readonly arguments: readonly SyntaxNode[] },
  declaration: { readonly context: JavaBindingContext; readonly type: JavaType },
): FieldBindings {
  const { context, type } = declaration;
  const initialisers = type.methods.filter(
    (method) =>
      method.name === '<init>' &&
      method.parameters.length === construction.arguments.length &&
      method.parameters.every((parameter, position) => {
        const argument = construction.arguments.at(position);
        return (
          argument !== undefined &&
          javaExpressionType(construction.context, argument) ===
            javaTypeName(parameter.type, context.unit)
        );
      }),
  );
  const initialiser = initialisers.length === 1 ? initialisers[0] : undefined;
  if (!initialiser) return [];
  const methodNode = context.index.nodes.find(
    (node) => declarationSource(context.index, node) === initialiser.source,
  );
  if (!methodNode) return [];
  const assignments = directAssignments(context, methodNode);
  return bindFields({ construction, declaration, initialiser, assignments });
}

function directAssignments(
  context: JavaBindingContext,
  methodNode: SyntaxNode,
): readonly SyntaxNode[] {
  const body = javaField(context.index, methodNode, 'body');
  if (!body) return [];
  const statements = declarationChildren(context.index, body, 'statements');
  const assignments = statements.flatMap((statement) => {
    const expression = javaField(context.index, statement, 'expression');
    return expression?.kind === 'ASSIGNMENT' ? [expression] : [];
  });
  if (
    assignments.length !== statements.length ||
    assignments.some((node) => {
      const target = javaField(context.index, node, 'targets');
      const receiver = target && javaField(context.index, target, 'receiver');
      return receiver?.text !== 'this';
    })
  ) {
    return [];
  }
  return assignments;
}

function bindFields(input: {
  readonly construction: {
    readonly context: JavaBindingContext;
    readonly arguments: readonly SyntaxNode[];
  };
  readonly declaration: { readonly context: JavaBindingContext; readonly type: JavaType };
  readonly initialiser: JavaType['methods'][number];
  readonly assignments: readonly SyntaxNode[];
}): FieldBindings {
  const {
    construction,
    declaration: { context, type },
    initialiser,
    assignments,
  } = input;
  return assignments.flatMap((node) => {
    const target = javaField(context.index, node, 'targets');
    const value = javaField(context.index, node, 'values');
    const receiver = target && javaField(context.index, target, 'receiver');
    // Explicit this.field and a bare initialiser formal avoid shadowing and arbitrary expressions.
    if (!target || receiver?.text !== 'this' || value?.kind !== 'IDENTIFIER') return [];
    if (
      assignments.some(
        (other) =>
          other !== node && javaField(context.index, other, 'targets')?.symbol === target.symbol,
      )
    ) {
      return [];
    }
    const position = initialiser.parameters.findIndex((parameter) => parameter.name === value.text);
    const argument = construction.arguments.at(position);
    const field = type.fields.find((entry) => entry.name === target.symbol);
    return position === -1 || !field || !argument
      ? []
      : [
          {
            field: field.name,
            field_source: field.source,
            value_source: declarationSource(construction.context.index, argument),
          },
        ];
  });
}
