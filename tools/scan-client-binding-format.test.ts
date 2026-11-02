import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import type { BindingRecord } from '@/domain/scan/scan.generated';
import { scanValidator } from '@/infrastructure/scan/scan-format';

vi.mock(import('server-only'), () => ({}));

function fixture() {
  const document = scanFixture();
  const source = 'source:handler';
  const common = {
    source,
    owner_source: source,
    call_binding_ids: [],
    value_binding_ids: [],
    support: [source],
    completeness: 'partial' as const,
    gaps: ['Effective runtime unobserved.'],
    failure_paths: [],
  };
  const bindings: BindingRecord[] = [
    {
      ...common,
      kind: 'graphql_binding',
      id: 'graphql',
      client: {
        type: 'GraphQlClient',
        receiver_source: source,
        logical_name: null,
        registry_source: null,
      },
      document_name: 'query',
      document_source: source,
      variables: [{ name: 'id', source, value_sources: [source] }],
      execution_source: source,
      response: {
        field_path: 'thing',
        field_source: source,
        type: 'Thing',
        type_source: source,
        body_source: source,
        return_sources: [source],
      },
    },
    {
      ...common,
      kind: 'library_binding',
      id: 'library',
      owner_type: 'JwtDecoder',
      method_name: 'decode',
      call_source: source,
      receiver_source: source,
      argument_sources: [source],
      result_type: 'Jwt',
      contract_basis: 'framework_api',
    },
    {
      kind: 'java_constant_binding',
      id: 'constant',
      source,
      value_source: source,
      owner_type: 'Client',
      name: 'NAME',
      type: 'String',
      value: 'query',
    },
    {
      kind: 'graphql_document_binding',
      id: 'document',
      source,
      document_name: 'query',
      operation_type: 'query',
      operation_name: null,
      variables: [{ name: 'id', type: 'ID!', source }],
      selections: [
        {
          path: 'thing',
          field_name: 'thing',
          source,
          arguments: [{ name: 'id', variable: 'id', source }],
        },
      ],
    },
  ];
  document.bindings = bindings;
  return document;
}

describe('public client binding schema', () => {
  it('parses all four new closed record contracts and scalar constant alternatives', async () => {
    const check = await scanValidator();
    const document = fixture();
    expect(check(document)).toEqual(document);
    for (const value of [42, true, null]) {
      const candidate = fixture();
      const constant = candidate.bindings?.find(
        (binding) => binding.kind === 'java_constant_binding',
      );
      if (!constant) throw new Error('Missing constant fixture');
      constant.value = value;
      expect(check(candidate)).toEqual(candidate);
    }
  });

  it('rejects invented transport fields, unsupported discriminators and malformed constants', async () => {
    const check = await scanValidator();
    const document = fixture();
    for (const binding of document.bindings ?? []) {
      expect(() =>
        check({ ...document, bindings: [{ ...binding, unsupported: 'value' }] }),
      ).toThrow('ScanDocument');
    }
    const library = document.bindings?.find((binding) => binding.kind === 'library_binding');
    expect(() =>
      check({ ...document, bindings: [{ ...library, contract_basis: 'guessed' }] }),
    ).toThrow('ScanDocument');
    const graph = document.bindings?.find((binding) => binding.kind === 'graphql_binding');
    expect(() =>
      check({
        ...document,
        bindings: [{ ...graph, request: { method: 'POST', uri: '/graphql' } }],
      }),
    ).toThrow('ScanDocument');
    const constant = document.bindings?.find((binding) => binding.kind === 'java_constant_binding');
    expect(() =>
      check({ ...document, bindings: [{ ...constant, value: { literal: 'query' } }] }),
    ).toThrow('ScanDocument');
    const resource = document.bindings?.find(
      (binding) => binding.kind === 'graphql_document_binding',
    );
    expect(() =>
      check({ ...document, bindings: [{ ...resource, operation_type: 'http' }] }),
    ).toThrow('ScanDocument');
  });

  it('rejects nested wrong-kind evidence through the same public parse boundary', async () => {
    const check = await scanValidator();
    const document = fixture();
    const graph = document.bindings?.find((binding) => binding.kind === 'graphql_binding');
    if (!graph) throw new Error('Missing GraphQL fixture');
    graph.variables[0]!.value_sources = ['host:server'];
    expect(() => check(document)).toThrow('host:server must reference source');
  });
});
