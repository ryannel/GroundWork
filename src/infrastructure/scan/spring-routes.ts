import 'server-only';

import type { JavaUnit } from './java-declarations';
import {
  springAnnotation,
  springMethods,
  springMethodAuthorisation,
  type SpringMethod,
} from './spring-route-methods';
import { springMapping, springParameters, type SpringParameter } from './spring-route-parameters';
import { springLiteral, springPath } from './spring-route-values';
import { annotationClasses, springViews } from './spring-schema-annotations';
import { springInterceptors, type SpringInterceptor } from './spring-security-interceptors';
import { springPathMatches } from './spring-security-paths';

export interface SpringRoute {
  readonly kind: 'route_binding';
  readonly id: string;
  readonly source_ids: readonly string[];
  readonly controller: string;
  readonly method: {
    readonly name: string;
    readonly parameter_types: readonly string[];
    readonly return_type: string;
    readonly implementation_source_id?: string;
    readonly declaration_source_id: string;
  };
  readonly http_method: string;
  readonly path: string;
  readonly parameters: readonly SpringParameter[];
  readonly response_status?: string;
  readonly documented_response_statuses: readonly string[];
  readonly response_json_views: readonly string[];
  readonly request_validation_groups: readonly string[];
  readonly security_binding_ids: readonly string[];
  readonly schema_binding_ids?: readonly string[];
  readonly uncertainties: readonly string[];
}

/** Bind declarations to controllers and exact signatures; deployment remains unobserved. */
export function springRoutes(units: readonly JavaUnit[]): readonly SpringRoute[] {
  const interceptors = springInterceptors(units);
  return springMethods(units)
    .flatMap(routesForMethod)
    .map((route) => ({
      ...route,
      security_binding_ids: [...route.security_binding_ids, ...interceptorIds(route, interceptors)],
    }));
}

function routesForMethod(method: SpringMethod): readonly SpringRoute[] {
  const mapping = springMapping(method.declaration.annotations);
  if (!mapping) return [];
  const prefix =
    springMapping(method.controller.annotations) ??
    method.inherited
      .map((type) => springMapping(type.annotations))
      .find((candidate) => candidate !== undefined);
  return (prefix?.paths ?? ['']).flatMap((base) =>
    mapping.paths.flatMap((path) =>
      mapping.methods.map((verb) =>
        makeRoute({
          method,
          path: springPath(base, path),
          verb,
          unresolved: mapping.unresolved || prefix?.unresolved === true,
        }),
      ),
    ),
  );
}

function makeRoute(input: {
  readonly method: SpringMethod;
  readonly path: string;
  readonly verb: string;
  readonly unresolved: boolean;
}): SpringRoute {
  const { method, path, verb } = input;
  const declaration = method.declaration;
  const policy = springMethodAuthorisation(method);
  return {
    kind: 'route_binding',
    id: `spring-route:${method.controller.source}:${declaration.source}:${verb}:${path}`,
    source_ids: routeSources(method),
    controller: method.controller.qualifiedName,
    method: routeMethod(method),
    response_json_views: springViews([
      ...(method.implementation?.annotations ?? []),
      ...declaration.annotations,
    ]),
    request_validation_groups: annotationClasses(
      springAnnotation(declaration.annotations, 'Validated')?.arguments.value,
    ),
    http_method: verb,
    path,
    parameters: springParameters(declaration),
    ...routeStatus(method),
    documented_response_statuses: declaration.annotations
      .filter(
        (annotation) => annotation.name === 'io.swagger.v3.oas.annotations.responses.ApiResponse',
      )
      .flatMap((annotation) => {
        const value = springLiteral(annotation.arguments.responseCode ?? '');
        return value === undefined ? [] : [value];
      }),
    schema_binding_ids: [],
    security_binding_ids: policy ? [`spring-security:${policy.source}`] : [],
    uncertainties: routeUncertainties(method, input.unresolved),
  };
}

function routeUncertainties(method: SpringMethod, unresolved: boolean): readonly string[] {
  const uncertainties = [
    'Runtime registration, deployment and external framework configuration are unobserved.',
  ];
  if (!method.implementation) {
    uncertainties.push('No exact implementation signature found in the selected source.');
  }
  if (unresolved) {
    uncertainties.push(
      'Mapping path expression is unresolved; displayed path retains only literal segments.',
    );
  }
  return uncertainties;
}

function routeSources(method: SpringMethod): readonly string[] {
  return [
    ...new Set([
      method.controller.source,
      method.declaration.source,
      ...method.inherited.map((type) => type.source),
      ...(method.implementation ? [method.implementation.source] : []),
    ]),
  ];
}

function routeMethod(method: SpringMethod): SpringRoute['method'] {
  const declaration = method.declaration;
  return {
    name: declaration.name,
    parameter_types: declaration.parameters.map((parameter) => parameter.type),
    return_type: declaration.returnType,
    ...(method.implementation ? { implementation_source_id: method.implementation.source } : {}),
    declaration_source_id: declaration.source,
  };
}

function routeStatus(method: SpringMethod): Pick<SpringRoute, 'response_status'> {
  const status =
    springAnnotation(method.declaration.annotations, 'ResponseStatus') ??
    springAnnotation(method.implementation?.annotations ?? [], 'ResponseStatus');
  const value = status?.arguments.code ?? status?.arguments.value;
  return value === undefined ? {} : { response_status: springLiteral(value) ?? value };
}

function interceptorIds(
  route: SpringRoute,
  interceptors: readonly SpringInterceptor[],
): readonly string[] {
  return interceptors
    .filter((interceptor) =>
      interceptor.policies.some(
        (policy) =>
          policy.paths.some((pattern) => springPathMatches(pattern, route.path) === true) &&
          policy.excluded_paths.every(
            (pattern) => springPathMatches(pattern, route.path) === false,
          ),
      ),
    )
    .map((interceptor) => interceptor.id);
}
