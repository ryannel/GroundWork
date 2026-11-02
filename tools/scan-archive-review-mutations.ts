import type { ScanDocument, SemanticEdge } from '@/domain/scan/scan.generated';

import { archiveQuestionProof } from './scan-archive-review';

interface Scenario {
  readonly name: string;
  readonly change: (document: ScanDocument) => void;
}
function removeRelation(document: ScanDocument, relation: SemanticEdge['relation']): void {
  const selected = document;
  selected.semantic = (selected.semantic ?? []).filter(
    (entry) => entry.kind !== 'semantic_edge' || entry.relation !== relation,
  );
}
const SCENARIOS: readonly Scenario[] = [
  ...(
    ['body', 'statement', 'catch', 'callback', 'argument', 'parameter', 'declared_type'] as const
  ).map((relation) => ({
    name: `archive typed ${relation} relation`,
    change: (document: ScanDocument) => {
      removeRelation(document, relation);
    },
  })),
  {
    name: 'archive lexical references',
    change: (document) => {
      const selected = document;
      selected.bindings = (selected.bindings ?? []).filter(
        (entry) => entry.kind !== 'java_value_binding' || entry.relation !== 'reference',
      );
    },
  },
  {
    name: 'archive actual formal applications',
    change: (document) => {
      const selected = document;
      selected.bindings = (selected.bindings ?? []).filter(
        (entry) => entry.kind !== 'java_value_binding' || entry.relation !== 'argument_parameter',
      );
    },
  },
  {
    name: 'archive schedule annotation arguments',
    change: (document) => {
      for (const entry of document.bindings ?? []) {
        if (entry.kind === 'schedule_binding') entry.annotations = [];
      }
    },
  },
  {
    name: 'archive schedule enablement',
    change: (document) => {
      for (const entry of document.bindings ?? []) {
        if (entry.kind === 'schedule_binding') entry.conditions = [];
      }
    },
  },
  {
    name: 'archive scheduling and locking activation',
    change: (document) => {
      for (const entry of document.bindings ?? []) {
        if (entry.kind === 'schedule_binding') entry.activation_declarations = [];
      }
    },
  },
  {
    name: 'archive provider candidate',
    change: (document) => {
      for (const entry of document.bindings ?? []) {
        if (entry.kind === 'schedule_binding') entry.lock_provider_sources = [];
      }
    },
  },
  {
    name: 'archive async dispatch scope',
    change: (document) => {
      for (const entry of document.bindings ?? []) {
        if (entry.kind === 'schedule_binding') entry.async_invocations = [];
      }
    },
  },
  {
    name: 'archive async activation',
    change: (document) => {
      for (const entry of document.bindings ?? []) {
        if (entry.kind === 'async_binding') entry.activation_sources = [];
      }
    },
  },
  {
    name: 'archive async job condition',
    change: (document) => {
      for (const entry of document.bindings ?? []) {
        if (entry.kind === 'async_binding') entry.conditions = [];
      }
    },
  },
  {
    name: 'archive async executor binding',
    change: (document) => {
      for (const entry of document.bindings ?? []) {
        if (entry.kind === 'async_binding') entry.executor_sources = [];
      }
    },
  },
  {
    name: 'archive configured base values',
    change: (document) => {
      const entries = (document.bindings ?? []).filter(
        (entry) => entry.kind === 'configuration_binding',
      );
      for (const property of entries.flatMap((entry) => entry.properties)) {
        if (property.key.startsWith('customer-archive.')) property.value = null;
      }
    },
  },
  {
    name: 'archive pool bound changed',
    change: (document) => {
      for (const entry of document.semantic ?? []) {
        if (entry.kind === 'semantic_node' && entry.nodeKind === 'literal' && entry.value === 1) {
          entry.value = 2;
        }
      }
    },
  },
  {
    name: 'archive ordered operations reversed',
    change: (document) => {
      for (const entry of document.semantic ?? []) {
        if (entry.kind === 'semantic_edge' && entry.relation === 'statement') {
          entry.position = -(entry.position ?? 0);
        }
      }
    },
  },
  {
    name: 'archive statistics increment removed',
    change: (document) => {
      for (const entry of document.semantic ?? []) {
        if (
          entry.kind === 'semantic_node' &&
          entry.nodeKind === 'unary' &&
          entry.operator === '++'
        ) {
          entry.operator = '--';
        }
      }
    },
  },
  {
    name: 'archive statistics counter exchanged',
    change: (document) => {
      for (const entry of document.semantic ?? []) {
        if (
          entry.kind === 'semantic_node' &&
          entry.nodeKind === 'identifier' &&
          entry.name === 'numberOfFailed'
        ) {
          entry.name = 'numberOfArchived';
        }
      }
    },
  },
];

/** Count only applied destructive mutations of a passing whole-question baseline. */
export function archiveReviewMutations(document: ScanDocument): readonly {
  readonly name: string;
  readonly question: 'q20';
  readonly applied: boolean;
  readonly baselinePassed: boolean;
  readonly rejected: boolean;
}[] {
  const baselinePassed = archiveQuestionProof(document).supported;
  const original = JSON.stringify(document);
  return SCENARIOS.map((scenario) => {
    const changed = structuredClone(document);
    scenario.change(changed);
    const applied = original !== JSON.stringify(changed);
    return {
      name: scenario.name,
      question: 'q20',
      applied,
      baselinePassed,
      rejected: applied && baselinePassed && !archiveQuestionProof(changed).supported,
    };
  });
}
