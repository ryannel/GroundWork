import { describe, expect, it } from 'vitest';

import { recordIndexes } from '@/domain/knowledge/knowledge-reader';
import type {
  KnowledgeRecord,
  RuntimeComponent,
  InterfaceContract,
  Interaction,
} from '@/domain/knowledge/knowledge.generated';
import type { OutboundBinding, Source } from '@/domain/scan/scan.generated';
import { currentCorrespondence } from '@/domain/scan-explorer/current-connections';
import type { CurrentScanInput } from '@/domain/scan-explorer/current-contracts';

import { buildScanExplorer } from './build-index';
import { currentProvidersFromCanonical, currentTargetsFromCanonical } from './current-targets';

const source: Source = {
  kind: 'source',
  id: 'source:call',
  repo: 'org/repo',
  commit: 'a'.repeat(40),
  path: 'app/main.ts',
  blob: 'b'.repeat(40),
  lines: [10, 12],
  host: 'host',
  authority: 'declared',
};
const component: RuntimeComponent = {
  id: 'target',
  kind: 'runtime_component',
  logicalId: 'service:target',
  label: 'Target',
  category: 'service',
  technology: 'Node',
  sources: ['ev'],
  basis: 'source_declared',
  gaps: [],
  evidence: ['ev'],
};
const outbound: OutboundBinding = {
  kind: 'outbound_binding',
  id: 'outbound',
  source: source.id,
  owner_source: source.id,
  client: {
    type: 'HttpClient',
    receiver_source: source.id,
    logical_name: 'configured-target',
    registry_source: source.id,
  },
  request: {
    method: 'GET',
    method_source: source.id,
    uri_source: source.id,
    template: '/items',
    argument_sources: [],
    headers: [],
    accept_sources: [],
    body_sources: [],
  },
  response: { type: null, type_source: null, body_source: source.id, return_sources: [] },
  failure_paths: [],
  call_binding_ids: [],
  value_binding_ids: [],
  support: [source.id],
  completeness: 'partial',
  gaps: ['Deployment unverified'],
};
const contract: InterfaceContract = {
  id: 'caller-contract',
  kind: 'interface_contract',
  component: 'target',
  protocol: 'https',
  method: 'GET',
  path: '/items',
  authority: 'caller_construction',
  name: 'Items',
  request: [],
  responses: [],
  gaps: [],
  evidence: ['ev'],
};
const interaction: Interaction = {
  id: 'canonical-call',
  kind: 'interaction',
  owner: 'impl',
  execution: 'execution',
  operation: 'call',
  target: 'target',
  targetEntry: 'entry',
  contract: contract.id,
  effect: null,
  handoff: null,
  mode: 'request_response',
  boundary: 'network',
  waitsFor: 'response',
  condition: 'source condition',
  requestBindings: [],
  responseBindings: [],
  gaps: [],
  evidence: ['ev'],
};

function input(records: CurrentScanInput['records']): CurrentScanInput {
  return {
    snapshot: 'current',
    records,
    sources: [source],
    binding: {
      component,
      repo: source.repo,
      commit: source.commit,
      declarations: [source],
      modulePaths: ['app/'],
      verification: 'pinned_runtime_declaration',
      limitations: ['Deployment unverified'],
    },
    coverage: ['Selected source'],
  };
}

function index(changes: Partial<typeof source> = {}): ReturnType<typeof buildScanExplorer> {
  const anchor = { ...source, ...changes };
  const records: readonly KnowledgeRecord[] = [
    component,
    contract,
    { ...contract, id: 'provider-contract', authority: 'source_declared' },
    interaction,
    {
      id: 'exposure',
      kind: 'entry_binding',
      entry: 'entry',
      execution: 'execution',
      contract: 'provider-contract',
      gaps: [],
      evidence: ['ev'],
    },
    {
      id: 'ev',
      kind: 'evidence',
      host: 'github.com',
      repo: anchor.repo,
      commit: anchor.commit,
      path: anchor.path,
      lines: anchor.lines,
      basis: 'source',
    },
  ];
  return buildScanExplorer([
    {
      reader: {
        snapshot: 'canonical',
        rules: 'knowledge-query/v3',
        get: (id) => records.find((record) => record.id === id),
        select: (key, value) =>
          records.filter((record) => recordIndexes(record).get(key)?.includes(value) === true),
      },
      scope: 'retained',
      completeness: 'partial',
      limitations: [],
    },
  ]);
}

function enriched(): readonly CurrentScanInput[] {
  const caller = input([outbound]);
  const provider = input([
    {
      kind: 'aspnet_route_binding',
      id: 'route',
      source: source.id,
      support: [source.id],
      controller: 'Items',
      method: 'Get',
      httpMethods: ['GET'],
      template: '/items',
      input_contract_ids: [],
      output_contract_ids: [],
      parameters: [],
      status: 'source_declared',
      limitations: ['Deployment unverified'],
    },
  ]);
  return [
    { ...caller, targets: currentTargetsFromCanonical(caller, index()) },
    { ...provider, providers: currentProvidersFromCanonical(provider, index()) },
  ];
}

describe('current and retained source correspondence', () => {
  it('confirms newly extracted caller/provider addresses through exact pinned canonical identity evidence', () => {
    const result = currentCorrespondence(enriched());
    expect(result[0]?.status).toBe('confirmed');
    expect(result[0]?.caller.authority).toBe('caller_construction');
    expect(result[0]?.provider?.authority).toBe('source_declared');
    expect(result[0]?.caller.snapshot).toBe('current');
  });
  it.each([
    { path: 'app/other.ts' },
    { commit: 'c'.repeat(40) },
    { lines: [11, 12] } satisfies Partial<Source>,
  ])('rejects changed canonical callsite anchors %o', (changes) => {
    expect(currentTargetsFromCanonical(input([outbound]), index(changes))).toEqual([]);
  });
  it('keeps unbound addresses as candidates and wrong methods unresolved', () => {
    const [caller, provider] = enriched();
    if (caller === undefined || provider === undefined) throw new Error('Missing fixture');
    expect(currentCorrespondence([{ ...caller, targets: [] }, provider])[0]?.status).toBe(
      'candidate',
    );
    const wrong = { ...outbound, request: { ...outbound.request, method: 'POST' } };
    expect(currentTargetsFromCanonical(input([wrong]), index())).toEqual([]);
    expect(currentCorrespondence([input([wrong]), provider])[0]?.status).toBe('unresolved');
  });
  it('does not confirm wrong host or transport and retains duplicate exposures as ambiguous', () => {
    const [caller, provider] = enriched();
    if (caller === undefined || provider === undefined) throw new Error('Missing fixture');
    expect(
      currentCorrespondence([
        caller,
        {
          ...provider,
          binding: { ...provider.binding, component: { ...component, logicalId: 'wrong' } },
        },
      ])[0]?.status,
    ).toBe('candidate');
    expect(
      currentCorrespondence([
        caller,
        {
          ...provider,
          providers: [
            { entry: 'route', protocol: 'http', sourceIds: [source.id], canonicalEntry: 'entry' },
          ],
        },
      ])[0]?.status,
    ).toBe('candidate');
    expect(
      currentCorrespondence([caller, provider, provider]).map((match) => match.status),
    ).toEqual(['ambiguous', 'ambiguous']);
    expect(
      currentCorrespondence([
        caller,
        {
          ...provider,
          providers: [
            {
              entry: 'route',
              protocol: 'https',
              sourceIds: [source.id],
              canonicalEntry: 'entry',
              version: 'different',
            },
          ],
        },
      ])[0]?.status,
    ).toBe('candidate');
  });
});

it('does not choose the first conflicting retained target correspondence', () => {
  const [caller, provider] = enriched();
  const mapping = caller?.targets?.[0];
  if (caller === undefined || provider === undefined || mapping === undefined) {
    throw new Error('Missing target fixture');
  }
  const conflicting = { ...caller, targets: [mapping, { ...mapping, component: 'other-target' }] };
  const result = currentCorrespondence([conflicting, provider]);
  expect(result[0]?.status).toBe('ambiguous');
  expect(result[0]?.caller.component).toBeNull();
});
