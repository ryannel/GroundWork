import { describe, expect, it } from 'vitest';

import type { GraphqlBinding, OutboundBinding, SemanticNode } from '@/domain/scan/scan.generated';
import type { CurrentScanInput } from '@/domain/scan-explorer/current-contracts';
import { explorerPage } from '@/domain/service-explorer-check';

import { isVisualBoundary, visualBoundaryNode, visualBoundaryPage } from './visual-boundary';
import { visualContext } from './visual-context';

const source = 'source:call';
const outbound: OutboundBinding = {
  kind: 'outbound_binding',
  id: 'outbound:call',
  source,
  owner_source: source,
  client: {
    type: 'RestClient',
    receiver_source: source,
    logical_name: 'identity',
    registry_source: source,
  },
  request: {
    method: 'POST',
    method_source: source,
    uri_source: source,
    template: '/users/{id}',
    argument_sources: [source],
    headers: [{ name: 'Authorization', source, value_sources: [source] }],
    accept_sources: [],
    body_sources: [source],
  },
  response: { type: 'User', type_source: source, body_source: source, return_sources: [source] },
  failure_paths: [],
  call_binding_ids: [],
  value_binding_ids: [],
  support: [source],
  completeness: 'source_path',
  gaps: ['Provider deployment unknown'],
};
const call: SemanticNode = {
  kind: 'semantic_node',
  id: 'call',
  source,
  owner: 'summary',
  nodeKind: 'call',
  syntax: 'buildRequest(userId, token)',
  name: 'request',
};
function context(record: OutboundBinding | GraphqlBinding) {
  const input: CurrentScanInput = {
    snapshot: 'selected',
    records: [record, call],
    sources: [
      {
        kind: 'source',
        id: source,
        repo: 'org/repo',
        commit: 'a'.repeat(40),
        blob: 'b'.repeat(40),
        path: 'api/main.java',
        lines: [1, 9],
        host: 'host',
        authority: 'declared',
      },
    ],
    binding: {
      repo: 'org/repo',
      commit: 'a'.repeat(40),
      modulePaths: ['api/'],
      verification: 'pinned_runtime_declaration',
      declarations: [],
      limitations: [],
      component: {
        kind: 'runtime_component',
        id: 'runtime',
        logicalId: 'service:example',
        label: 'Example',
        category: 'service',
        technology: 'Java',
        basis: 'source_declared',
        sources: [source],
        evidence: [source],
        gaps: [],
      },
    },
    coverage: ['Selected source'],
  };
  return visualContext(input, {
    snapshot: 'projection',
    purpose: { label: 'Inferred', statement: 'Example', confidence: 'medium', claim: 'purpose' },
    fileFor: () => 'boundary.json',
    externalSources: [],
  });
}
describe('caller construction and message inspection', () => {
  it('shows source request arguments, headers, body and response without asserting wire policy', () => {
    const selected = context(outbound);
    expect(isVisualBoundary(outbound)).toBe(true);
    expect(visualBoundaryNode(selected, call)).toMatchObject({
      label: 'identity · POST /users/{id}',
      target: 'boundary.json',
    });
    const page = explorerPage(visualBoundaryPage(selected, outbound));
    expect(page.fields.map((field) => field.name)).toEqual([
      'Request method',
      'Request address',
      'URI argument 1',
      'Header Authorization',
      'Body construction 1',
      'Response declared type',
    ]);
    expect(
      page.fields.every((field) => field.required === 'unknown' && field.nullable === 'unknown'),
    ).toBe(true);
    expect(page.sources[0]?.url).toContain(`/blob/${'a'.repeat(40)}`);
    expect(page.links).toEqual([]);
    expect(page.gaps).toContain('Provider deployment unknown');
    expect(visualBoundaryNode(selected, { ...call, source: 'missing' })).toBeNull();
  });
  it('keeps GraphQL variables separate from provider fields and retains dynamic/partial boundaries', () => {
    const record: GraphqlBinding = {
      kind: 'graphql_binding',
      id: 'graphql:call',
      source,
      owner_source: source,
      client: outbound.client,
      document_name: null,
      document_source: source,
      variables: [{ name: 'customerId', source, value_sources: [] }],
      execution_source: source,
      response: {
        type: null,
        type_source: null,
        body_source: source,
        return_sources: [],
        field_path: null,
        field_source: null,
      },
      failure_paths: [],
      call_binding_ids: [],
      value_binding_ids: [],
      support: [source],
      completeness: 'partial',
      gaps: ['Dynamic target'],
    };
    const page = explorerPage(visualBoundaryPage(context(record), record));
    expect(page.fields).toContainEqual(
      expect.objectContaining({ name: 'Variable customerId', type: 'Value not expanded' }),
    );
    expect(page.completeSelection).toBe(false);
    expect(page.description).toContain('Provider contracts remain separate');
    expect(page.fields.find((field) => field.name === 'Response declared type')?.type).toBe(
      'Unresolved source type',
    );
  });
});
