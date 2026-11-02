import { describe, expect, it } from 'vitest';

import type { CurrentScanInput } from '@/domain/scan-explorer/current-contracts';
import { explorerPage } from '@/domain/service-explorer-check';

import { visualContext } from './visual-context';
import { visualFlow } from './visual-flow';
import { visualSchema } from './visual-schema';

const input: CurrentScanInput = {
  snapshot: 'selected',
  records: [
    {
      kind: 'semantic_node',
      id: 'root',
      source: 'source:root',
      owner: 'summary',
      nodeKind: 'function',
      name: 'update',
      syntax: 'update()',
    },
    {
      kind: 'semantic_node',
      id: 'block',
      source: 'source:block',
      owner: 'summary',
      nodeKind: 'block',
      syntax: '{}',
    },
    {
      kind: 'semantic_node',
      id: 'guard',
      source: 'source:guard',
      owner: 'summary',
      nodeKind: 'if',
      syntax: 'if (!membership) throw notFound',
    },
    {
      kind: 'semantic_node',
      id: 'failure',
      source: 'source:failure',
      owner: 'summary',
      nodeKind: 'throw',
      syntax: 'throw notFound',
    },
    {
      kind: 'semantic_node',
      id: 'save',
      source: 'source:save',
      owner: 'summary',
      nodeKind: 'call',
      syntax: 'repository.save(customer)',
    },
    ...[
      { from: 'root', to: 'block', relation: 'body' as const },
      { from: 'block', to: 'guard', relation: 'statement' as const },
      { from: 'guard', to: 'failure', relation: 'consequent' as const },
      { from: 'block', to: 'save', relation: 'statement' as const },
    ].map(
      (edge, index) =>
        ({
          kind: 'semantic_edge',
          id: `edge-${String(index)}`,
          owner: 'summary',
          source: 'source:root',
          ...edge,
        }) satisfies CurrentScanInput['records'][number],
    ),
  ],
  sources: ['root', 'block', 'guard', 'failure', 'save'].map((id) => ({
    kind: 'source',
    id: `source:${id}`,
    repo: 'org/repo',
    commit: 'a'.repeat(40),
    blob: 'b'.repeat(40),
    path: 'api/main.ts',
    lines: [1, 3],
    host: 'host',
    authority: 'declared',
  })),
  binding: {
    component: {
      id: 'runtime',
      kind: 'runtime_component',
      logicalId: 'service:example',
      label: 'Example',
      category: 'service',
      technology: 'Node',
      sources: ['source:root'],
      basis: 'source_declared',
      evidence: ['source:root'],
      gaps: [],
    },
    repo: 'org/repo',
    commit: 'a'.repeat(40),
    declarations: [],
    modulePaths: ['api/'],
    verification: 'pinned_runtime_declaration',
    limitations: ['Source only'],
  },
  coverage: ['Selected source'],
};

function context(selected = input): ReturnType<typeof visualContext> {
  return visualContext(selected, {
    snapshot: 'projection',
    purpose: {
      label: 'Inferred',
      statement: 'Example purpose',
      confidence: 'medium',
      claim: 'purpose',
    },
    fileFor: (id) => `page-${id.replaceAll(':', '-')}.json`,
    externalSources: [],
  });
}

describe('source-derived visual frames', () => {
  it('collapses hidden syntax through real typed edges and retains the guard failure', () => {
    const page = visualFlow(context(), 'source:root', 'Update');
    expect(explorerPage(page)).toBe(page);
    expect(page.nodes.map((node) => node.id)).toEqual(['root', 'guard', 'failure', 'save']);
    expect(page.links.find((link) => link.from === 'guard' && link.to === 'failure')?.kind).toBe(
      'branch',
    );
    expect(page.links.some((link) => link.from === 'failure' && link.to === 'save')).toBe(false);
    expect(page.sources.every((source) => source.url.includes('/blob/'))).toBe(true);
  });
  it('does not retain a detached same-owner failure or fabricate a replacement sequence', () => {
    const detached = {
      ...input,
      records: input.records.filter(
        (record) => record.kind !== 'semantic_edge' || record.to !== 'failure',
      ),
    };
    const page = visualFlow(context(detached), 'source:root', 'Update');
    expect(page.nodes.some((node) => node.id === 'failure')).toBe(false);
    expect(page.links.some((link) => link.from === 'guard' && link.to === 'save')).toBe(false);
  });
  it('keeps source schema field unknowns and exact nested contract targets', () => {
    const sourceSchema = {
      kind: 'schema_binding',
      id: 'schema',
      typeName: 'Item',
      direction: 'response',
      properties: [
        {
          name: 'id',
          jsonName: 'id',
          type: 'String',
          source: 'source:root',
          constraints: [],
          views: [],
          presence: 'unknown',
          nullable: 'unknown',
          access: 'declared_field',
          annotations: [],
        },
      ],
      inheritedTypes: [],
      genericArguments: [],
      enumValues: [],
      polymorphism: null,
      completeness: 'partial',
      gaps: [],
      source: 'source:root',
      support: ['source:root'],
      profiles: [],
    } satisfies CurrentScanInput['records'][number];
    const page = visualSchema(context(), sourceSchema);
    expect(page.fields[0]?.required).toBe('unknown');
    expect(page.fields[0]?.nullable).toBe('unknown');
    expect(page.completeSelection).toBe(false);
    const contract = {
      kind: 'contract',
      id: 'wrapper',
      support: ['source:root'],
      shape: { kind: 'reference', target: 'item', spelling: 'Item' },
    } satisfies CurrentScanInput['records'][number];
    const target = { ...contract, id: 'item' };
    const nested = visualSchema(
      context({ ...input, records: [...input.records, contract, target] }),
      contract,
    );
    expect(nested.nodes.find((node) => node.id === 'item')?.target).toBe('page-item.json');
  });
});

it('drills a unique typed source call target and does not infer one by name', () => {
  const calleeDeclaration = {
    kind: 'semantic_node',
    id: 'helper',
    source: 'source:guard',
    owner: 'helper-summary',
    nodeKind: 'function',
    name: 'save',
    syntax: 'def save(): pass',
  } satisfies CurrentScanInput['records'][number];
  const edge = {
    kind: 'semantic_edge',
    id: 'target',
    source: 'source:save',
    owner: 'summary',
    from: 'save',
    to: 'helper',
    relation: 'call_target',
  } satisfies CurrentScanInput['records'][number];
  const selected = { ...input, records: [...input.records, calleeDeclaration, edge] };
  expect(
    visualFlow(context(selected), 'source:root', 'Root').nodes.find((node) => node.id === 'save')
      ?.target,
  ).toBe('page-source-guard.json');
  expect(
    visualFlow(
      context({
        ...selected,
        records: selected.records.filter((record) => record.id !== 'target'),
      }),
      'source:root',
      'Root',
    ).nodes.find((node) => node.id === 'save')?.target,
  ).toBeNull();
  const ambiguous = {
    ...selected,
    records: [...selected.records, { ...edge, id: 'other-target', to: 'root' }],
  };
  expect(
    visualFlow(context(ambiguous), 'source:root', 'Root').nodes.find((node) => node.id === 'save')
      ?.target,
  ).toBeNull();
});

it('keeps deferred cleanup and finally distinct from async dispatch and failure paths', () => {
  const selected: CurrentScanInput = {
    ...input,
    records: [
      ...input.records,
      {
        kind: 'semantic_node',
        id: 'cleanup',
        source: 'source:save',
        owner: 'summary',
        nodeKind: 'defer',
        syntax: 'defer cleanup()',
      },
      {
        kind: 'semantic_node',
        id: 'final-cleanup',
        source: 'source:save',
        owner: 'summary',
        nodeKind: 'call',
        syntax: 'cleanup()',
      },
      {
        kind: 'semantic_edge',
        id: 'deferred',
        source: 'source:root',
        owner: 'summary',
        from: 'root',
        to: 'cleanup',
        relation: 'deferred',
      },
      {
        kind: 'semantic_edge',
        id: 'finally',
        source: 'source:root',
        owner: 'summary',
        from: 'root',
        to: 'final-cleanup',
        relation: 'finally',
      },
    ],
  };
  const page = visualFlow(context(selected), 'source:root', 'Cleanup');
  expect(page.nodes.find((node) => node.id === 'cleanup')?.kind).toBe('call');
  expect(page.links.find((link) => link.to === 'cleanup')?.kind).toBe('control');
  expect(page.links.find((link) => link.to === 'final-cleanup')?.kind).toBe('control');
});

it('shows every declared input and output shape from the native route', () => {
  const selected: CurrentScanInput = {
    ...input,
    records: [
      ...input.records,
      {
        kind: 'aspnet_route_binding',
        id: 'route',
        source: 'source:root',
        support: ['source:root'],
        controller: 'Controller',
        method: 'update',
        httpMethods: ['POST'],
        template: '/update',
        parameters: [],
        status: 'source_declared',
        limitations: ['Source only'],
        input_contract_ids: ['request'],
        output_contract_ids: ['response'],
      },
      ...['request', 'response'].map(
        (id) =>
          ({
            kind: 'contract',
            id,
            support: ['source:root'],
            shape: {
              kind: 'object',
              spelling: id,
              enforcement: 'source',
              fields: [],
              additionalProperties: false,
            },
          }) satisfies CurrentScanInput['records'][number],
      ),
    ],
  };
  const page = visualFlow(context(selected), 'source:root', 'Update');
  expect(page.nodes.filter((node) => node.kind === 'schema').map((node) => node.label)).toEqual([
    'Declared shape: request',
    'Declared shape: response',
  ]);
  expect(
    page.nodes.filter((node) => node.kind === 'schema').every((node) => node.target !== null),
  ).toBe(true);
});
