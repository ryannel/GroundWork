import { describe, expect, it } from 'vitest';

import type {
  SpringSchemaBinding,
  SpringDeclaredProperty,
  Source,
} from '@/domain/scan/scan.generated';
import type { CurrentRecord } from '@/domain/scan-explorer/current-contracts';
import { explorerPage } from '@/domain/service-explorer-check';

import { visualSchema } from './visual-schema';
import type { VisualContext } from './visual-types';

function schema(
  id: string,
  typeName: string,
  properties: readonly SpringDeclaredProperty[] = [],
): SpringSchemaBinding {
  return {
    kind: 'schema_binding',
    id,
    typeName,
    direction: 'source',
    properties: [...properties],
    inheritedTypes: [],
    genericArguments: [],
    enumValues: [],
    polymorphism: null,
    completeness: 'complete',
    gaps: [],
    source: `source:${id}`,
    support: [`source:${id}`],
    profiles: [],
  };
}
function field(type: string): SpringDeclaredProperty {
  return {
    name: 'fleetAccount',
    jsonName: 'fleetAccount',
    type,
    source: 'source:field',
    constraints: [],
    views: [],
    presence: 'unknown',
    nullable: 'unknown',
    access: 'declared_field',
    annotations: [],
  };
}
function context(records: readonly CurrentRecord[]): VisualContext {
  const sources = [...records.map((record) => `source:${record.id}`), 'source:field'].map(
    (id): Source => ({
      kind: 'source',
      id,
      repo: 'org/service',
      path: 'api/Types.java',
      commit: 'a'.repeat(40),
      blob: 'b'.repeat(40),
      lines: [1, 4],
      host: 'host',
      authority: 'declared',
    }),
  );
  return {
    snapshot: 'selected',
    input: {
      snapshot: 'selected',
      records,
      sources,
      binding: {
        component: {
          id: 'runtime',
          kind: 'runtime_component',
          logicalId: 'service',
          label: 'Service',
          category: 'service',
          technology: 'Java',
          sources: ['source:response'],
          basis: 'source_declared',
          evidence: ['source:response'],
          gaps: [],
        },
        repo: 'org/service',
        commit: 'a'.repeat(40),
        declarations: [],
        modulePaths: ['api/'],
        verification: 'pinned_runtime_declaration',
        limitations: [],
      },
      coverage: [],
    },
    files: new Map(records.map((record, index) => [record.id, `schema-${String(index)}.json`])),
    recordsAt: new Map(),
    nodes: new Map(),
    edges: new Map(),
    entries: [],
    purpose: {
      label: 'Inferred',
      statement: 'Fixture purpose',
      confidence: 'medium',
      claim: 'purpose',
    },
  };
}

describe('nested source schema navigation', () => {
  it('draws pinned Spring fields and offers an explicitly unqualified candidate', () => {
    const response = schema('response', 'com.fleet.FleetAccountResponse', [field('FleetAccount')]);
    const account = schema('account', 'com.fleet.FleetAccount');
    const page = visualSchema(context([response, account]), response);
    expect(explorerPage(page)).toBe(page);
    expect(
      page.nodes.find((node) => node.label === 'fleetAccount: FleetAccount')?.sourceIds,
    ).toEqual(['source:field']);
    expect(
      page.nodes.find((node) => node.label === 'Candidate: com.fleet.FleetAccount')?.target,
    ).toBe('schema-1.json');
    expect(page.fields[0]?.required).toBe('unknown');
    expect(page.fields[0]?.nullable).toBe('unknown');
    expect(
      page.links.some((link) => link.label === 'candidate type; qualification unresolved'),
    ).toBe(true);
    expect(page.completeSelection).toBe(false);
  });
  it('retains every same-name candidate and never picks the first as an exact join', () => {
    const response = schema('response', 'com.fleet.Response', [field('FleetAccount')]);
    const page = visualSchema(
      context([
        response,
        schema('first', 'com.first.FleetAccount'),
        schema('second', 'com.second.FleetAccount'),
      ]),
      response,
    );
    expect(
      page.nodes.filter((node) => node.label.startsWith('Candidate:')).map((node) => node.target),
    ).toEqual(['schema-1.json', 'schema-2.json']);
    expect(page.links.some((link) => link.label === 'qualified source type')).toBe(false);
    expect(page.gaps.some((gap) => gap.includes('2 source candidate(s)'))).toBe(true);
  });
  it('uses an exact qualified type without falling back to another namespace', () => {
    const response = schema('response', 'com.fleet.Response', [field('com.first.FleetAccount')]);
    const first = schema('first', 'com.first.FleetAccount');
    const second = schema('second', 'com.second.FleetAccount');
    const page = visualSchema(context([response, first, second]), response);
    expect(
      page.nodes.find((node) => node.label === 'Declared type: com.first.FleetAccount')?.target,
    ).toBe('schema-1.json');
    expect(
      visualSchema(context([response, second]), response).nodes.some(
        (node) => node.target !== null,
      ),
    ).toBe(false);
  });
  it('labels C# reference targets with their declared spelling while preserving identity', () => {
    const wrapper = {
      kind: 'contract',
      id: 'wrapper',
      support: ['source:wrapper'],
      shape: { kind: 'reference', target: 'hashed-id', spelling: 'Item' },
    } satisfies CurrentRecord;
    const target = {
      kind: 'contract',
      id: 'hashed-id',
      support: ['source:hashed-id'],
      shape: {
        kind: 'object',
        fields: [],
        additionalProperties: false,
        spelling: 'Gpe.PreTax.Dto.Item',
        enforcement: 'source',
      },
    } satisfies CurrentRecord;
    const page = visualSchema(context([wrapper, target]), wrapper);
    expect(page.nodes.find((node) => node.id === 'hashed-id')?.label).toBe('Gpe.PreTax.Dto.Item');
    expect(page.nodes.find((node) => node.id === 'hashed-id')?.target).toBe('schema-1.json');
  });
});
