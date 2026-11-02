import { describe, expect, it } from 'vitest';

import type { Source } from '@/domain/scan/scan.generated';
import type { CurrentScanInput } from '@/domain/scan-explorer/current-contracts';

import {
  currentDataInspection,
  currentEntryFlow,
  currentImplementationCandidates,
  currentServiceOverview,
} from './current-scan';

const source: Source = {
  kind: 'source',
  id: 'source:entry',
  repo: 'org/service',
  commit: 'a'.repeat(40),
  path: 'api/App.java',
  blob: 'b'.repeat(40),
  lines: [1, 3],
  host: 'scan-host',
  authority: 'declared',
};
const input: CurrentScanInput = {
  snapshot: 'current',
  sources: [source, { ...source, id: 'source:call' }, { ...source, id: 'source:detached' }],
  records: [
    {
      kind: 'semantic_node',
      id: 'entry',
      owner: 'same-owner',
      source: 'source:entry',
      nodeKind: 'function',
      syntax: 'entry',
    },
    {
      kind: 'semantic_edge',
      id: 'body',
      owner: 'same-owner',
      source: 'source:entry',
      relation: 'body',
      from: 'entry',
      to: 'call',
    },
    {
      kind: 'semantic_node',
      id: 'call',
      owner: 'same-owner',
      source: 'source:call',
      nodeKind: 'call',
      syntax: 'call',
    },
    {
      kind: 'semantic_node',
      id: 'detached',
      owner: 'same-owner',
      source: 'source:detached',
      nodeKind: 'throw',
      syntax: 'throw',
    },
  ],
  binding: {
    component: {
      id: 'runtime',
      kind: 'runtime_component',
      logicalId: 'service:example',
      label: 'Example',
      category: 'service',
      technology: 'Spring Boot',
      sources: ['source:entry'],
      basis: 'source_declared',
      gaps: [],
      evidence: ['source:entry'],
    },
    repo: source.repo,
    commit: source.commit,
    declarations: [source],
    modulePaths: ['api/'],
    verification: 'pinned_runtime_declaration',
    limitations: ['Deployment unverified'],
  },
  coverage: ['Selected source only'],
};

describe('current scan runtime projection', () => {
  it('follows source control edges without importing detached same-owner failures', () => {
    const result = currentEntryFlow(input, { rootSourceIds: ['source:entry'], limit: 20 });
    expect(result.items.map((record) => record.id)).toEqual(['entry', 'body', 'call']);
    expect(result.sourceLinks).toHaveLength(2);
    expect(result.execution).toBe('source_reachability_runtime_unverified');
    expect(result.component.logicalId).toBe('service:example');
  });

  it('preserves edge kinds and labels and removes a disconnected branch', () => {
    const detached = { ...input, records: input.records.filter((record) => record.id !== 'body') };
    expect(
      currentEntryFlow(detached, { rootSourceIds: ['source:entry'], limit: 20 }).items.map(
        (record) => record.id,
      ),
    ).toEqual(['entry']);
    expect(
      currentDataInspection(input, { sourceIds: ['source:call'], limit: 20 }).items.map(
        (record) => record.id,
      ),
    ).toEqual(['call']);
  });

  it('does not bind source from an unrelated module or revision', () => {
    const wrongModule = { ...input, binding: { ...input.binding, modulePaths: ['other/'] } };
    expect(currentServiceOverview(wrongModule).items).toEqual([]);
    expect(
      currentEntryFlow(wrongModule, { rootSourceIds: ['source:entry'], limit: 20 }).items,
    ).toEqual([]);
    expect(() =>
      currentServiceOverview({ ...input, binding: { ...input.binding, commit: 'c'.repeat(40) } }),
    ).toThrow('revision mismatch');
  });

  it('retains explicit bounds and rejects absent runtime declarations', () => {
    expect(
      currentDataInspection(input, { sourceIds: ['source:entry', 'source:call'], limit: 1 })
        .truncated,
    ).toBe(true);
    expect(() => currentServiceOverview(input, 0)).toThrow('limit');
    expect(() =>
      currentServiceOverview({ ...input, binding: { ...input.binding, declarations: [] } }),
    ).toThrow('runtime declaration');
    expect(() =>
      currentServiceOverview({ ...input, binding: { ...input.binding, modulePaths: [] } }),
    ).toThrow('module paths');
  });
});

it('bounds payload bytes including supporting links and returns a continuation frontier', () => {
  const expanded = {
    ...input,
    records: [
      ...input.records,
      {
        kind: 'semantic_node',
        id: 'large',
        owner: 'same-owner',
        source: 'source:call',
        nodeKind: 'literal',
        syntax: 'x'.repeat(6000),
      } satisfies CurrentScanInput['records'][number],
    ],
  };
  const result = currentDataInspection(expanded, {
    sourceIds: ['source:call'],
    limit: 20,
    maxBytes: 4096,
  });
  expect(new TextEncoder().encode(JSON.stringify(result)).byteLength).toBeLessThanOrEqual(4096);
  expect(result.limitsHit).toEqual(['bytes']);
  expect(result.frontiers[0]?.at).toBe('large');
  expect(result.nextOffset).toBe(1);
  expect(
    currentDataInspection(expanded, {
      sourceIds: ['source:call'],
      limit: 20,
      maxBytes: 20_000,
      offset: 1,
    }).items[0]?.id,
  ).toBe('large');
});

it('keeps polymorphic implementations as explicit conditional drilldown', () => {
  const candidate = {
    kind: 'csharp_symbol_binding',
    id: 'candidate',
    relation: 'implementation_candidate',
    source: 'interface',
    target: 'class-method',
    owner: 'class',
    symbol: 'Compute',
    dispatch: 'polymorphic',
    arguments: [],
    limitations: ['Runtime selection unresolved'],
    boundary: 'unknown',
    completion: 'unobserved',
    configurationSources: ['source:entry'],
    conditions: ['Scrutor assembly predicate; applicability unresolved'],
  } satisfies CurrentScanInput['records'][number];
  const call = {
    ...candidate,
    id: 'dispatch',
    relation: 'call_target',
    source: 'source:call',
    target: 'interface',
  } satisfies CurrentScanInput['records'][number];
  const enriched = { ...input, records: [...input.records, call, candidate] };
  expect(
    currentEntryFlow(enriched, { rootSourceIds: ['source:entry'], limit: 100 }).items.map(
      (record) => record.id,
    ),
  ).not.toContain('candidate');
  const result = currentImplementationCandidates(enriched, { sourceId: 'interface', limit: 10 });
  expect(result.items).toEqual([candidate]);
  expect(result.sourceLinks.map((link) => link.id)).toContain('source:entry');
  expect(candidate.conditions).toEqual(['Scrutor assembly predicate; applicability unresolved']);
});
