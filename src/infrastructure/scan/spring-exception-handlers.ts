import 'server-only';

import { declarationChildren, declarationSource } from './java-declaration-parts';
import type { JavaAnnotation, JavaMethod, JavaUnit } from './java-declarations';
import type { SourceIndex } from './source-index-types';
import type { SpringExceptionHandler } from './spring-exception-types';
import { annotationClasses } from './spring-schema-annotations';
import {
  springDeclaration,
  springInheritedDeclarations,
  type SpringDeclaration,
} from './spring-schema-inheritance';
import { enclosingFunction } from './syntax-candidates';

const WEB = 'org.springframework.web.bind.annotation.';
export function exceptionAnnotation(
  annotations: readonly JavaAnnotation[],
  name: string,
): JavaAnnotation | undefined {
  return annotations.find((annotation) => annotation.name === `${WEB}${name}`);
}

function handlerTypes(method: JavaMethod): readonly string[] {
  const annotation = exceptionAnnotation(method.annotations, 'ExceptionHandler');
  if (!annotation) return [];
  return annotationClasses(annotation.arguments.value ?? annotation.arguments.exception);
}

function returns(method: JavaMethod, indexes: readonly SourceIndex[]): readonly string[] {
  return indexes.flatMap((index) => {
    const owner = index.nodes.find((node) => declarationSource(index, node) === method.source);
    if (!owner) return [];
    return index.nodes
      .filter(
        (node) =>
          node.kind === 'RETURN' && enclosingFunction(index, node) === index.nodes.indexOf(owner),
      )
      .flatMap((node) =>
        declarationChildren(index, node, 'values').map((value) => declarationSource(index, value)),
      );
  });
}

function construction(
  method: JavaMethod,
  owner: SpringDeclaration,
  declarations: readonly SpringDeclaration[],
): readonly JavaMethod[] {
  const inherited = springInheritedDeclarations(owner, declarations).declarations;
  const result: JavaMethod[] = [];
  const pending = [method];
  while (pending.length > 0) {
    const current = pending.shift();
    if (!current || result.includes(current)) continue;
    result.push(current);
    for (const call of current.calls ?? []) {
      if (call.callee.includes('.')) continue;
      const matches = inherited
        .flatMap((entry) => entry.type.methods)
        .filter(
          (candidate) =>
            candidate.name === call.callee && candidate.parameters.length === call.arguments.length,
        );
      if (matches.length === 1 && matches[0]) pending.push(matches[0]);
    }
  }
  return result;
}

function methodHandlers(
  owner: SpringDeclaration,
  method: JavaMethod,
  context: {
    readonly declarations: readonly SpringDeclaration[];
    readonly closure: readonly SpringDeclaration[];
    readonly indexes: readonly SourceIndex[];
  },
): readonly SpringExceptionHandler[] {
  const { declarations, closure, indexes } = context;
  const advice =
    exceptionAnnotation(owner.type.annotations, 'ControllerAdvice') ??
    exceptionAnnotation(owner.type.annotations, 'RestControllerAdvice');
  if (!advice) return [];
  const result: SpringExceptionHandler[] = [];
  for (const name of handlerTypes(method)) {
    const resolved = springDeclaration(name, owner.unit, declarations);
    if (
      !resolved ||
      !closure.some((parent) => parent.type.qualifiedName === resolved.type.qualifiedName)
    ) {
      continue;
    }
    const status = exceptionAnnotation(method.annotations, 'ResponseStatus');
    const methods = construction(method, owner, declarations);
    const statusValue = status?.arguments.code ?? status?.arguments.value;
    result.push({
      advice: owner.type.qualifiedName,
      advice_source_id: owner.type.source,
      handler_source_id: method.source,
      handled_type: resolved.type.qualifiedName,
      scope: Object.keys(advice.arguments).length === 0 ? 'global' : 'unresolved',
      ...(statusValue === undefined ? {} : { response_status: statusValue }),
      response_return_source_ids: returns(method, indexes),
      response_construction_owners: methods.flatMap((entry) =>
        (entry.calls ?? []).map((call) => ({
          source_id: call.source,
          owner_method_source_id: entry.source,
        })),
      ),
      response_construction_source_ids: methods.flatMap((entry) =>
        (entry.calls ?? []).map((call) => call.source),
      ),
      support_source_ids: [
        ...new Set([
          advice.source,
          ...(status ? [status.source] : []),
          ...methods.map((entry) => entry.source),
          ...closure.map((entry) => entry.type.source),
        ]),
      ],
    });
  }
  return result;
}

export function exceptionHandlers(
  thrown: SpringDeclaration,
  declarations: readonly SpringDeclaration[],
  indexes: readonly SourceIndex[],
): readonly SpringExceptionHandler[] {
  const closure = springInheritedDeclarations(thrown, declarations).declarations;
  return declarations.flatMap((owner) =>
    owner.type.methods.flatMap((method) =>
      methodHandlers(owner, method, { declarations, closure, indexes }),
    ),
  );
}

export function exceptionDeclarations(units: readonly JavaUnit[]): readonly SpringDeclaration[] {
  return units.flatMap((unit) => unit.types.map((type) => ({ unit, type })));
}
