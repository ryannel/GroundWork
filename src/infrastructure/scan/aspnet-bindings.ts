import 'server-only';

import type { AspNetRouteBinding } from '@/domain/scan/scan.generated';

import type { CsharpMethodContracts } from './csharp-contract-schema';
import {
  attributeLiteral,
  csharpAttributes,
  csharpField,
  csharpMvcScope,
  csharpOwner,
  csharpSource,
  mvcAttribute,
  type CsharpMvcScope,
} from './csharp-declarations';
import { fieldExpressions } from './source-expressions';
import type { SourceIndex, SyntaxNode } from './source-index-types';

const METHODS: Readonly<Record<string, AspNetRouteBinding['httpMethods'][number]>> = {
  HttpGet: 'GET',
  HttpPost: 'POST',
  HttpPut: 'PUT',
  HttpDelete: 'DELETE',
  HttpPatch: 'PATCH',
  HttpHead: 'HEAD',
  HttpOptions: 'OPTIONS',
};

interface RouteSelection {
  readonly template: string | null;
  readonly support: readonly string[];
  readonly limitations: readonly string[];
}

function routeAttributes(index: SourceIndex, node: SyntaxNode, scope: CsharpMvcScope) {
  return csharpAttributes(index, node).filter(
    (entry) => mvcAttribute(index, entry, scope) === 'Route',
  );
}

function actionTemplate(
  index: SourceIndex,
  attribute: SyntaxNode,
  context: { readonly method: SyntaxNode; readonly scope: CsharpMvcScope },
): RouteSelection {
  const routes = routeAttributes(index, context.method, context.scope);
  const support = routes.map((route) => csharpSource(index, route));
  const hasHttpTemplate = (attribute.fields?.arguments?.length ?? 0) > 0;
  if (routes.length > 1 || (routes.length > 0 && hasHttpTemplate)) {
    return {
      template: null,
      support,
      limitations: [
        'Route selector composition unresolved: multiple method routes or an HTTP template combined with a separate method Route attribute.',
      ],
    };
  }
  const template = attributeLiteral(index, routes[0] ?? attribute);
  const unresolved = template === null && (routes.length > 0 || hasHttpTemplate);
  return {
    template,
    support,
    limitations: unresolved ? ['Source route template expression is unresolved.'] : [],
  };
}

function routeTemplate(
  index: SourceIndex,
  controller: SyntaxNode,
  input: {
    readonly attribute: SyntaxNode;
    readonly method: SyntaxNode;
    readonly scope: CsharpMvcScope;
  },
): RouteSelection {
  const action = actionTemplate(index, input.attribute, input);
  const routes = routeAttributes(index, controller, input.scope);
  const support = [...action.support, ...routes.map((route) => csharpSource(index, route))];
  const prefix = routes[0] ? attributeLiteral(index, routes[0]) : '';
  if (action.limitations.length > 0 || routes.length > 1 || prefix === null) {
    return {
      template: null,
      support,
      limitations: [...action.limitations, 'Controller or action route selector is unresolved.'],
    };
  }
  const joined = joinRoute(prefix, action.template)
    .replaceAll('[controller]', (controller.symbol ?? '').replace(/Controller$/u, ''))
    .replaceAll('[action]', input.method.symbol ?? '');
  return { template: joined, support, limitations: [] };
}

function joinRoute(prefix: string, method: string | null): string {
  if (method !== null && (method.startsWith('/') || method.startsWith('~/'))) {
    return method.replace(/^~\//u, '/');
  }
  if (method === null || method.length === 0) return prefix;
  return [trimRouteEnd(prefix), method].filter((part) => part.length > 0).join('/');
}

function trimRouteEnd(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === '/') end -= 1;
  return value.slice(0, end);
}

function methodRoutes(
  index: SourceIndex,
  method: SyntaxNode,
  program: {
    readonly signatures: readonly CsharpMethodContracts[];
    readonly scope: CsharpMvcScope;
  },
): readonly AspNetRouteBinding[] {
  const { signatures, scope } = program;
  const controller = csharpOwner(index, method, ['CLASS']);
  if (!controller) return [];
  return csharpAttributes(index, method).flatMap((attribute) => {
    const name = mvcAttribute(index, attribute, scope);
    const verb = name === null ? undefined : METHODS[name];
    if (verb === undefined) return [];
    const source = csharpSource(index, method);
    const route = routeTemplate(index, controller, { attribute, method, scope });
    return [
      {
        kind: 'aspnet_route_binding',
        id: `aspnet:${csharpSource(index, attribute)}`,
        source,
        input_contract_ids: [
          ...(signatures.find((entry) => entry.source === source)?.inputs ?? []),
        ],
        output_contract_ids: [
          ...(signatures.find((entry) => entry.source === source)?.outputs ?? []),
        ],
        support: [
          source,
          csharpSource(index, controller),
          csharpSource(index, attribute),
          ...route.support,
        ],
        controller: controller.symbol ?? '',
        method: method.symbol ?? '',
        httpMethods: [verb],
        template: route.template,
        parameters: csharpField(index, method, 'parameters').map((parameter) => ({
          name: parameter.symbol ?? '',
          type: fieldExpressions(index, parameter, 'type')[0] ?? 'unknown',
          source: csharpSource(index, parameter),
        })),
        status: 'source_declared',
        limitations: [
          'Controller activation, route conventions, API version substitution, middleware and runtime authorisation are unresolved.',
          ...route.limitations,
          'Source attributes and DTO types do not prove effective wire serialisation.',
        ],
      },
    ];
  });
}

export function collectAspNetRoutes(
  indexes: readonly SourceIndex[],
  signatures: readonly CsharpMethodContracts[] = [],
): readonly AspNetRouteBinding[] {
  const selected = indexes.filter(
    (index) => index.language === 'csharp' && index.diagnostics.length === 0,
  );
  const scope = csharpMvcScope(selected);
  return selected.flatMap((index) =>
    index.nodes
      .filter((node) => node.kind === 'METHOD')
      .flatMap((method) => methodRoutes(index, method, { signatures, scope })),
  );
}
