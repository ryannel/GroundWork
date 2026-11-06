import { describe, expect, it } from 'vitest';

import { recordIndexes } from '@/domain/knowledge/knowledge-reader';
import type { KnowledgeRecord } from '@/domain/knowledge/knowledge.generated';
import type { OutboundBinding, Source } from '@/domain/scan/scan.generated';
import type { CurrentScanInput } from '@/domain/scan-explorer/current-contracts';

import { buildScanExplorer } from './build-index';
import { currentCallers } from './current-callers';

const commit = 'a'.repeat(40);
const source = (snapshot: string): Source => ({
  kind: 'source',
  id: `source:${snapshot}`,
  repo: `org/${snapshot}`,
  commit,
  path: 'app/A file.ts',
  blob: 'b'.repeat(40),
  lines: [10, 12],
  host: 'scan-host',
  authority: 'declared',
});
function input(snapshot: string, records: CurrentScanInput['records']): CurrentScanInput {
  const anchor = source(snapshot);
  return {
    snapshot,
    records,
    sources: [anchor, { ...anchor, id: 'source:unused' }],
    binding: {
      component: {
        id: snapshot,
        kind: 'runtime_component',
        logicalId: `svc:${snapshot}`,
        label: snapshot,
        category: 'service',
        technology: 'Node',
        sources: [anchor.id],
        basis: 'source_declared',
        gaps: [],
        evidence: [anchor.id],
      },
      repo: anchor.repo,
      commit,
      declarations: [anchor],
      modulePaths: ['app/'],
      verification: 'pinned_runtime_declaration',
      limitations: ['Deployment not verified'],
    },
    coverage: [`Selected ${snapshot} sources`],
  };
}
function outbound(id: string, path: string): OutboundBinding {
  const anchor = source('caller').id;
  return {
    kind: 'outbound_binding',
    id,
    source: anchor,
    owner_source: anchor,
    client: {
      type: 'HttpClient',
      receiver_source: anchor,
      logical_name: 'provider',
      registry_source: anchor,
    },
    request: {
      method: 'GET',
      method_source: anchor,
      uri_source: anchor,
      template: path,
      argument_sources: [],
      headers: [],
      accept_sources: [],
      body_sources: [],
    },
    response: { type: null, type_source: null, body_source: anchor, return_sources: [] },
    failure_paths: [],
    call_binding_ids: [],
    value_binding_ids: [],
    support: [anchor],
    completeness: 'partial',
    gaps: ['Deployment not verified'],
  };
}
function scans(paths = ['/items', '/items']): readonly CurrentScanInput[] {
  const calls = paths.map((path, index) => outbound(`call:${String(index)}`, path));
  const caller = {
    ...input('caller', calls),
    targets: calls.map((record) => ({
      outbound: record.id,
      component: 'svc:provider',
      protocol: 'https',
      method: 'GET',
      path: record.request.template!,
      sourceIds: record.support,
      basis: 'canonical_source_correspondence' as const,
      canonicalInteraction: `canonical:${record.id}`,
    })),
  };
  const provider = {
    ...input('provider', [
      {
        kind: 'aspnet_route_binding',
        id: 'route',
        source: source('provider').id,
        support: [source('provider').id],
        controller: 'Items',
        method: 'Get',
        httpMethods: ['GET'],
        template: paths[0]!,
        input_contract_ids: [],
        output_contract_ids: [],
        parameters: [],
        status: 'source_declared',
        limitations: ['Deployment not verified'],
      },
    ]),
    providers: [
      {
        entry: 'route',
        protocol: 'https',
        sourceIds: [source('provider').id],
        canonicalEntry: 'canonical:entry',
      },
    ],
  };
  return [caller, provider];
}
function retained(withHost = true): ReturnType<typeof buildScanExplorer> {
  const records: KnowledgeRecord[] = [
    { ...input('provider', []).binding.component, id: 'target' },
    {
      id: 'contract',
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
    },
    {
      id: 'retained-call',
      kind: 'interaction',
      owner: 'impl',
      execution: 'execution',
      operation: 'call',
      target: 'target',
      targetEntry: null,
      contract: 'contract',
      effect: null,
      handoff: null,
      mode: 'request_response',
      boundary: 'network',
      waitsFor: 'response',
      condition: '',
      requestBindings: [],
      responseBindings: [],
      gaps: [],
      evidence: ['ev', 'missing', 'contract'],
    },
    {
      id: 'ev',
      kind: 'evidence',
      repo: 'org/retained',
      commit,
      path: 'app/A file.ts',
      lines: [10, 12],
      basis: 'source',
      ...(withHost ? { host: 'code.example' } : {}),
    },
  ];
  return buildScanExplorer([
    {
      reader: {
        snapshot: 'retained',
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
describe('bounded current caller evidence', () => {
  it('keeps technical correspondence and scoped pinned source links without claiming exhaustive deployment knowledge', () => {
    const result = currentCallers(scans(), { component: 'svc:provider', limit: 20 });
    expect(
      result.items.map((item) => [item.caller.record, item.provider?.record, item.status]),
    ).toEqual([
      ['call:0', 'route', 'confirmed'],
      ['call:1', 'route', 'confirmed'],
    ]);
    expect(result).toMatchObject({
      total: 2,
      truncated: false,
      nextOffset: null,
      limitsHit: [],
      exhaustive: false,
      coverage: [
        { snapshot: 'caller', scope: ['Selected caller sources'] },
        { snapshot: 'provider', scope: ['Selected provider sources'] },
      ],
    });
    expect(result.sourceLinks).toEqual([
      {
        id: 'source:caller',
        snapshot: 'caller',
        url: `https://github.com/org/caller/blob/${commit}/app/A%20file.ts#L10-L12`,
      },
      {
        id: 'source:provider',
        snapshot: 'provider',
        url: `https://github.com/org/provider/blob/${commit}/app/A%20file.ts#L10-L12`,
      },
    ]);
    expect(currentCallers(scans(), { component: 'svc:unrelated', limit: 20 }).items).toEqual([]);
  });
  it('retains an unresolved provider as a gap and does not manufacture its source', () => {
    const caller = scans()[0]!;
    const result = currentCallers([caller], { component: 'svc:provider', limit: 20 });
    expect(result.items.map((item) => [item.status, item.provider])).toEqual([
      ['unresolved', null],
      ['unresolved', null],
    ]);
    expect(result.sourceLinks.map((link) => link.snapshot)).toEqual(['caller']);
  });
  it('pages by records and keeps offset, total, coverage and continuation information visible', () => {
    const inputs = scans();
    const first = currentCallers(inputs, { component: 'svc:provider', limit: 1 });
    expect(first.items.map((item) => item.caller.record)).toEqual(['call:0']);
    expect(first).toMatchObject({
      total: 2,
      truncated: true,
      nextOffset: 1,
      limitsHit: ['records'],
      exhaustive: false,
    });
    const last = currentCallers(inputs, { component: 'svc:provider', limit: 1, offset: 1 });
    expect(last.items.map((item) => item.caller.record)).toEqual(['call:1']);
    expect(last).toMatchObject({ total: 2, truncated: true, nextOffset: null, limitsHit: [] });
    expect(
      currentCallers(inputs, { component: 'svc:provider', limit: 1, offset: 5 }),
    ).toMatchObject({ items: [], total: 2, truncated: true, nextOffset: null, limitsHit: [] });
  });
  it('reports the byte limit rather than silently dropping a large correspondence', () => {
    const result = currentCallers(scans([`/${'a'.repeat(6000)}`]), {
      component: 'svc:provider',
      limit: 20,
      maxBytes: 4096,
    });
    expect(result).toMatchObject({
      items: [],
      sourceLinks: [],
      total: 1,
      truncated: true,
      nextOffset: 0,
      limitsHit: ['bytes'],
      exhaustive: false,
    });
    expect(
      currentCallers(scans(), { component: 'svc:provider', limit: 200, maxBytes: 2_000_000 }).items,
    ).toHaveLength(2);
  });
  it.each([0, 201, 1.5, Number.NaN])('rejects invalid record limit %s', (limit) => {
    expect(() => currentCallers([], { component: 'svc:provider', limit })).toThrow('limit');
  });
  it.each([-1, 1.5, Number.NaN])('rejects invalid offset %s', (offset) => {
    expect(() => currentCallers([], { component: 'svc:provider', limit: 1, offset })).toThrow(
      'offset',
    );
  });
  it.each([4095, 2_000_001, Number.NaN])('rejects invalid byte budget %s', (maxBytes) => {
    expect(() => currentCallers([], { component: 'svc:provider', limit: 1, maxBytes })).toThrow(
      'byte budget',
    );
  });
  it('keeps retained caller provenance separate from current provider provenance and ignores non-evidence records', () => {
    const provider = scans()[1]!;
    const result = currentCallers([provider], { component: 'svc:provider', limit: 20 }, retained());
    expect(
      result.items.map((item) => [
        item.caller.snapshot,
        item.caller.record,
        item.provider?.snapshot,
      ]),
    ).toEqual([['retained', 'retained-call', 'provider']]);
    expect(result.sourceLinks).toEqual([
      {
        id: 'source:provider',
        snapshot: 'provider',
        url: `https://github.com/org/provider/blob/${commit}/app/A%20file.ts#L10-L12`,
      },
      {
        id: 'ev',
        snapshot: 'retained',
        url: `https://code.example/org/retained/blob/${commit}/app/A%20file.ts#L10-L12`,
      },
    ]);
    expect(
      currentCallers([provider], { component: 'svc:provider', limit: 20 }, retained(false))
        .sourceLinks,
    ).toHaveLength(1);
  });
});
