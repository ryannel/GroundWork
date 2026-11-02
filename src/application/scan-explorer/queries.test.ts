import { describe, expect, it } from 'vitest';

import { recordIndexes, type KnowledgeReader } from '@/domain/knowledge/knowledge-reader';
import type {
  EntryBinding,
  InterfaceContract,
  KnowledgeRecord,
  RuntimeComponent,
  Interaction,
} from '@/domain/knowledge/knowledge.generated';
import { interactionCorrespondence } from '@/domain/scan-explorer/correspondence';

import { buildScanExplorer } from './build-index';
import { callers, dataInspection, serviceOverview } from './queries';

const evidence: KnowledgeRecord = {
  id: 'ev',
  kind: 'evidence',
  host: 'github.com',
  repo: 'org/source',
  commit: 'a'.repeat(40),
  path: 'src/main.ts',
  lines: [1, 4],
  basis: 'source',
};
const host: RuntimeComponent = {
  id: 'provider',
  kind: 'runtime_component',
  logicalId: 'service:provider',
  label: 'Provider',
  category: 'service',
  technology: 'Node',
  sources: ['ev'],
  basis: 'source_declared',
  gaps: [],
  evidence: ['ev'],
};
const contract: InterfaceContract = {
  id: 'caller-contract',
  kind: 'interface_contract',
  component: 'provider',
  protocol: 'http',
  name: 'Get',
  method: 'GET',
  path: '/items',
  authority: 'caller_construction',
  request: [],
  responses: [],
  gaps: [],
  evidence: ['ev'],
};
const exposure: EntryBinding = {
  id: 'exposure',
  kind: 'entry_binding',
  entry: 'entry',
  execution: 'execution',
  contract: 'provider-contract',
  gaps: [],
  evidence: ['ev'],
};
const interaction: Interaction = {
  id: 'call',
  kind: 'interaction',
  owner: 'impl',
  execution: 'execution',
  operation: 'op',
  target: 'provider',
  targetEntry: 'entry',
  contract: 'caller-contract',
  effect: null,
  handoff: null,
  mode: 'request_response',
  boundary: 'network',
  waitsFor: 'response',
  condition: 'only on success',
  requestBindings: [],
  responseBindings: [],
  gaps: [],
  evidence: ['ev'],
};

function reader(records: readonly KnowledgeRecord[], snapshot = 'snapshot'): KnowledgeReader {
  return {
    snapshot,
    rules: 'knowledge-query/v3',
    get: (id) => records.find((record) => record.id === id),
    select: (key, value) =>
      records.filter((record) => recordIndexes(record).get(key)?.includes(value) === true),
  };
}

function fixture(
  changes: Partial<InterfaceContract> = {},
  extras: readonly KnowledgeRecord[] = [],
): ReturnType<typeof buildScanExplorer> {
  return buildScanExplorer([
    {
      reader: reader([
        evidence,
        host,
        { ...host, id: 'caller', logicalId: 'service:caller' },
        contract,
        { ...contract, id: 'provider-contract', authority: 'source_declared', ...changes },
        exposure,
        interaction,
        {
          id: 'execution',
          kind: 'execution_binding',
          implementation: 'impl',
          component: 'caller',
          basis: 'source_declared',
          artifactBinding: null,
          gaps: [],
          evidence: ['ev'],
        },
        ...extras,
      ]),
      scope: 'selected source',
      completeness: 'partial',
      limitations: ['Other callers are not examined'],
    },
  ]);
}

describe('disposable canonical service explorer', () => {
  it('retains caller and provider contracts separately in confirmed reverse answers', () => {
    const result = callers(fixture(), { component: 'service:provider', limit: 20 });
    expect(result.items[0]?.status).toBe('confirmed');
    expect(result.items[0]?.callerContract?.record.authority).toBe('caller_construction');
    expect(result.items[0]?.providerContract?.record.authority).toBe('source_declared');
    expect(result.items[0]?.interaction.record.condition).toBe('only on success');
    expect(result.items[0]?.payloadCompatibility).toBe('not_checked');
    expect(result.deployment).toBe('not_verified');
    expect(result.exhaustive).toBe(false);
    expect(result.coverage[0]?.limitations).toEqual(['Other callers are not examined']);
    expect(result.sourceLinks[0]?.url).toContain(`/blob/${'a'.repeat(40)}/src/main.ts#L1-L4`);
  });

  it.each([{ method: 'POST' }, { path: '/other' }, { protocol: 'https' }])(
    'does not match changed address %o',
    (change) => {
      const result = callers(fixture(change), { component: 'provider', limit: 20 });
      expect(result.items.map((match) => match.status)).toEqual(['unresolved']);
    },
  );

  it('does not turn a matching path at the wrong host into a confirmed caller', () => {
    const result = callers(
      fixture({ component: 'different' }, [
        { ...host, id: 'different', logicalId: 'service:different' },
      ]),
      { component: 'different', limit: 20 },
    );
    expect(result.items[0]?.status).toBe('candidate');
  });

  it('retains schema version mismatch and candidate authority as candidates', () => {
    expect(
      callers(fixture({ version: 'v2' }), { component: 'provider', limit: 20 }).items[0]?.status,
    ).toBe('candidate');
    expect(
      callers(fixture({ authority: 'candidate' }), { component: 'provider', limit: 20 }).items[0]
        ?.status,
    ).toBe('candidate');
  });

  it('retains duplicate route exposures as ambiguous', () => {
    const index = fixture({}, [{ ...exposure, id: 'second', entry: 'entry-2' }]);
    expect(
      callers(index, { component: 'provider', limit: 20 }).items.map((match) => match.status),
    ).toEqual(['ambiguous', 'ambiguous']);
  });

  it('does not manufacture a host from scope or repository names', () => {
    const index = buildScanExplorer([
      {
        reader: reader([evidence]),
        scope: 'spring-framework:source',
        completeness: 'partial',
        limitations: [],
      },
    ]);
    expect(
      serviceOverview(index, { component: 'spring-framework:source', limit: 10 }).items,
    ).toEqual([]);
    expect(index.components).toEqual([]);
  });

  it('bounds and pages inspection without changing the canonical records', () => {
    const index = fixture();
    const first = dataInspection(index, {
      snapshot: 'snapshot',
      ids: ['caller-contract', 'provider-contract'],
      limit: 1,
    });
    expect(first.items[0]?.record).toBe(contract);
    expect(first.nextOffset).toBe(1);
    expect(first.truncated).toBe(true);
    const second = dataInspection(index, {
      snapshot: 'snapshot',
      ids: ['caller-contract', 'provider-contract'],
      limit: 1,
      offset: 1,
    });
    expect(second.items[0]?.record.id).toBe('provider-contract');
    expect(second.nextOffset).toBeNull();
    expect(() =>
      dataInspection(index, { snapshot: 'snapshot', ids: ['missing'], limit: 10 }),
    ).toThrow('Unknown explorer record');
    expect(() => callers(index, { component: 'provider', limit: 0 })).toThrow('Explorer limit');
    expect(() => callers(index, { component: 'provider', limit: 10, offset: -1 })).toThrow(
      'offset',
    );
  });

  it('rejects duplicate snapshot selection and preserves unresolved calls', () => {
    const index = fixture({ path: '/unmatched' });
    expect(
      interactionCorrespondence(index, {
        snapshot: 'snapshot',
        record: { ...interaction, contract: 'absent', target: null },
      })[0]?.status,
    ).toBe('unresolved');
    expect(() => buildScanExplorer([...index.selections, ...index.selections])).toThrow(
      'Duplicate',
    );
  });
});
