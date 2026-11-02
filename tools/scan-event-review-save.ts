import type { ScanDocument, SemanticNode } from '@/domain/scan/scan.generated';

import { profileGraph, profileMethod, type ProfileGraph } from './scan-profile-review-graph';
import { individualRecipe, individualReferences } from './scan-profile-review-individual-atoms';
import { methodRecipe } from './scan-profile-review-method';
import { descendants, targets } from './scan-semantic-query';

const SAVE_POST = 'savePostProcessor.postProcess(previousCustomer,updatedCustomer)';
const POST = [
  'customerEventService.publishCustomerEvent(previousCustomer,updatedCustomer)',
  'analyticsEventService.publishAnalyticsEvent(previousCustomer,updatedCustomer)',
  'auditLogService.saveCustomerAuditLog(updatedCustomer)',
  'marketingConsentEventService.publishEvent(previousCustomer,updatedCustomer)',
];
const METHODS = [
  ['CustomerSavePostProcessor', 'postProcess', 'void'],
  ['CustomerEventService', 'publishCustomerEvent', 'void'],
  ['AnalyticsEventService', 'publishAnalyticsEvent', 'future'],
  ['MarketingConsentEventService', 'publishEvent', 'void'],
] as const;

function asyncClauses(graph: ProfileGraph) {
  const records = (graph.document.bindings ?? []).filter(
    (record) => record.kind === 'async_binding',
  );
  const selected = METHODS.map(([file, name, completion]) => {
    const owner = profileMethod(graph, file, name)[0];
    const record = records.find((candidate) => candidate.source === owner?.source);
    return { record, owner, completion };
  });
  return {
    asyncDeclarations: selected.every(({ record, owner, completion }) => {
      if (!owner || !record) return false;
      return (
        record.completion === completion &&
        graph.document.sources.some((source) => source.id === record.annotation_source)
      );
    }),
    activationAndExecutor:
      selected.every(
        ({ record }) =>
          record !== undefined &&
          record.activation_sources.length > 0 &&
          record.executor_sources.length > 0 &&
          [...record.activation_sources, ...record.executor_sources].every((id) =>
            graph.document.sources.some((source) => source.id === id),
          ),
      ) &&
      methodRecipe(graph, ['AsyncConfiguration', 'contextAwareTaskExecutor'], {
        calls: [
          'threadPoolTaskExecutor.setCorePoolSize(2)',
          'threadPoolTaskExecutor.setThreadNamePrefix("AsyncThread-")',
          'threadPoolTaskExecutor.setTaskDecorator(LogContextTaskDecorator())',
          'threadPoolTaskExecutor.initialize()',
        ],
        returns: ['DelegatingSecurityContextAsyncTaskExecutor(threadPoolTaskExecutor)'],
      }),
    ignoredAsyncResults: selected.every(
      ({ record, owner }) =>
        record !== undefined &&
        owner !== undefined &&
        record.invocations.some(
          (invocation) =>
            invocation.dispatch === 'receiver_proxy_unverified' &&
            invocation.use === 'ignored' &&
            graph.calls.some(
              (call) =>
                call.id === invocation.call_binding_id &&
                call.call === invocation.call_source &&
                call.target === owner.source,
            ),
        ),
    ),
  };
}

function executionClauses(graph: ProfileGraph) {
  const owners = [
    ...METHODS.map(([file, name]) => profileMethod(graph, file, name)[0]),
    profileMethod(graph, 'CustomerService', 'saveAndPostProcess')[0],
    profileMethod(graph, 'AuditLogService', 'saveCustomerAuditLog')[0],
  ];
  const records = (graph.document.bindings ?? []).filter(
    (record) => record.kind === 'execution_binding',
  );
  const post = owners[0];
  const execution = records.find((record) => record.source === post?.source);
  return {
    sourceFailureBoundary: owners.every((owner) => {
      const record = records.find((candidate) => candidate.source === owner?.source);
      if (!owner || !record) return false;
      return (
        record.transaction === 'none_in_selected_declaration' &&
        record.transaction_sources.length === 0 &&
        record.catch_sources.length === 0
      );
    }),
    ignoredAuditResult:
      execution !== undefined &&
      graph.calls.some(
        (call) =>
          new Set([post?.source]).has(call.caller ?? '') &&
          call.methodName === 'saveCustomerAuditLog' &&
          execution.call_results.some(
            (result) =>
              result.call_source === call.call &&
              result.call_binding_id === call.id &&
              result.use === 'ignored',
          ),
      ),
  };
}

function postBoundaryArguments(graph: ProfileGraph, post: SemanticNode | undefined): boolean {
  if (!post || !individualReferences(graph, post)) return false;
  const parameters = targets(graph, post, 'parameter');
  const calls = descendants(graph, post).filter((node) => node.nodeKind === 'call');
  if (calls.length !== POST.length) return false;
  return calls.every((call) => {
    const binding = graph.calls.find(
      (candidate) => candidate.call === call.source && candidate.resolution === 'exact',
    );
    const target = graph.nodes.find(
      (node) => node.nodeKind === 'function' && node.source === binding?.target,
    );
    if (!target || binding?.caller !== post.source) return false;
    const actual = targets(graph, call, 'argument');
    const formal = targets(graph, target, 'parameter');
    if (actual.length !== formal.length) return false;
    return actual.every((argument, position) => {
      const declaration = parameters.find((parameter) => parameter.name === argument.name);
      if (!declaration) return false;
      const lexical = graph.values.some(
        (value) =>
          value.relation === 'reference' &&
          value.from === declaration.source &&
          value.to === argument.source,
      );
      const application = graph.values.some(
        (value) =>
          value.relation === 'argument_parameter' &&
          value.call === call.source &&
          value.from === argument.source &&
          value.to === formal[position]?.source,
      );
      return lexical && application;
    });
  });
}

function reachesSaved(
  graph: ProfileGraph,
  use: SemanticNode | undefined,
  result: SemanticNode | undefined,
): boolean {
  if (!result) return false;
  const reaching = targets(graph, use, 'reaching_value');
  if (reaching.length !== 1) return false;
  const assigned = targets(graph, reaching[0], 'assigned_value');
  return assigned.length === 1 && assigned[0]?.id === result.id;
}

function savedRebinding(graph: ProfileGraph): boolean {
  const save = profileMethod(graph, 'CustomerService', 'saveAndPostProcess')[0];
  const saveNodes = descendants(graph, save);
  const assignment = saveNodes.find((node) => node.nodeKind === 'assignment');
  const target = targets(graph, assignment, 'target')[0];
  const value = targets(graph, assignment, 'value')[0];
  const statements = targets(graph, targets(graph, save, 'body')[0], 'statement');
  const savedAt = statements.findIndex((node) =>
    descendants(graph, node).some((child) => child.id === assignment?.id),
  );
  const postAt = statements.findIndex((node) => individualRecipe(graph, node) === SAVE_POST);
  const postCall = saveNodes.find(
    (node) => node.nodeKind === 'call' && individualRecipe(graph, node) === SAVE_POST,
  );
  return (
    [
      reachesSaved(graph, targets(graph, postCall, 'argument')[1], value),
      reachesSaved(graph, targets(graph, statements.at(-1), 'returns')[0], value),
      assignment?.operator === '=',
      individualRecipe(graph, target) === 'updatedCustomer',
      individualRecipe(graph, value) === 'customerRepository.save(updatedCustomer)',
      savedAt !== -1,
      postAt > savedAt,
      statements.at(-1)?.nodeKind === 'return',
      individualRecipe(graph, statements.at(-1)) === 'updatedCustomer',
    ].every(Boolean) &&
    graph.values.some(
      (binding) =>
        binding.relation === 'assignment' &&
        saveNodes.some(
          (node) =>
            node.source === binding.from &&
            individualRecipe(graph, node) === 'customerRepository.save(updatedCustomer)',
        ),
    ) &&
    methodRecipe(graph, ['CustomerService', 'saveAndPostProcess'], {
      calls: [SAVE_POST],
      returns: ['updatedCustomer'],
    })
  );
}

export function saveSourceClauses(document: ScanDocument): Readonly<Record<string, boolean>> {
  const graph = profileGraph(document);
  const post = profileMethod(graph, 'CustomerSavePostProcessor', 'postProcess')[0];
  const body = targets(graph, post, 'body')[0];
  const directCalls = targets(graph, body, 'statement').map((statement) =>
    individualRecipe(graph, statement),
  );
  return {
    savedValueRebinding: savedRebinding(graph),
    localAttemptOrder:
      directCalls.join(';') === POST.join(';') && postBoundaryArguments(graph, post),
    auditAttempt: methodRecipe(graph, ['AuditLogService', 'saveCustomerAuditLog'], {
      returns: ['auditLogRepository.save(customerAuditLogMapper.to(customer))'],
    }),
    analyticsCallback: methodRecipe(graph, ['AnalyticsEventService', 'publishAnalyticsEvent'], {
      branches: [
        {
          condition: 'kafkaTemplate==null||!settings.enabled()',
          returns: 'CompletableFuture.completedFuture(null)',
        },
      ],
      calls: ['kafkaTemplate.send(message)'],
      callbacks: [
        {
          call: 'kafkaTemplate.send(message).thenRun()',
          body: 'log.info("Customer analytics event published. eventType: {}, eventId: {}, customerId: {}",event.type(),event.id(),updated.customerId())',
          captures: ['updated'],
        },
      ],
    }),
    ...asyncClauses(graph),
    ...executionClauses(graph),
  };
}
