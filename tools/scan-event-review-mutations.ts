import type { ScanDocument } from '@/domain/scan/scan.generated';

import { eventQuestionProofs } from './scan-event-review';
import { profileGraph, profileMethod } from './scan-profile-review-graph';
import { individualRecipe } from './scan-profile-review-individual-atoms';
import { descendants, targets } from './scan-semantic-query';

type Question = 'q15' | 'q16';
interface Scenario {
  readonly name: string;
  readonly question: Question;
  readonly change: (document: ScanDocument) => void;
}
function moveSendBeforeGuards(document: ScanDocument): void {
  const graph = profileGraph(document);
  const owner = profileMethod(graph, 'MarketingConsentEventService', 'publishEvent')[0];
  const statements = targets(graph, targets(graph, owner, 'body')[0], 'statement');
  const send = statements.find(
    (node) =>
      individualRecipe(graph, node) === 'kafkaEventPublisher.sendSafely(kafkaTemplate,message)',
  );
  for (const edge of document.semantic ?? []) {
    if (edge.kind === 'semantic_edge' && edge.relation === 'statement' && edge.to === send?.id) {
      edge.position = -1;
    }
  }
}
function moveEventBeforeGuards(document: ScanDocument): void {
  const graph = profileGraph(document);
  const owner = profileMethod(graph, 'MarketingConsentEventService', 'publishEvent')[0];
  const statements = targets(graph, targets(graph, owner, 'body')[0], 'statement');
  const event = statements.find((statement) =>
    descendants(graph, statement).some(
      (node) =>
        node.nodeKind === 'call' &&
        targets(graph, node, 'callee').some((callee) => callee.name === 'buildPayload'),
    ),
  );
  for (const edge of document.semantic ?? []) {
    if (edge.kind === 'semantic_edge' && edge.relation === 'statement' && edge.to === event?.id) {
      edge.position = -1;
    }
  }
}
function removePostprocessorLinks(
  document: ScanDocument,
  relation: 'reference' | 'argument_parameter',
): void {
  const graph = profileGraph(document);
  const post = profileMethod(graph, 'CustomerSavePostProcessor', 'postProcess')[0];
  const parameters = new Set(
    targets(graph, post, 'parameter').map((parameter) => parameter.source),
  );
  const calls = new Set(
    graph.calls
      .filter((call) => new Set([post?.source]).has(call.caller ?? ''))
      .map((call) => call.call),
  );
  const current = document;
  current.bindings = (current.bindings ?? []).filter((record) => {
    if (record.kind !== 'java_value_binding' || record.relation !== relation) return true;
    return relation === 'reference' ? !parameters.has(record.from) : !calls.has(record.call ?? '');
  });
}
const SCENARIOS: readonly Scenario[] = [
  {
    name: 'postprocessor parameter references',
    question: 'q15',
    change: (document) => {
      removePostprocessorLinks(document, 'reference');
    },
  },
  {
    name: 'postprocessor collaborator argument lineage',
    question: 'q15',
    change: (document) => {
      removePostprocessorLinks(document, 'argument_parameter');
    },
  },
  {
    name: 'saved result reaching value',
    question: 'q15',
    change: (input) => {
      const document = input;
      document.semantic = (document.semantic ?? []).filter(
        (record) => record.kind !== 'semantic_edge' || record.relation !== 'reaching_value',
      );
    },
  },
  {
    name: 'saved result assigned value',
    question: 'q15',
    change: (input) => {
      const document = input;
      document.semantic = (document.semantic ?? []).filter(
        (record) => record.kind !== 'semantic_edge' || record.relation !== 'assigned_value',
      );
    },
  },
  { name: 'consent construction precedes guards', question: 'q16', change: moveEventBeforeGuards },
  { name: 'consent send precedes guards', question: 'q16', change: moveSendBeforeGuards },
  {
    name: 'consent candidate helper lineage',
    question: 'q16',
    change: (input) => {
      for (const record of input.bindings ?? []) {
        if (record.kind === 'event_binding') record.candidate_helpers = [];
      }
    },
  },
  {
    name: 'consent payload builder application',
    question: 'q16',
    change: (input) => {
      for (const record of input.bindings ?? []) {
        if (record.kind === 'event_binding') record.builder_calls = [];
      }
    },
  },
  {
    name: 'consent comparison operands',
    question: 'q16',
    change: (input) => {
      for (const record of input.bindings ?? []) {
        if (record.kind !== 'event_binding') continue;
        for (const comparison of record.comparisons) comparison.operand_sources = [];
      }
    },
  },
  {
    name: 'consent declared field lineage',
    question: 'q16',
    change: (input) => {
      for (const record of input.bindings ?? []) {
        if (record.kind !== 'event_binding') continue;
        for (const construction of record.constructions) {
          for (const field of construction.fields) field.field_source = record.source;
        }
      }
    },
  },
  {
    name: 'consent guard operand',
    question: 'q16',
    change: (input) => {
      const document = input;
      for (const node of document.semantic ?? []) {
        if (node.kind === 'semantic_node' && node.operator === '||') node.operator = '&&';
      }
    },
  },
  {
    name: 'consent control exits',
    question: 'q16',
    change: (input) => {
      const document = input;
      document.semantic = (document.semantic ?? []).filter(
        (record) => record.kind !== 'semantic_edge' || record.relation !== 'consequent',
      );
    },
  },
  {
    name: 'consent lexical lineage',
    question: 'q16',
    change: (input) => {
      const document = input;
      document.bindings = (document.bindings ?? []).filter(
        (record) => record.kind !== 'java_value_binding' || record.relation !== 'reference',
      );
    },
  },
  {
    name: 'consent native payload mapping',
    question: 'q16',
    change: (input) => {
      const document = input;
      for (const record of document.bindings ?? []) {
        if (record.kind !== 'event_binding') continue;
        for (const construction of record.constructions) construction.fields = [];
      }
    },
  },
  {
    name: 'consent native send arguments',
    question: 'q16',
    change: (input) => {
      const document = input;
      for (const record of document.bindings ?? []) {
        if (record.kind === 'event_binding' && record.operation === 'sendSafely') {
          record.arguments = [];
        }
      }
    },
  },
  {
    name: 'postprocessor statement order',
    question: 'q15',
    change: (input) => {
      const document = input;
      for (const edge of document.semantic ?? []) {
        if (edge.kind === 'semantic_edge' && edge.relation === 'statement') {
          edge.position = -(edge.position ?? 0);
        }
      }
    },
  },
  {
    name: 'saved return assignment',
    question: 'q15',
    change: (input) => {
      const document = input;
      document.bindings = (document.bindings ?? []).filter(
        (record) => record.kind !== 'java_value_binding' || record.relation !== 'assignment',
      );
    },
  },
  {
    name: 'analytics callback attachment',
    question: 'q15',
    change: (input) => {
      const document = input;
      document.semantic = (document.semantic ?? []).filter(
        (record) => record.kind !== 'semantic_edge' || record.relation !== 'callback',
      );
    },
  },
  {
    name: 'transaction boundary changed',
    question: 'q15',
    change: (input) => {
      const document = input;
      for (const record of document.bindings ?? []) {
        if (record.kind === 'execution_binding') record.transaction = 'declared_runtime_unverified';
      }
    },
  },
  {
    name: 'caller waits for async result',
    question: 'q15',
    change: (input) => {
      const document = input;
      for (const record of document.bindings ?? []) {
        if (record.kind !== 'async_binding') continue;
        for (const invocation of record.invocations) invocation.use = 'joined';
      }
    },
  },
  {
    name: 'audit returned-value observation',
    question: 'q15',
    change: (input) => {
      const document = input;
      for (const record of document.bindings ?? []) {
        if (record.kind !== 'execution_binding') continue;
        for (const result of record.call_results) result.use = 'joined';
      }
    },
  },
  {
    name: 'publication arguments removed',
    question: 'q15',
    change: (input) => {
      const document = input;
      for (const record of document.bindings ?? []) {
        if (record.kind === 'event_binding') record.arguments = [];
      }
    },
  },
];

/** Count only applied destructive mutations of a fully passing frozen whole-question baseline. */
export function eventReviewMutations(document: ScanDocument): readonly {
  readonly name: string;
  readonly question: Question;
  readonly applied: boolean;
  readonly baselinePassed: boolean;
  readonly rejected: boolean;
}[] {
  const baseline = eventQuestionProofs(document);
  return SCENARIOS.map((scenario) => {
    const mutated = structuredClone(document);
    scenario.change(mutated);
    const applied = JSON.stringify(mutated) !== JSON.stringify(document);
    const baselinePassed = baseline[scenario.question].supported;
    return {
      name: scenario.name,
      question: scenario.question,
      applied,
      baselinePassed,
      rejected:
        applied && baselinePassed && !eventQuestionProofs(mutated)[scenario.question].supported,
    };
  });
}
