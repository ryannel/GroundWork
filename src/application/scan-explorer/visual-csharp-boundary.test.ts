import { describe, expect, it } from 'vitest';

import { explorerManifestFixture } from '@/../test/service-explorer-kit';
import type { CsharpSymbolBinding, Source } from '@/domain/scan/scan.generated';
import { explorerPage } from '@/domain/service-explorer-check';

import { visualBoundaries } from './visual-boundaries';
import { isVisualBoundary, visualBoundaryPage } from './visual-boundary';
import { visualContext } from './visual-context';
import { csharpBoundaryNode } from './visual-csharp-boundary';
import type { VisualInput } from './visual-types';

describe('compiler-bound C# call boundaries', () => {
  const source: Source = {
    kind: 'source',
    id: 'source:call',
    repo: 'org/repo',
    path: 'Api/Price.cs',
    commit: 'a'.repeat(40),
    blob: 'b'.repeat(40),
    lines: [2, 4],
    host: 'host',
    authority: 'declared',
  };
  const record: CsharpSymbolBinding = {
    kind: 'csharp_symbol_binding',
    id: 'binding:storage',
    source: source.id,
    target: null,
    owner: null,
    relation: 'call_target',
    symbol: 'Task<Price> Core.PriceStore.ReadAsync(string key)',
    dispatch: 'external',
    arguments: [{ source: source.id, parameter: null }],
    limitations: ['Remote storage state unverified'],
    boundary: 'storage',
    completion: 'awaited',
    configurationSources: [],
    conditions: [],
  };
  function context(binding: CsharpSymbolBinding) {
    const input: VisualInput = {
      snapshot: 'selected',
      records: [source, binding],
      sources: [source],
      binding: {
        component: { id: 'component', logicalId: 'prices', label: 'Prices' },
        repo: source.repo,
        commit: source.commit,
        declarations: [source],
        modulePaths: ['Api/'],
        limitations: [],
      },
      coverage: [],
    };
    return visualContext(input, {
      snapshot: 'selected',
      purpose: explorerManifestFixture([]).services[0]!.purpose,
      fileFor: (id) => `${id}.json`,
      externalSources: [],
    });
  }
  it('exposes the actual source signature and observed completion without inventing storage schemas', () => {
    const selected = context(record);
    expect(isVisualBoundary(record)).toBe(true);
    expect(csharpBoundaryNode(selected, record, 'call')).toMatchObject({
      kind: 'storage',
      target: `${record.id}.json`,
    });
    const page = explorerPage(visualBoundaryPage(selected, record));
    expect(page.fields.find((field) => field.name === 'Completion in source')?.type).toBe(
      'awaited',
    );
    expect(page.fields.find((field) => field.name === 'Argument 1')?.type).toBe(
      'Unresolved formal parameter',
    );
    expect(page.fields.every((field) => field.required === 'unknown')).toBe(true);
    expect(page.nodes).toEqual([]);
    expect(visualBoundaries(selected).nodes[0]?.kind).toBe('storage');
    expect(page.sources[0]?.url).toContain(`/blob/${source.commit}/Api/Price.cs#L2-L4`);
  });
  it('keeps a declared HTTP target and candidates separate from runtime dispatch', () => {
    const http = {
      ...record,
      id: 'binding:http',
      boundary: 'http' as const,
      target: 'source:target',
      arguments: [{ source: source.id, parameter: 'request' }],
      dispatch: 'polymorphic' as const,
    };
    const selected = { ...context(http), fileFor: (id: string) => `${id}.json` };
    expect(visualBoundaryPage(selected, http).nodes[0]?.target).toBe('source:target.json');
    expect(csharpBoundaryNode(selected, http, 'call').kind).toBe('call');
    expect(
      visualBoundaryPage(selected, http).fields.find((field) => field.name === 'Argument 1')?.type,
    ).toBe('request');
    expect(isVisualBoundary({ ...http, boundary: 'unclassified' })).toBe(false);
    expect(isVisualBoundary({ ...http, relation: 'implementation_candidate' })).toBe(false);
    expect(
      visualBoundaries(context({ ...http, relation: 'implementation_candidate' })).nodes,
    ).toEqual([]);
  });
});
