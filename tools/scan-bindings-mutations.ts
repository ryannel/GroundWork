import type { ScanDocument } from '@/domain/scan/scan.generated';

import { bindingReviewProofs } from './scan-bindings-proofs';

interface MutationAttempt {
  readonly name: string;
  readonly question: 'q05' | 'q14' | 'outbound';
  readonly rejected: boolean;
}

function mutationRecorder() {
  const mutations: MutationAttempt[] = [];
  const check = (name: string, question: MutationAttempt['question'], changed: ScanDocument) => {
    mutations.push({
      name,
      question,
      rejected: bindingReviewProofs(changed)[question].supported === false,
    });
  };
  return { mutations, check };
}

/** Mutations preserve all node display text and only remove or corrupt required native relations. */
function exceptionMutations(document: ScanDocument): readonly MutationAttempt[] {
  const { mutations, check } = mutationRecorder();
  for (const relation of [
    'condition',
    'consequent',
    'callback',
    'value',
    'argument',
    'receiver',
    'returns',
  ] as const) {
    check(`q05-remove-${relation}`, 'q05', {
      ...document,
      semantic: (document.semantic ?? []).filter(
        (record) => record.kind !== 'semantic_edge' || record.relation !== relation,
      ),
    });
  }
  const bindings = document.bindings ?? [];
  for (const selected of bindings.filter(
    (record) =>
      record.kind === 'java_call_binding' &&
      record.methodName === 'updateIndividual' &&
      record.resolution === 'exact',
  )) {
    check(`q05-remove-call-${selected.id}`, 'q05', {
      ...document,
      bindings: bindings.filter((binding) => binding.id !== selected.id),
    });
  }
  for (const relation of ['reference', 'argument_parameter'] as const) {
    check(`q05-remove-${relation}`, 'q05', {
      ...document,
      bindings: bindings.filter(
        (record) => record.kind !== 'java_value_binding' || record.relation !== relation,
      ),
    });
  }
  return [...mutations, ...handlerMutations(document)];
}

function handlerMutations(document: ScanDocument): readonly MutationAttempt[] {
  const bindings = document.bindings ?? [];
  const { mutations, check } = mutationRecorder();
  check('q05-remove-handler', 'q05', {
    ...document,
    bindings: bindings.map((record) =>
      record.kind === 'exception_binding' ? { ...record, candidates: [] } : record,
    ),
  });
  check('q05-corrupt-status', 'q05', {
    ...document,
    bindings: bindings.map((record) =>
      record.kind === 'exception_binding'
        ? {
            ...record,
            candidates: record.candidates.map((handler) => ({
              ...handler,
              response_status: 'HttpStatus.BAD_REQUEST',
            })),
          }
        : record,
    ),
  });
  return mutations;
}

function mongoMutations(document: ScanDocument): readonly MutationAttempt[] {
  const bindings = document.bindings ?? [];
  const { mutations, check } = mutationRecorder();
  for (const selected of bindings.filter((record) =>
    ['mongo_collection_binding', 'mongo_repository_binding', 'mongo_operation_binding'].includes(
      record.kind,
    ),
  )) {
    check(`q14-remove-${selected.id}`, 'q14', {
      ...document,
      bindings: bindings.filter((binding) => binding.id !== selected.id),
    });
  }
  check('q14-corrupt-receiver', 'q14', {
    ...document,
    bindings: bindings.map((record) =>
      record.kind === 'mongo_operation_binding'
        ? { ...record, receiverType: 'unresolved.Type' }
        : record,
    ),
  });
  check('q14-remove-fragment', 'q14', {
    ...document,
    bindings: bindings.map((record) =>
      record.kind === 'mongo_repository_binding' ? { ...record, fragments: [] } : record,
    ),
  });
  check('q14-remove-update-fields', 'q14', {
    ...document,
    bindings: bindings.map((record) =>
      record.kind === 'mongo_operation_binding' ? { ...record, update_fields: [] } : record,
    ),
  });
  return mutations;
}

function outboundMutations(document: ScanDocument): readonly MutationAttempt[] {
  const bindings = document.bindings ?? [];
  const changed: readonly (readonly [string, ScanDocument])[] = [
    ...(['condition', 'left', 'right', 'consequent', 'catch', 'value'] as const).map(
      (relation) =>
        [`outbound-remove-${relation}`, withoutSemanticRelation(document, relation)] as const,
    ),
    ...(
      [
        'reference',
        'argument_parameter',
        'return_call',
        'initializer',
        'field_projection',
        'assignment',
      ] as const
    ).map(
      (relation) =>
        [
          `outbound-remove-${relation}`,
          {
            ...document,
            bindings: bindings.filter(
              (record) => record.kind !== 'java_value_binding' || record.relation !== relation,
            ),
          },
        ] as const,
    ),
    [
      'outbound-remove-calls',
      { ...document, bindings: bindings.filter((record) => record.kind !== 'java_call_binding') },
    ],
    [
      'outbound-remove-schema',
      {
        ...document,
        framework: (document.framework ?? []).filter((record) => record.kind !== 'schema_binding'),
      },
    ],
  ];
  return changed.map(([name, projection]) => ({
    name,
    question: 'outbound',
    rejected: bindingReviewProofs(projection).outbound.supported === false,
  }));
}

function withoutSemanticRelation(document: ScanDocument, relation: string): ScanDocument {
  return {
    ...document,
    semantic: (document.semantic ?? []).filter(
      (record) => record.kind !== 'semantic_edge' || record.relation !== relation,
    ),
  };
}

export function bindingReviewMutations(
  document: ScanDocument,
): readonly (MutationAttempt & { readonly baselineSupported: boolean })[] {
  const baseline = bindingReviewProofs(document);
  return [
    ...exceptionMutations(document),
    ...mongoMutations(document),
    ...outboundMutations(document),
  ].map((attempt) => ({
    ...attempt,
    baselineSupported: baseline[attempt.question].supported === true,
    rejected: baseline[attempt.question].supported === true && attempt.rejected,
  }));
}
