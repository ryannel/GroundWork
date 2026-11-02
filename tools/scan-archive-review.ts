import type { ScanDocument } from '@/domain/scan/scan.generated';
import type { ScheduleBinding } from '@/infrastructure/scan/spring-schedule-types';

import { archiveCounterIncrements, archiveFlowClauses } from './scan-archive-review-flow';
import type { EventQuestionProof } from './scan-event-review';
import { messageConfigurationValue } from './scan-message-review-configuration';
import {
  messageBoundary,
  messageCall,
  messageLocal,
  messageMethod,
} from './scan-message-review-graph';
import { profileGraph, type ProfileGraph } from './scan-profile-review-graph';
import { individualRecipe } from './scan-profile-review-individual-atoms';
import { methodRecipe } from './scan-profile-review-method';
import { targets } from './scan-semantic-query';

function sourceFile(graph: ProfileGraph, source: string, file: string): boolean {
  return graph.document.sources.some(
    (entry) => entry.id === source && entry.path.endsWith(`/${file}.java`),
  );
}
function argument(
  annotations: ScheduleBinding['annotations'],
  type: string,
  expected: readonly [string, string],
): boolean {
  return annotations.some(
    (annotation) =>
      annotation.annotation_type.endsWith(`.${type}`) &&
      annotation.arguments.some(
        (entry) => entry.name === expected[0] && entry.expression === expected[1],
      ),
  );
}
function declaration(graph: ProfileGraph): ScheduleBinding | undefined {
  const method = messageMethod(graph, ['CustomerArchiveScheduler', 'run', 0]);
  const records =
    graph.document.bindings?.filter((record) => record.kind === 'schedule_binding') ?? [];
  const candidates = records.filter(
    (record) =>
      record.source === method?.source &&
      record.owner_type ===
        'com.volvocars.ecom.customerservice.customerarchive.CustomerArchiveScheduler',
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}
function scheduleClauses(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  const schedule = declaration(graph);
  const annotations = schedule?.annotations ?? [];
  const activation = schedule?.activation_declarations ?? [];
  return {
    cronAndLockDeclarations: [
      argument(annotations, 'Scheduled', ['cron', `"\${customer-archive.scheduler.cron}"`]),
      argument(annotations, 'SchedulerLock', ['name', '"customerArchiveScheduler"']),
      argument(annotations, 'SchedulerLock', [
        'lockAtLeastFor',
        `"\${customer-archive.scheduler.lock-at-least}"`,
      ]),
      argument(annotations, 'SchedulerLock', [
        'lockAtMostFor',
        `"\${customer-archive.scheduler.lock-at-most}"`,
      ]),
      annotations.every((entry) => entry.owner_source === schedule?.source),
    ].every(Boolean),
    enablementDeclarations:
      schedule?.conditions.some(
        (condition) =>
          condition.owner_source === schedule.owner_source &&
          condition.annotation_type.endsWith('.ConditionalOnProperty') &&
          [
            ['prefix', '"customer-archive"'],
            ['value', '"enabled"'],
            ['havingValue', '"true"'],
          ].every(([name, expression]) =>
            condition.arguments.some(
              (entry) => entry.name === name && entry.expression === expression,
            ),
          ),
      ) === true,
    schedulingAndLockActivation:
      activation.some((entry) => entry.annotation_type.endsWith('.EnableScheduling')) &&
      activation.every(
        (entry) =>
          sourceFile(graph, entry.owner_source, 'App') && sourceFile(graph, entry.source, 'App'),
      ) &&
      argument(activation, 'EnableSchedulerLock', ['defaultLockAtMostFor', '"PT25S"']),
    sourceRuntimeBoundary:
      schedule?.activation === 'declared_runtime_unverified' &&
      [schedule.lock_scope].includes('scheduled_invocation_only_async_completion_unverified') &&
      schedule.gaps.length > 0,
  };
}
function executorDeclaration(graph: ProfileGraph): boolean {
  const owner = messageMethod(graph, [
    'CustomerArchiveConfig',
    'customerArchiveJobTaskExecutor',
    0,
  ]);
  const statements = targets(graph, targets(graph, owner, 'body')[0], 'statement');
  const expected = [
    'taskExecutor.setThreadPriority(Thread.MIN_PRIORITY)',
    'taskExecutor.setCorePoolSize(1)',
    'taskExecutor.setMaxPoolSize(1)',
    'taskExecutor.setThreadNamePrefix("AsyncThreadCustomerArchive-")',
  ];
  return [
    messageLocal(graph, owner),
    statements.length === 6,
    individualRecipe(graph, targets(graph, statements[0], 'value')[0]) ===
      'ThreadPoolTaskExecutor()',
    expected.every(
      (recipe, position) => individualRecipe(graph, statements[position + 1]) === recipe,
    ),
    individualRecipe(graph, targets(graph, statements[5], 'returns')[0]) === 'taskExecutor',
  ].every(Boolean);
}
function configuration(graph: ProfileGraph): Readonly<Record<string, boolean>> {
  const prefix = 'customer-archive.';
  const values: readonly (readonly [string, string | boolean])[] = [
    ['enabled', true],
    ['scheduler.cron', '0 */30 * * * *'],
    ['scheduler.lock-at-least', 'PT15M'],
    ['scheduler.lock-at-most', 'PT29M'],
  ];
  const provider = messageMethod(graph, ['CustomerArchiveConfig', 'lockProvider', 1]);
  return {
    baseSourceConfiguration: values.every(([key, value]) =>
      messageConfigurationValue(graph.document, [prefix + key, value, 'application.yml']),
    ),
    mongoLockProvider:
      declaration(graph)?.lock_provider_sources.includes(provider?.source ?? '') === true &&
      targets(graph, targets(graph, provider, 'body')[0], 'statement').length === 1 &&
      methodRecipe(graph, ['CustomerArchiveConfig', 'lockProvider', 1], {
        returns: ['MongoLockProvider(mongoTemplate.getDb())'],
      }),
    singleWorkerExecutor: executorDeclaration(graph),
  };
}
function asyncDispatch(graph: ProfileGraph): boolean {
  const run = messageMethod(graph, ['CustomerArchiveScheduler', 'run', 0]);
  const job = messageMethod(graph, ['CustomerArchiveJob', 'start', 0]);
  const call = messageCall(graph, run, 'customerArchiveJob.start()');
  const async = graph.document.bindings?.find(
    (entry) => entry.kind === 'async_binding' && entry.source === job?.source,
  );
  if (async?.kind !== 'async_binding') return false;
  const schedule = declaration(graph);
  const invocation = schedule?.async_invocations.find(
    (entry) => entry.call_source === call?.source,
  );

  return [
    messageBoundary(graph, call, job),
    targets(graph, targets(graph, run, 'body')[0], 'statement').length === 1,
    async.executor === 'customerArchiveJobTaskExecutor',
    async.completion === 'void',
    [async.activation].includes('declared_runtime_unverified'),
    async.activation_sources.some((source) => sourceFile(graph, source, 'AsyncConfiguration')),
    async.executor_sources.includes(
      messageMethod(graph, ['CustomerArchiveConfig', 'customerArchiveJobTaskExecutor', 0])
        ?.source ?? '',
    ),
    invocation?.async_binding_id === async.id,
    invocation?.owner_source === run?.source,
    invocation?.dispatch === 'receiver_proxy_unverified',
    invocation?.use === 'ignored',
    async.invocations.some(
      (entry) =>
        entry.call_source === invocation?.call_source &&
        entry.call_binding_id === invocation.call_binding_id &&
        entry.use === 'ignored',
    ),
    async.conditions.some(
      (condition) =>
        condition.owner_source === async.owner_source &&
        condition.annotation_type.endsWith('.ConditionalOnBean') &&
        condition.arguments.some((arg) => arg.expression === 'CustomerArchiveScheduler.class'),
    ),
  ].every(Boolean);
}

/** Complete frozen Q20 source answer, with runtime concurrency uncertainty retained. */
export function archiveQuestionProof(document: ScanDocument): EventQuestionProof {
  const graph = profileGraph(document);
  const clauses = {
    ...scheduleClauses(graph),
    ...configuration(graph),
    asyncDispatch: asyncDispatch(graph),
    ...archiveFlowClauses(graph),
    statisticsCounterIncrements: archiveCounterIncrements(graph),
  };
  return {
    supported: Object.values(clauses).every(Boolean),
    clauses,
    details: [
      'Base configuration declares enabled=true and the half-hour cron. SchedulerLock declares PT15M minimum and PT29M maximum; App declares scheduling and PT25S default maximum. Effective Spring properties and deployment remain unobserved.',
      'Mongo lock provider and named executor core/max pool one are declared. The scheduler ignores its void async job invocation. Proxy interception and lock lifetime through asynchronous completion are unverified; neither source declaration proves global full-job mutual exclusion.',
      'Each customer tries archive upsert, active delete and success count in order. Exception increments failed count and logs, normally permitting the next iteration. Lookup/iteration failure escapes to the outer job catch. A failure after the success counter may also increment the failure counter. No atomic rollback or durable success follows from local call order or counters.',
    ],
  };
}
