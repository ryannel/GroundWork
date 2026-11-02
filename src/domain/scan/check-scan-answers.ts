import { scanReference, type ScanRecordKind, type ScanRecords } from './scan-records';
import type {
  Answer,
  Concern,
  Obligation,
  QuestionReceipt,
  ScanDocument,
  SupportedValue,
} from './scan.generated';

export const endpointConcerns: readonly Concern[] = [
  'control',
  'inputs',
  'outputs',
  'calls',
  'storage',
  'failures',
  'asynchronous',
  'freshness',
];
export const actionConcerns: readonly Concern[] = [
  ...endpointConcerns,
  'controls',
  'actor_conditions',
  'visible_outcomes',
  'execution_mapping',
];
const concernKinds = {
  control: ['control', 'summary'],
  inputs: ['contract'],
  outputs: ['contract'],
  calls: ['call', 'summary'],
  storage: ['effect'],
  failures: ['throw', 'outcome', 'return'],
  asynchronous: ['call', 'await'],
  controls: ['control_binding'],
  actor_conditions: ['actor_constraint'],
  visible_outcomes: ['outcome'],
  execution_mapping: ['execution'],
  freshness: ['source'],
} satisfies Record<Concern, readonly ScanRecordKind[]>;

interface AnswerScope {
  readonly owner: string;
  readonly kinds: readonly ScanRecordKind[];
  readonly obligationId?: string;
}
export interface CheckContext {
  readonly document: ScanDocument;
  readonly records: ScanRecords;
}

export function referencesFor(
  records: ScanRecords,
): (ids: readonly string[], kinds: readonly ScanRecordKind[], owner: string) => string[] {
  return (ids: readonly string[], kinds: readonly ScanRecordKind[], owner: string): string[] =>
    ids.flatMap((id) =>
      kinds.some((kind) => scanReference(records, id, kind) !== undefined)
        ? []
        : [`${owner}: ${id} must reference ${kinds.join('/')}`],
    );
}

function closureErrors(value: SupportedValue, scope: AnswerScope, context: CheckContext): string[] {
  if (value.value.length > 0) return [];
  const closure = context.document.closures.find((entry) => entry.id === value.closure);
  const obligation = context.document.obligations.find((item) => item.id === scope.obligationId);
  const expectedScope = obligation?.scope ?? scope.owner;
  if (
    closure?.complete !== true ||
    closure.searches.length === 0 ||
    closure.containingScope !== expectedScope
  ) {
    return [`${scope.owner}: known absence requires a complete search closure for this scope`];
  }
  return closure.searches.flatMap((id) => {
    const search = context.records.get(id);
    return search?.kind === 'search' && search.complete && search.scope === expectedScope
      ? []
      : [`${scope.owner}: known absence requires a complete scoped search receipt`];
  });
}

function supportedErrors(
  value: SupportedValue,
  scope: AnswerScope,
  context: CheckContext,
): string[] {
  const references = referencesFor(context.records);
  return [
    ...references(value.support, ['source', 'derivation'], scope.owner),
    ...references(value.value, scope.kinds, scope.owner),
    ...closureErrors(value, scope, context),
  ];
}

function inapplicableErrors(
  answer: Extract<Answer, { readonly state: 'not_applicable' }>,
  scope: AnswerScope,
  context: CheckContext,
): string[] {
  const obligation = context.document.obligations.find((item) => item.id === scope.obligationId);
  const rule = context.document.rules.find((item) => item.id === answer.rule);
  if (rule?.applicability !== 'inapplicable' || obligation === undefined) {
    return [`${scope.owner}: unsupported inapplicability rule`];
  }
  if (
    !rule.concerns.includes(obligation.concern) ||
    !obligation.allowedInapplicabilityRules.includes(rule.id)
  ) {
    return [`${scope.owner}: unsupported inapplicability rule`];
  }
  return referencesFor(context.records)(answer.support, ['source', 'derivation'], scope.owner);
}

export function answerErrors(answer: Answer, scope: AnswerScope, context: CheckContext): string[] {
  if (answer.state === 'supported') return supportedErrors(answer, scope, context);
  if (answer.state === 'conflicting') {
    return answer.alternatives.flatMap((value) => supportedErrors(value, scope, context));
  }
  const references = referencesFor(context.records);
  if (answer.state === 'unresolved') return references([answer.gap], ['gap'], scope.owner);
  if (answer.state === 'not_applicable') return inapplicableErrors(answer, scope, context);
  const errors = references([answer.obligation], ['obligation'], scope.owner);
  if (scope.obligationId !== undefined && answer.obligation !== scope.obligationId) {
    errors.push(`${scope.owner}: unexamined answer names another obligation`);
  }
  return errors;
}

function obligationErrors(
  obligation: Obligation,
  receipt: QuestionReceipt,
  context: CheckContext,
): string[] {
  const errors: string[] = [];
  if (obligation.scope !== receipt.scope || obligation.profile !== receipt.profile) {
    errors.push(`${receipt.id}: obligation scope/profile mismatch`);
  }
  const answers = receipt.answers.filter((item) => item.obligation === obligation.id);
  if (answers.length !== 1) {
    errors.push(`${receipt.id}: missing or duplicate answer ${obligation.id}`);
  }
  for (const { answer } of answers) {
    errors.push(
      ...answerErrors(
        answer,
        { owner: receipt.id, kinds: concernKinds[obligation.concern], obligationId: obligation.id },
        context,
      ),
    );
  }
  return errors;
}

export function receiptErrors(document: ScanDocument, records: ScanRecords): string[] {
  return document.receipts.flatMap((receipt) => {
    const required = receipt.profile === 'endpoint' ? endpointConcerns : actionConcerns;
    const obligations = document.obligations.filter((item) =>
      receipt.obligations.includes(item.id),
    );
    const errors = [
      ...required
        .filter((concern) => !obligations.some((item) => item.concern === concern))
        .map((concern) => `${receipt.id}: missing obligation ${concern}`),
      ...referencesFor(records)(receipt.obligations, ['obligation'], receipt.id),
      ...obligations.flatMap((obligation) =>
        obligationErrors(obligation, receipt, { document, records }),
      ),
    ];
    for (const answer of receipt.answers) {
      if (!receipt.obligations.includes(answer.obligation)) {
        errors.push(`${receipt.id}: undeclared answer`);
      }
    }
    return errors;
  });
}
