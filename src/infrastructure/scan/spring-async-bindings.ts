import 'server-only';

import type { JavaAnnotation, JavaMethod, JavaType } from './java-declarations';
import type { SourceIndex } from './source-index-types';
import { executionDeclaration, methodValues } from './spring-async-execution';
import { asyncInvocation } from './spring-async-source';
import type { AsyncBinding, ExecutionBinding } from './spring-async-types';
import { configurationConditions } from './spring-configuration-conditions';
import type { OutboundInput } from './spring-outbound-provenance';
import { springLiteral } from './spring-route-values';

const ASYNC = 'org.springframework.scheduling.annotation.Async';
const ENABLE = 'org.springframework.scheduling.annotation.EnableAsync';
const FUTURES = new Set(['java.util.concurrent.CompletableFuture', 'java.util.concurrent.Future']);

function completion(input: OutboundInput, method: JavaMethod): AsyncBinding['completion'] {
  if (method.returnType === 'void') return 'void';
  const unit = input.units.find((candidate) =>
    candidate.types.some((type) => type.methods.includes(method)),
  );
  const base = method.returnType.split('<')[0] ?? '';
  const imported = unit?.imports.find((entry) => entry.endsWith(`.${base}`));
  return FUTURES.has(imported ?? base) ? 'future' : 'unknown';
}

function asyncConfiguration(input: OutboundInput, annotation: JavaAnnotation) {
  const activationSources = input.units.flatMap((unit) =>
    unit.types.flatMap((type) =>
      type.annotations.filter((entry) => entry.name === ENABLE).map((entry) => entry.source),
    ),
  );
  const executor = springLiteral(annotation.arguments.value ?? '') ?? null;
  const executorSources = input.units.flatMap((unit) =>
    unit.types
      .flatMap((type) => type.methods)
      .filter((candidate) =>
        candidate.annotations.some(
          (entry) =>
            entry.name === 'org.springframework.context.annotation.Bean' &&
            (executor === null ||
              candidate.name === executor ||
              springLiteral(entry.arguments.value ?? entry.arguments.name ?? '') === executor),
        ),
      )
      .filter((candidate) => {
        const base = candidate.returnType.split('<')[0] ?? '';
        return [
          'java.util.concurrent.Executor',
          'org.springframework.core.task.TaskExecutor',
          'org.springframework.core.task.AsyncTaskExecutor',
          'org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor',
        ].includes(unit.imports.find((entry) => entry.endsWith(`.${base}`)) ?? base);
      })
      .map((candidate) => candidate.source),
  );
  return { activationSources, executorSources, executor };
}

function asyncDeclaration(
  input: OutboundInput,
  declaration: {
    readonly owner: JavaType;
    readonly method: JavaMethod;
    readonly annotation: JavaAnnotation;
  },
): AsyncBinding {
  const { owner, method, annotation } = declaration;
  const invocations = input.calls
    .filter((call) => call.resolution === 'exact' && call.target === method.source)
    .flatMap((call) => {
      const invocation = asyncInvocation(input, call);
      return invocation ? [invocation] : [];
    });
  const { activationSources, executorSources, executor } = asyncConfiguration(input, annotation);
  const callBindingIds = input.calls
    .filter((call) => call.caller === method.source || call.target === method.source)
    .map((call) => call.id);
  const support = [
    ...new Set([
      owner.source,
      method.source,
      annotation.source,
      ...configurationConditions(owner).map((entry) => entry.source),
      ...configurationConditions(method).map((entry) => entry.source),
      ...activationSources,
      ...executorSources,
      ...invocations.flatMap((entry) => [
        entry.call_source,
        entry.use_source,
        ...(entry.owner_source === null ? [] : [entry.owner_source]),
      ]),
    ]),
  ];
  return {
    kind: 'async_binding',
    id: `async:${method.source}`,
    source: method.source,
    owner_source: owner.source,
    owner_type: owner.qualifiedName,
    annotation_source: annotation.source,
    conditions: [...configurationConditions(owner), ...configurationConditions(method)],
    executor,
    activation_sources: activationSources,
    executor_sources: executorSources,
    activation: 'declared_runtime_unverified',
    return_type: method.returnType,
    completion: completion(input, method),
    invocations,
    call_binding_ids: callBindingIds,
    value_binding_ids: methodValues(input, new Set(support)),
    support,
    completeness: 'partial',
    gaps: [
      'Async declarations and executor candidates do not establish effective Spring activation, bean selection or proxy interception.',
      'Source return use does not establish task completion, failure observation, transaction outcome or event delivery.',
    ],
  };
}

/** Reuse compiler declarations and shared Java call/value relations for bounded source execution. */
export function collectAsyncBindings(
  input: OutboundInput & {
    readonly selected_owner_sources?: readonly string[];
  },
): readonly (AsyncBinding | ExecutionBinding)[] {
  const result: (AsyncBinding | ExecutionBinding)[] = [];
  for (const index of input.indexes) {
    if (index.diagnostics.length > 0) continue;
    const unit = input.units.find((candidate) => candidate.path === index.path);
    for (const owner of unit?.types ?? []) {
      result.push(...ownerBindings(input, index, owner));
    }
  }
  return result;
}

function ownerBindings(
  input: OutboundInput & { readonly selected_owner_sources?: readonly string[] },
  index: SourceIndex,
  owner: JavaType,
) {
  return owner.methods.flatMap((method) => {
    const annotation =
      method.annotations.find((entry) => entry.name === ASYNC) ??
      owner.annotations.find((entry) => entry.name === ASYNC);
    if (!annotation && input.selected_owner_sources?.includes(method.source) !== true) return [];
    return [
      executionDeclaration(input, index, { owner, method }),
      ...(annotation ? [asyncDeclaration(input, { owner, method, annotation })] : []),
    ];
  });
}
