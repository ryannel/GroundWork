import type { ScanDocument, SemanticEdge } from '@/domain/scan/scan.generated';

import { messageMethod } from './scan-message-review-graph';
import { orderBranch, orderMethod } from './scan-order-review-graph';
import { profileGraph } from './scan-profile-review-graph';
import { targets } from './scan-semantic-query';

function removeRelation(
  document: ScanDocument,
  method: readonly [string, string],
  relation: SemanticEdge['relation'],
): void {
  const graph = profileGraph(document);
  const owner = messageMethod(graph, method);
  const nodes = new Set(
    graph.nodes.filter((node) => node.owner === owner?.owner).map((node) => node.id),
  );
  const current = document;
  current.semantic = (current.semantic ?? []).filter(
    (record) =>
      record.kind !== 'semantic_edge' || record.relation !== relation || !nodes.has(record.from),
  );
}

export const ORDER_VALUE_MUTATIONS: readonly {
  readonly name: string;
  readonly change: (document: ScanDocument) => void;
}[] = [
  {
    name: 'live unarchive assigned builder value detached',
    change: (document: ScanDocument): void => {
      removeRelation(document, ['OrderUpdateEventConsumer', 'unarchiveCustomer'], 'assigned_value');
    },
  },
  {
    name: 'live unarchive reaching builder value detached',
    change: (document: ScanDocument): void => {
      removeRelation(document, ['OrderUpdateEventConsumer', 'unarchiveCustomer'], 'reaching_value');
    },
  },
  {
    name: 'saved return reaching value detached',
    change: (document: ScanDocument): void => {
      removeRelation(document, ['CustomerService', 'saveCustomer'], 'reaching_value');
    },
  },
  {
    name: 'archive lookup missing callback detached',
    change: (document: ScanDocument): void => {
      removeRelation(
        document,
        ['CustomerArchiveService', 'restoreCustomerFromArchive'],
        'callback',
      );
    },
  },
  {
    name: 'customer update returns before restoring',
    change: (document: ScanDocument): void => {
      const graph = profileGraph(document);
      const branch = orderBranch(graph, 'consume', 'isCustomerUpdateEvent(event)');
      const body = targets(graph, branch, 'consequent')[0];
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
    name: 'computed reason loses initializer application',
    change: (document: ScanDocument): void => {
      const graph = profileGraph(document);
      const owner = orderMethod(graph, 'consume');
      const declaration = graph.nodes.find(
        (node) =>
          node.owner === owner?.owner &&
          node.nodeKind === 'declaration' &&
          node.name === 'archiveReason',
      );
      const current = document;
      current.bindings = (current.bindings ?? []).filter(
        (record) =>
          record.kind !== 'java_value_binding' ||
          record.relation !== 'initializer' ||
          record.to !== declaration?.source,
      );
    },
  },
];
