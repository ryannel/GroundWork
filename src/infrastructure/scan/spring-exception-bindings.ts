import 'server-only';

import { declarationChildren, declarationSource, declarationText } from './java-declaration-parts';
import type { JavaUnit } from './java-declarations';
import type { SourceIndex, SyntaxNode } from './source-index-types';
import {
  exceptionAnnotation,
  exceptionDeclarations,
  exceptionHandlers,
} from './spring-exception-handlers';
import type { SpringExceptionBinding } from './spring-exception-types';
import { springDeclaration } from './spring-schema-inheritance';

function ancestors(index: SourceIndex, node: SyntaxNode): readonly SyntaxNode[] {
  const result: SyntaxNode[] = [];
  let parent = node.parent;
  while (parent !== null) {
    const current = index.nodes[parent];
    if (!current) break;
    result.push(current);
    parent = current.parent;
  }
  return result;
}

interface ExceptionContext {
  readonly index: SourceIndex;
  readonly unit: JavaUnit;
  readonly indexes: readonly SourceIndex[];
  readonly declarations: ReturnType<typeof exceptionDeclarations>;
}

function throwBinding(
  context: ExceptionContext,
  node: SyntaxNode,
): readonly SpringExceptionBinding[] {
  const { index, unit, indexes, declarations } = context;
  const creation = declarationChildren(index, node, 'values').find(
    (child) => child.kind === 'NEW_CLASS',
  );
  const parents = ancestors(index, node);
  const method = parents.find((parent) => parent.kind === 'METHOD');
  if (!creation || !method) return [];
  const name = declarationText(index, creation, 'callee')[0];
  const thrown = name === undefined ? undefined : springDeclaration(name, unit, declarations);
  if (!thrown) return [];
  const candidates = exceptionHandlers(thrown, declarations, indexes);
  const guards = parents
    .filter((parent) => parent.kind === 'IF')
    .flatMap((branch) => declarationChildren(index, branch, 'condition'));
  const tries = parents.filter((parent) => parent.kind === 'TRY');
  const source = declarationSource(index, node);
  return [
    {
      kind: 'exception_binding',
      id: `spring-exception:${source}`,
      source_ids: [
        ...new Set([
          source,
          thrown.type.source,
          declarationSource(index, method),
          ...candidates.flatMap((candidate) => [
            candidate.advice_source_id,
            candidate.handler_source_id,
            ...candidate.support_source_ids,
          ]),
        ]),
      ],
      thrown_type: thrown.type.qualifiedName,
      throw_source_id: source,
      throwing_method_source_id: declarationSource(index, method),
      constructor_argument_source_ids: declarationChildren(index, creation, 'arguments').map(
        (argument) => declarationSource(index, argument),
      ),
      guard_source_ids: guards.map((guard) => declarationSource(index, guard)),
      enclosing_try_source_ids: tries.map((attempt) => declarationSource(index, attempt)),
      local_controller_handler_source_ids: localHandlers(declarations),
      candidates,
      resolution:
        candidates.length === 1 && candidates[0]?.scope === 'global' && tries.length === 0
          ? 'resolved'
          : 'unresolved',
      uncertainties: exceptionUncertainties(candidates.length, tries.length),
    },
  ];
}

function localHandlers(declarations: ReturnType<typeof exceptionDeclarations>): readonly string[] {
  return declarations
    .filter(
      (owner) =>
        exceptionAnnotation(owner.type.annotations, 'ControllerAdvice') === undefined &&
        exceptionAnnotation(owner.type.annotations, 'RestControllerAdvice') === undefined,
    )
    .flatMap((owner) =>
      owner.type.methods
        .filter((entry) => exceptionAnnotation(entry.annotations, 'ExceptionHandler') !== undefined)
        .map((entry) => entry.source),
    );
}

function exceptionUncertainties(candidates: number, tries: number): readonly string[] {
  return [
    'Source-declared advice selection does not establish runtime registration, deployment or effective external response serialisation.',
    'Propagation to an entrypoint requires exact invocation bindings and absence of intervening catches or local controller exception handlers.',
    ...(candidates === 1
      ? []
      : [
          'No unique source-declared assignable handler was found; advice precedence remains unresolved.',
        ]),
    ...(tries > 0
      ? ['An enclosing try requires catch and finally analysis before propagation is established.']
      : []),
  ];
}

/** Bind typed constructor throws to source-declared advice without inferring effective runtime registration. */
export function collectExceptionBindings(
  indexes: readonly SourceIndex[],
  units: readonly JavaUnit[],
): readonly SpringExceptionBinding[] {
  const declarations = exceptionDeclarations(units);
  return indexes
    .filter((index) => index.language === 'java' && index.diagnostics.length === 0)
    .flatMap((index) => {
      const unit = units.find((entry) => entry.path === index.path);
      if (!unit) return [];
      return index.nodes
        .filter((node) => node.kind === 'THROW')
        .flatMap((node) => throwBinding({ index, unit, indexes, declarations }, node));
    });
}
