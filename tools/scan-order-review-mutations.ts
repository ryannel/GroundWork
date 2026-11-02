import type { ScanDocument, SemanticEdge } from '@/domain/scan/scan.generated';

import { messageCall, messageMethod } from './scan-message-review-graph';
import { orderQuestionProof } from './scan-order-review';
import { orderBranch, orderMethod } from './scan-order-review-graph';
import { ORDER_VALUE_MUTATIONS } from './scan-order-review-value-mutations';
import { profileGraph } from './scan-profile-review-graph';
import { targets } from './scan-semantic-query';

interface Scenario {
  readonly name: string;
  readonly change: (document: ScanDocument) => void;
}
function detach(
  document: ScanDocument,
  source: string | undefined,
  relation: SemanticEdge['relation'],
): void {
  const graph = profileGraph(document);
  const node = graph.bySource.get(source ?? '');
  const current = document;
  current.semantic = (current.semantic ?? []).filter(
    (record) =>
      record.kind !== 'semantic_edge' || record.from !== node?.id || record.relation !== relation,
  );
}
function changeScalar(document: ScanDocument, recipe: string, ordinal: number): void {
  const graph = profileGraph(document);
  const owner = orderMethod(graph, 'restoreCustomerFromArchive');
  const call = messageCall(graph, owner, recipe);
  const value = targets(graph, call, 'argument')[ordinal];
  for (const record of document.semantic ?? []) {
    if (record.kind === 'semantic_node' && record.id === value?.id) record.value = true;
  }
}
const SCENARIOS: readonly Scenario[] = [
  ...ORDER_VALUE_MUTATIONS,
  {
    name: 'order status collection removed',
    change: (document) => {
      const current = document;
      current.bindings = (current.bindings ?? []).filter(
        (record) => record.kind !== 'java_collection_binding',
      );
    },
  },
  {
    name: 'order status collection member changed',
    change: (document) => {
      for (const record of document.bindings ?? []) {
        if (record.kind === 'java_collection_binding' && record.name === 'VALID_ORDER_STATUSES') {
          const element = record.elements[0];
          if (element) element.value = 'PENDING';
        }
      }
    },
  },
  {
    name: 'order type scalar changed',
    change: (document) => {
      for (const record of document.bindings ?? []) {
        if (record.kind === 'java_constant_binding' && record.name === 'ORDER_TYPE') {
          record.value = 'CHANGE';
        }
      }
    },
  },
  {
    name: 'customer update category changed',
    change: (document) => {
      for (const record of document.bindings ?? []) {
        if (record.kind === 'java_constant_binding' && record.name === 'CUSTOMER_UPDATE_CATEGORY') {
          record.value = 'OrderUpdate';
        }
      }
    },
  },
  {
    name: 'customer update return detached',
    change: (document) => {
      const graph = profileGraph(document);
      const branch = orderBranch(graph, 'consume', 'isCustomerUpdateEvent(event)');
      detach(document, branch?.source, 'consequent');
    },
  },
  {
    name: 'ordinary order predicate detached',
    change: (document) => {
      const graph = profileGraph(document);
      const branch = orderBranch(graph, 'consume', 'isValidOrderEvent(event)');
      detach(document, branch?.source, 'condition');
    },
  },
  {
    name: 'switch reason arm detached',
    change: (document) => {
      const graph = profileGraph(document);
      const owner = orderMethod(graph, 'determineArchiveReason');
      const current = document;
      const sources = new Set(
        graph.nodes.filter((node) => node.owner === owner?.owner).map((node) => node.id),
      );
      current.semantic = (current.semantic ?? []).filter(
        (record) =>
          record.kind !== 'semantic_edge' ||
          record.relation !== 'consequent' ||
          !sources.has(record.from),
      );
    },
  },
  {
    name: 'local customer lexical lineage detached',
    change: (document) => {
      const graph = profileGraph(document);
      const owner = orderMethod(graph, 'unarchiveCustomer');
      const sources = new Set(
        graph.nodes.filter((node) => node.owner === owner?.owner).map((node) => node.source),
      );
      const current = document;
      current.bindings = (current.bindings ?? []).filter(
        (record) =>
          record.kind !== 'java_value_binding' ||
          record.relation !== 'reference' ||
          !sources.has(record.to),
      );
    },
  },
  {
    name: 'typed restoration argument application detached',
    change: (document) => {
      const graph = profileGraph(document);
      const call = messageCall(
        graph,
        orderMethod(graph, 'restoreCustomerFromArchive'),
        'customerArchiveService.restoreCustomerFromArchive(event.customerId(),false)',
      );
      const current = document;
      current.bindings = (current.bindings ?? []).filter(
        (record) =>
          record.kind !== 'java_value_binding' ||
          record.relation !== 'argument_parameter' ||
          !new Set([call?.source]).has(record.call ?? ''),
      );
    },
  },
  {
    name: 'restoration marks customer again',
    change: (document) => {
      changeScalar(
        document,
        'customerArchiveService.restoreCustomerFromArchive(event.customerId(),false)',
        1,
      );
    },
  },
  {
    name: 'catch membership detached',
    change: (document) => {
      const graph = profileGraph(document);
      const owner = orderMethod(graph, 'unarchiveCustomer');
      const sources = new Set(
        graph.nodes.filter((node) => node.owner === owner?.owner).map((node) => node.id),
      );
      const current = document;
      current.semantic = (current.semantic ?? []).filter(
        (record) =>
          record.kind !== 'semantic_edge' ||
          record.relation !== 'catch' ||
          !sources.has(record.from),
      );
    },
  },
  {
    name: 'saved customer assignment detached',
    change: (document) => {
      const graph = profileGraph(document);
      const owner = messageMethod(graph, ['CustomerService', 'saveCustomer']);
      const call = messageCall(graph, owner, 'customerRepository.save(customer)');
      const current = document;
      current.bindings = (current.bindings ?? []).filter(
        (record) =>
          record.kind !== 'java_value_binding' ||
          record.relation !== 'assignment' ||
          record.from !== call?.source,
      );
    },
  },
  {
    name: 'archive restore clearing branch detached',
    change: (document) => {
      const graph = profileGraph(document);
      const owner = messageMethod(graph, [
        'CustomerArchiveService',
        'restoreCustomerFromArchive',
        2,
      ]);
      const sources = new Set(
        graph.nodes.filter((node) => node.owner === owner?.owner).map((node) => node.id),
      );
      const current = document;
      current.semantic = (current.semantic ?? []).filter(
        (record) =>
          record.kind !== 'semantic_edge' ||
          record.relation !== 'otherwise' ||
          !sources.has(record.from),
      );
    },
  },
  {
    name: 'save and archive delete statement order reversed',
    change: (document) => {
      const graph = profileGraph(document);
      const owner = messageMethod(graph, [
        'CustomerArchiveService',
        'restoreCustomerFromArchive',
        2,
      ]);
      const body = targets(graph, owner, 'body')[0];
      for (const record of document.semantic ?? []) {
        if (
          record.kind === 'semantic_edge' &&
          record.from === body?.id &&
          record.relation === 'statement'
        ) {
          record.position = -(record.position ?? 0);
        }
      }
    },
  },
  {
    name: 'consumer nominal mark target detached',
    change: (document) => {
      const graph = profileGraph(document);
      const owner = orderMethod(graph, 'consume');
      for (const record of document.bindings ?? []) {
        if (
          record.kind === 'java_call_binding' &&
          new Set([owner?.source]).has(record.caller ?? '') &&
          record.methodName === 'markForArchival'
        ) {
          record.target = null;
        }
      }
    },
  },
];

export function orderReviewMutations(document: ScanDocument): readonly {
  readonly question: 'q19';
  readonly name: string;
  readonly applied: boolean;
  readonly baselinePassed: boolean;
  readonly rejected: boolean;
}[] {
  const baselinePassed = orderQuestionProof(document).supported;
  return SCENARIOS.map((scenario) => {
    const mutated = structuredClone(document);
    scenario.change(mutated);
    const applied = JSON.stringify(mutated) !== JSON.stringify(document);
    return {
      question: 'q19',
      name: scenario.name,
      applied,
      baselinePassed,
      rejected: applied && baselinePassed && !orderQuestionProof(mutated).supported,
    };
  });
}
