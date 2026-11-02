import { describe, expect, it } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';

import { validateScanDocument } from './check-scan';
import type {
  GraphqlBinding,
  GraphqlDocumentBinding,
  JavaConstantBinding,
  LibraryBinding,
} from './scan.generated';

function fixture() {
  const document = scanFixture();
  const template = document.sources[0]!;
  const sources = [
    ['owner', 'Client.java', 1, 20],
    ['call', 'Client.java', 2, 2],
    ['argument', 'Client.java', 2, 2],
    ['receiver', 'Client.java', 2, 2],
    ['catch', 'Client.java', 3, 4],
    ['throw', 'Client.java', 4, 4],
    ['sibling', 'Client.java', 6, 6],
    ['field', 'Client.java', 8, 9],
    ['literal', 'Client.java', 9, 9],
    ['other', 'Other.java', 1, 20],
    ['resource', 'query.graphql', 1, 10],
    ['variable', 'query.graphql', 2, 2],
    ['selection', 'query.graphql', 3, 8],
    ['selection-argument', 'query.graphql', 3, 3],
  ] as const;
  document.sources.push(
    ...sources.map(([id, path, start, end]) => ({
      ...template,
      id,
      path,
      lines: [start, end] as [number, number],
    })),
  );
  const common = {
    id: 'graph',
    source: 'call',
    owner_source: 'owner',
    call_binding_ids: ['native-call'],
    value_binding_ids: ['native-value'],
    support: ['owner'],
    completeness: 'partial' as const,
    gaps: ['Runtime unobserved.'],
    failure_paths: [
      {
        caught_type: 'Exception',
        source: 'catch',
        thrown_type: 'Translated',
        thrown_source: 'throw',
      },
    ],
  };
  const graph: GraphqlBinding = {
    ...common,
    kind: 'graphql_binding',
    client: {
      type: 'GraphQlClient',
      receiver_source: 'receiver',
      logical_name: 'logical',
      registry_source: null,
    },
    document_name: 'query',
    document_source: 'call',
    variables: [{ name: 'id', source: 'call', value_sources: ['argument'] }],
    execution_source: 'call',
    response: {
      field_path: 'thing',
      field_source: 'call',
      type: 'Result',
      type_source: 'argument',
      body_source: 'call',
      return_sources: ['sibling'],
    },
  };
  const library: LibraryBinding = {
    ...common,
    id: 'library',
    kind: 'library_binding',
    owner_type: 'JwtDecoder',
    method_name: 'decode',
    call_source: 'call',
    receiver_source: 'receiver',
    argument_sources: ['argument'],
    result_type: 'Jwt',
    contract_basis: 'framework_api',
  };
  const constant: JavaConstantBinding = {
    kind: 'java_constant_binding',
    id: 'constant',
    source: 'field',
    value_source: 'literal',
    owner_type: 'Client',
    name: 'NAME',
    type: 'String',
    value: 'query',
  };
  const resource: GraphqlDocumentBinding = {
    kind: 'graphql_document_binding',
    id: 'document',
    source: 'resource',
    document_name: 'query',
    operation_type: 'query',
    operation_name: 'GetThing',
    variables: [{ name: 'id', type: 'ID!', source: 'variable' }],
    selections: [
      {
        path: 'thing',
        field_name: 'thing',
        source: 'selection',
        arguments: [{ name: 'id', variable: 'id', source: 'selection-argument' }],
      },
    ],
  };
  document.bindings = [
    {
      kind: 'java_call_binding',
      id: 'native-call',
      call: 'call',
      caller: 'owner',
      receiver: 'receiver',
      receiverType: 'GraphQlClient',
      methodName: 'executeSync',
      argumentTypes: [],
      target: null,
      signature: null,
      resolution: 'unresolved',
      reason: 'External.',
      guards: [],
    },
    {
      kind: 'java_value_binding',
      id: 'native-value',
      relation: 'reference',
      from: 'argument',
      to: 'receiver',
      call: null,
      guards: [],
    },
    graph,
    library,
    constant,
    resource,
  ];
  return { document, graph, library, constant, resource };
}

describe('native client binding evidence contracts', () => {
  it('accepts source-pinned GraphQL, library, constant and parsed resource records', () => {
    expect(validateScanDocument(fixture().document)).toEqual([]);
  });

  it('rejects missing and wrong-kind evidence in every new record family', () => {
    const { document, graph, library, constant, resource } = fixture();
    graph.variables[0]!.value_sources = ['host:server'];
    library.argument_sources = ['missing'];
    constant.value_source = 'native-call';
    resource.selections[0]!.arguments[0]!.source = 'native-value';
    const errors = validateScanDocument(document);
    expect(errors).toContain('graph: host:server must reference source');
    expect(errors).toContain('library: missing must reference source');
    expect(errors).toContain('constant: native-call must reference source');
    expect(errors).toContain('document: native-value must reference source');
  });

  it('rejects wrong-kind call/value links and links pinned to another revision', () => {
    const { document, graph, library } = fixture();
    graph.call_binding_ids = ['native-value'];
    library.value_binding_ids = ['native-call'];
    const errors = validateScanDocument(document);
    expect(errors).toContain('graph: native-value must reference java_call_binding');
    expect(errors).toContain('library: native-call must reference java_value_binding');
    const clean = fixture();
    clean.document.sources.push({ ...clean.document.sources[0]!, id: 'foreign', commit: 'other' });
    clean.document.bindings?.push({
      kind: 'java_call_binding',
      id: 'foreign-call',
      call: 'foreign',
      caller: null,
      receiver: null,
      receiverType: null,
      methodName: 'decode',
      argumentTypes: [],
      target: null,
      signature: null,
      resolution: 'unresolved',
      reason: 'External.',
      guards: [],
    });
    clean.library.call_binding_ids = ['foreign-call'];
    expect(validateScanDocument(clean.document)).toContain(
      'library: binding reference foreign-call crosses repository or commit',
    );
  });

  it('rejects mixed pins and sources detached from their declared owners', () => {
    const { document, graph, library, constant, resource } = fixture();
    document.sources.push({ ...document.sources[0]!, id: 'foreign', repo: 'other/repo' });
    graph.support = ['foreign'];
    library.owner_source = 'other';
    constant.value_source = 'sibling';
    resource.variables[0]!.source = 'argument';
    const errors = validateScanDocument(document);
    expect(errors).toContain('graph: binding source foreign crosses repository or commit');
    expect(errors).toContain('library: source call must be within other');
    expect(errors).toContain('constant: source sibling must be within field');
    expect(errors).toContain('document: source argument must be within resource');
  });

  it('requires catch translations to remain inside their catch source', () => {
    const { document, graph, library } = fixture();
    graph.failure_paths[0]!.thrown_source = 'sibling';
    library.failure_paths = [
      {
        caught_type: 'Exception',
        source: 'catch',
        thrown_type: 'Translated',
        thrown_source: 'argument',
      },
    ];
    const errors = validateScanDocument(document);
    expect(errors).toContain('graph: source sibling must be within catch');
    expect(errors).toContain('library: source argument must be within catch');
  });

  it('rejects sibling-call arguments and receivers substituted into GraphQL or library calls', () => {
    const { document, graph, library } = fixture();
    graph.variables[0]!.value_sources = ['sibling'];
    graph.client.receiver_source = 'sibling';
    library.argument_sources = ['sibling'];
    library.receiver_source = 'sibling';
    const errors = validateScanDocument(document);
    expect(errors).toContain('graph: source sibling must be within call');
    expect(errors).toContain('library: source sibling must be within call');
  });
});
