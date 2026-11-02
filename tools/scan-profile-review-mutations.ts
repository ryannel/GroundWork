import type { ScanDocument } from '@/domain/scan/scan.generated';

import { profileGraphqlBoundaries } from './scan-profile-review-graphql';
import { profileFleetBoundaries } from './scan-profile-review-rest';

interface Mutation {
  readonly name: string;
  readonly baselinePassed: boolean;
  readonly rejected: boolean;
}
interface Scenario {
  readonly name: string;
  readonly proof: 'fleet' | 'graphql';
  readonly clause: string;
  readonly change: (document: ScanDocument) => void;
}
function proofs(document: ScanDocument) {
  return { fleet: profileFleetBoundaries(document), graphql: profileGraphqlBoundaries(document) };
}

const SCENARIOS: readonly Scenario[] = [
  {
    name: 'HTTP method',
    proof: 'fleet',
    clause: 'method',
    change: (input) => {
      const document = input;
      for (const record of document.bindings ?? []) {
        if (record.kind === 'outbound_binding') record.request.method = 'POST';
      }
    },
  },
  {
    name: 'URI template',
    proof: 'fleet',
    clause: 'template',
    change: (input) => {
      const document = input;
      for (const record of document.bindings ?? []) {
        if (record.kind === 'outbound_binding') record.request.template = '/wrong';
      }
    },
  },
  {
    name: 'REST receiver chain',
    proof: 'fleet',
    clause: 'chain',
    change: (input) => {
      const document = input;
      document.semantic = (document.semantic ?? []).filter(
        (record) => record.kind !== 'semantic_edge' || record.relation !== 'receiver',
      );
    },
  },
  {
    name: 'Registry assignment',
    proof: 'fleet',
    clause: 'logicalClient',
    change: (input) => {
      const document = input;
      document.bindings = (document.bindings ?? []).filter(
        (record) => record.kind !== 'java_value_binding' || record.relation !== 'assignment',
      );
    },
  },
  {
    name: 'URI input reference',
    proof: 'fleet',
    clause: 'input',
    change: (input) => {
      const document = input;
      document.bindings = (document.bindings ?? []).filter(
        (record) => record.kind !== 'java_value_binding' || record.relation !== 'reference',
      );
    },
  },
  {
    name: 'Response field projection',
    proof: 'fleet',
    clause: 'response',
    change: (input) => {
      const document = input;
      document.bindings = (document.bindings ?? []).filter(
        (record) => record.kind !== 'java_value_binding' || record.relation !== 'field_projection',
      );
    },
  },
  {
    name: 'Response helper argument',
    proof: 'fleet',
    clause: 'response',
    change: (input) => {
      const document = input;
      document.bindings = (document.bindings ?? []).filter(
        (record) =>
          record.kind !== 'java_value_binding' || record.relation !== 'argument_parameter',
      );
    },
  },
  {
    name: 'Response helper return',
    proof: 'fleet',
    clause: 'response',
    change: (input) => {
      const document = input;
      document.bindings = (document.bindings ?? []).filter(
        (record) => record.kind !== 'java_value_binding' || record.relation !== 'return_call',
      );
    },
  },
  {
    name: 'Exception thrown value',
    proof: 'fleet',
    clause: 'failures',
    change: (input) => {
      const document = input;
      document.semantic = (document.semantic ?? []).filter(
        (record) => record.kind !== 'semantic_edge' || record.relation !== 'value',
      );
    },
  },
  {
    name: 'GraphQL client identity',
    proof: 'graphql',
    clause: 'logicalClient',
    change: (input) => {
      const document = input;
      for (const record of document.bindings ?? []) {
        if (record.kind === 'graphql_binding') record.client.logical_name = 'unrelated';
      }
    },
  },
  {
    name: 'GraphQL receiver chain',
    proof: 'graphql',
    clause: 'requestChain',
    change: (input) => {
      const document = input;
      document.semantic = (document.semantic ?? []).filter(
        (record) => record.kind !== 'semantic_edge' || record.relation !== 'receiver',
      );
    },
  },
  {
    name: 'GraphQL parsed constant',
    proof: 'graphql',
    clause: 'requestAtoms',
    change: (input) => {
      const document = input;
      for (const record of document.bindings ?? []) {
        if (record.kind === 'java_constant_binding') record.value = 'wrong';
      }
    },
  },
  {
    name: 'GraphQL variable lineage',
    proof: 'graphql',
    clause: 'variableInput',
    change: (input) => {
      const document = input;
      document.bindings = (document.bindings ?? []).filter(
        (record) => record.kind !== 'java_value_binding' || record.relation !== 'reference',
      );
    },
  },
  {
    name: 'GraphQL document selection',
    proof: 'graphql',
    clause: 'documentContract',
    change: (input) => {
      const document = input;
      for (const record of document.bindings ?? []) {
        if (record.kind === 'graphql_document_binding') record.selections = [];
      }
    },
  },
  {
    name: 'GraphQL document variable',
    proof: 'graphql',
    clause: 'documentContract',
    change: (input) => {
      const document = input;
      for (const record of document.bindings ?? []) {
        if (record.kind === 'graphql_document_binding') record.variables = [];
      }
    },
  },
  {
    name: 'GraphQL result type',
    proof: 'graphql',
    clause: 'resultType',
    change: (input) => {
      const document = input;
      for (const record of document.bindings ?? []) {
        if (record.kind === 'graphql_binding') record.response.type = 'unrelated.Response';
      }
    },
  },
  {
    name: 'GraphQL response field',
    proof: 'graphql',
    clause: 'resultField',
    change: (input) => {
      const document = input;
      for (const record of document.bindings ?? []) {
        if (record.kind === 'graphql_binding') record.response.field_path = 'unrelated';
      }
    },
  },
];

/** A rejected mutation is counted only after that exact baseline clause succeeds. */
export function profileReviewMutations(document: ScanDocument): readonly Mutation[] {
  const original = proofs(document);
  return SCENARIOS.flatMap((scenario) => {
    const mutated = structuredClone(document);
    scenario.change(mutated);
    const changed = proofs(mutated);
    return Object.entries(original[scenario.proof]).map(([path, clauses]) => {
      const baselinePassed = clauses.supported === true && clauses[scenario.clause] === true;
      return {
        name: `${path}: ${scenario.name}`,
        baselinePassed,
        rejected: baselinePassed && changed[scenario.proof][path]?.[scenario.clause] === false,
      };
    });
  });
}
