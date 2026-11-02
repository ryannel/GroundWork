import type { ScanDocument } from '@/domain/scan/scan.generated';

import { messageMethod } from './scan-message-review-graph';
import { profileGraph } from './scan-profile-review-graph';
import { descendants, targets } from './scan-semantic-query';

type Question = 'q17' | 'q18';
interface Mutation {
  readonly name: string;
  readonly question: Question;
  readonly change: (document: ScanDocument) => void;
}

function removeValue(document: ScanDocument, relation: string): void {
  const current = document;
  current.bindings = (current.bindings ?? []).filter(
    (record) => record.kind !== 'java_value_binding' || record.relation !== relation,
  );
}
function removeEdge(document: ScanDocument, relation: string): void {
  const current = document;
  current.semantic = (current.semantic ?? []).filter(
    (record) => record.kind !== 'semantic_edge' || record.relation !== relation,
  );
}
function earlySend(document: ScanDocument): void {
  const graph = profileGraph(document);
  const owner = messageMethod(graph, ['CustomerEventService', 'publishCustomerEvent']);
  const statements = targets(graph, targets(graph, owner, 'body')[0], 'statement');
  const send = statements.find((node) =>
    descendants(graph, node).some(
      (child) =>
        child.nodeKind === 'call' && targets(graph, child, 'callee')[0]?.name === 'sendSafely',
    ),
  );
  for (const edge of document.semantic ?? []) {
    if (edge.kind === 'semantic_edge' && edge.relation === 'statement' && edge.to === send?.id) {
      edge.position = -1;
    }
  }
}
export const MESSAGE_MUTATIONS: readonly Mutation[] = [
  {
    name: 'producer activation condition detached',
    question: 'q17',
    change: (document: ScanDocument): void => {
      for (const record of document.bindings ?? []) {
        if (record.kind === 'configuration_binding') record.conditions = [];
      }
    },
  },
  {
    name: 'consumer activation condition detached',
    question: 'q18',
    change: (document: ScanDocument): void => {
      for (const record of document.bindings ?? []) {
        if (record.kind === 'consumer_binding') record.conditions = [];
      }
    },
  },
  {
    name: 'event branch condition detached',
    question: 'q17',
    change: (document: ScanDocument): void => {
      removeEdge(document, 'condition');
    },
  },
  {
    name: 'event branch alternative detached',
    question: 'q17',
    change: (document: ScanDocument): void => {
      removeEdge(document, 'otherwise');
    },
  },
  {
    name: 'event branch enum value changed',
    question: 'q17',
    change: (document: ScanDocument): void => {
      for (const node of document.semantic ?? []) {
        if (
          node.kind === 'semantic_node' &&
          node.nodeKind === 'member' &&
          node.name === 'CUSTOMER_ARCHIVED'
        ) {
          node.name = 'CUSTOMER_UPDATED';
        }
      }
    },
  },
  {
    name: 'enum JSON value changed',
    question: 'q17',
    change: (document: ScanDocument): void => {
      for (const record of document.bindings ?? []) {
        if (record.kind !== 'enum_binding') continue;
        for (const constant of record.constants) {
          if (constant.name === 'DELETED') constant.declared_json_name = 'updated';
        }
      }
    },
  },
  {
    name: 'mapper nested type replaced',
    question: 'q17',
    change: (document: ScanDocument): void => {
      for (const record of document.framework ?? []) {
        if (record.kind !== 'schema_binding' || !record.typeName.endsWith('.AnalyticsCustomer')) {
          continue;
        }
        for (const property of record.properties) {
          if (property.name === 'individuals') property.type = 'List<AnalyticsCorporateEntity>';
        }
      }
    },
  },
  {
    name: 'mapper callback detached',
    question: 'q17',
    change: (document: ScanDocument): void => {
      removeEdge(document, 'callback');
    },
  },
  {
    name: 'event/formal lexical references detached',
    question: 'q17',
    change: (document: ScanDocument): void => {
      removeValue(document, 'reference');
    },
  },
  {
    name: 'event helper ordinal parameter detached',
    question: 'q17',
    change: (document: ScanDocument): void => {
      removeValue(document, 'argument_parameter');
    },
  },
  {
    name: 'customer payload ordinal detached',
    question: 'q17',
    change: (document: ScanDocument): void => {
      removeEdge(document, 'argument');
    },
  },
  { name: 'publication attempted before guard', question: 'q17', change: earlySend },
  {
    name: 'publication message binding arguments detached',
    question: 'q17',
    change: (document: ScanDocument): void => {
      for (const record of document.bindings ?? []) {
        if (record.kind === 'event_binding') record.arguments = [];
      }
    },
  },
  {
    name: 'topic settings selector detached',
    question: 'q17',
    change: (document: ScanDocument): void => {
      for (const record of document.bindings ?? []) {
        if (record.kind === 'configuration_binding') record.selectors = [];
      }
    },
  },
  {
    name: 'declared topic scalar changed',
    question: 'q17',
    change: (document: ScanDocument): void => {
      for (const record of document.bindings ?? []) {
        if (record.kind !== 'configuration_binding') continue;
        for (const property of record.properties) {
          if (property.key === 'kafka.customer-event.topic-name') property.value = 'wrong-topic';
        }
      }
    },
  },
  {
    name: 'subscription topic changed',
    question: 'q18',
    change: (document: ScanDocument): void => {
      for (const record of document.bindings ?? []) {
        if (record.kind !== 'consumer_binding') continue;
        for (const selector of record.selectors) {
          if (selector.role === 'topics') selector.literal = 'wrong-topic';
        }
      }
    },
  },
  {
    name: 'subscription container detached',
    question: 'q18',
    change: (document: ScanDocument): void => {
      for (const record of document.bindings ?? []) {
        if (record.kind === 'consumer_binding') record.factory_candidates = [];
      }
    },
  },
  {
    name: 'deserialiser target type changed',
    question: 'q18',
    change: (document: ScanDocument): void => {
      for (const record of document.bindings ?? []) {
        if (record.kind !== 'consumer_binding') continue;
        for (const operation of record.deserialisations) operation.return_type = 'java.lang.String';
      }
    },
  },
  {
    name: 'deserialiser type reference detached',
    question: 'q18',
    change: (document: ScanDocument): void => {
      for (const record of document.bindings ?? []) {
        if (record.kind !== 'consumer_binding') continue;
        for (const operation of record.deserialisations) operation.type_reference_sources = [];
      }
    },
  },
  {
    name: 'consumer payload field type replaced',
    question: 'q18',
    change: (document: ScanDocument): void => {
      for (const record of document.framework ?? []) {
        if (
          record.kind !== 'schema_binding' ||
          !record.typeName.endsWith('.DeleteCustomerEventPayload')
        ) {
          continue;
        }
        for (const property of record.properties) property.type = 'Integer';
      }
    },
  },
  {
    name: 'customer ID propagation changed',
    question: 'q18',
    change: (document: ScanDocument): void => {
      for (const node of document.semantic ?? []) {
        if (
          node.kind === 'semantic_node' &&
          node.nodeKind === 'member' &&
          node.name === 'customerId'
        ) {
          node.name = 'id';
        }
      }
    },
  },
  {
    name: 'consumer formal references detached',
    question: 'q18',
    change: (document: ScanDocument): void => {
      removeValue(document, 'reference');
    },
  },
  {
    name: 'consumer ordinal arguments detached',
    question: 'q18',
    change: (document: ScanDocument): void => {
      removeValue(document, 'argument_parameter');
    },
  },
  {
    name: 'candidate deletion formal detached',
    question: 'q18',
    change: (document: ScanDocument): void => {
      for (const record of document.bindings ?? []) {
        if (record.kind !== 'consumer_binding') continue;
        for (const candidate of record.candidate_helpers) candidate.parameter_sources = [];
      }
    },
  },
  {
    name: 'delete operation detached',
    question: 'q18',
    change: (document: ScanDocument): void => {
      const current = document;
      current.bindings = (current.bindings ?? []).filter(
        (record) => record.kind !== 'mongo_operation_binding',
      );
    },
  },
  {
    name: 'exception handler body detached',
    question: 'q18',
    change: (document: ScanDocument): void => {
      removeEdge(document, 'catch');
    },
  },
  {
    name: 'deserialisation failure throw detached',
    question: 'q18',
    change: (document: ScanDocument): void => {
      for (const record of document.bindings ?? []) {
        if (record.kind === 'consumer_binding') record.throw_sources = [];
      }
    },
  },
];
