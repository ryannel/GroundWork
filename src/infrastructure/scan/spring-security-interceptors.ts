import 'server-only';

import {
  type JavaInvocation,
  type JavaMethod,
  type JavaType,
  type JavaUnit,
  resolveJavaType,
} from './java-declarations';
import { springAnnotation } from './spring-route-methods';
import { springLiteral } from './spring-route-values';
import { springEnforcementChain } from './spring-security-chain';
import { springPreHandle, springRegistryParameter } from './spring-security-types';

export interface SpringInterceptor {
  readonly kind: 'security_binding';
  readonly id: string;
  readonly source_ids: readonly string[];
  readonly mechanism: 'header_interceptor';
  readonly scope: string;
  readonly policies: readonly {
    readonly expression: string;
    readonly source_id: string;
    readonly paths: readonly string[];
    readonly excluded_paths: readonly string[];
  }[];
  readonly activation: { readonly state: 'source_enabled'; readonly source_ids: readonly string[] };
  readonly authentication: readonly string[];
  readonly authorisation: readonly string[];
  readonly enforcement_chain: readonly {
    readonly stage: string;
    readonly source_ids: readonly string[];
    readonly detail: string;
  }[];
  readonly uncertainties: readonly string[];
}

function constants(type: JavaType): ReadonlyMap<string, string> {
  return new Map(
    type.fields.flatMap((field) => {
      const value = springLiteral(field.initializer ?? '');
      return value === undefined ? [] : [[field.name, value] as const];
    }),
  );
}

function calls(method: JavaMethod, name: string): readonly JavaInvocation[] {
  return (method.calls ?? []).filter((call) => call.callee.endsWith(`.${name}`));
}

function pathArguments(method: JavaMethod, name: string, type: JavaType): readonly string[] {
  const values = constants(type);
  const registration = calls(method, 'addInterceptor')[0];
  if (!registration) return [];
  const receiver = `${registration.callee}(${registration.arguments.join(',')})`.replaceAll(
    /\s/gu,
    '',
  );
  return calls(method, name)
    .filter((call) => call.callee.replaceAll(/\s/gu, '').startsWith(`${receiver}.`))
    .flatMap((call) =>
      call.arguments.flatMap((argument) => {
        const value = springLiteral(argument) ?? values.get(argument);
        return value === undefined ? [] : [value];
      }),
    );
}

function registeredType(
  method: JavaMethod,
  config: JavaType,
  units: readonly JavaUnit[],
): JavaType | undefined {
  const registry = springRegistryParameter(method, config, units);
  if (registry === undefined) return undefined;
  const registrations = calls(method, 'addInterceptor').filter(
    (call) =>
      !call.conditional && call.callee.replaceAll(/\s/gu, '') === `${registry}.addInterceptor`,
  );
  if (registrations.length !== 1) return undefined;
  const field = config.fields.find(
    (candidate) => candidate.name === registrations[0]?.arguments[0],
  );
  const unit = units.find((candidate) => candidate.types.includes(config));
  if (!field || !unit) return undefined;
  const name = resolveJavaType(field.type, unit);
  return units.flatMap((entry) => entry.types).find((type) => type.qualifiedName === name);
}

export function springInterceptors(units: readonly JavaUnit[]): readonly SpringInterceptor[] {
  return units.flatMap((unit) => unit.types.flatMap((type) => configBindings(type, units)));
}

function configBindings(
  config: JavaType,
  units: readonly JavaUnit[],
): readonly SpringInterceptor[] {
  const unit = units.find((candidate) => candidate.types.includes(config));
  if (
    !unit ||
    !config.implements.some(
      (name) =>
        resolveJavaType(name, unit) ===
        'org.springframework.web.servlet.config.annotation.WebMvcConfigurer',
    ) ||
    !springAnnotation(config.annotations, 'Configuration')
  ) {
    return [];
  }
  return config.methods.flatMap((method) => {
    if (method.name !== 'addInterceptors') return [];
    const interceptor = registeredType(method, config, units);
    const preHandle = springPreHandle(interceptor, units);
    if (!interceptor || !preHandle) return [];
    return [binding({ config, method, interceptor, preHandle, units })];
  });
}

function headerReads(method: JavaMethod, interceptor: JavaType): readonly string[] {
  const values = constants(interceptor);
  const request = method.parameters[0]?.name;
  return calls(method, 'getHeader')
    .filter((call) => call.callee.replaceAll(/\s/gu, '') === `${request ?? ''}.getHeader`)
    .flatMap((call) => {
      const argument = call.arguments[0] ?? '';
      const value = springLiteral(argument) ?? values.get(argument);
      return value === undefined ? [] : [value];
    });
}

function binding(input: {
  readonly config: JavaType;
  readonly method: JavaMethod;
  readonly interceptor: JavaType;
  readonly preHandle: JavaMethod;
  readonly units: readonly JavaUnit[];
}): SpringInterceptor {
  const { config, method, interceptor, preHandle, units } = input;
  const chain = springEnforcementChain({ type: interceptor, method: preHandle }, units);
  const sources = [
    ...chain.flatMap((step) => step.source_ids),
    config.source,
    ...config.fields.map((field) => field.source),
    ...interceptor.fields.map((field) => field.source),
    method.source,
    interceptor.source,
    preHandle.source,
    ...(method.calls ?? []).map((call) => call.source),
    ...(preHandle.calls ?? []).map((call) => call.source),
  ];
  return {
    kind: 'security_binding',
    id: `spring-interceptor:${method.source}:${preHandle.source}`,
    source_ids: sources,
    mechanism: 'header_interceptor',
    scope: config.qualifiedName,
    policies: [
      {
        expression: preHandle.body ?? '',
        source_id: preHandle.source,
        paths: pathArguments(method, 'addPathPatterns', config),
        excluded_paths: pathArguments(method, 'excludePathPatterns', config),
      },
    ],
    activation: {
      state: 'source_enabled',
      source_ids: calls(method, 'addInterceptor').map((call) => call.source),
    },
    authentication: headerReads(preHandle, interceptor).map(
      (header) =>
        `Reads request header ${header}; requiredness and token acceptance depend on the retained guard and validator.`,
    ),
    authorisation: [],
    enforcement_chain: [
      { stage: 'mvc_registration', source_ids: [method.source], detail: method.body ?? '' },
      { stage: 'header_interceptor', source_ids: [preHandle.source], detail: preHandle.body ?? '' },
      ...chain,
    ],
    uncertainties: [
      'MVC source registration does not establish runtime activation.',
      'Local source calls do not establish token decoder selection, exception response status or successful authentication; external security configuration remains unresolved.',
    ],
  };
}
