import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import { indexSource } from '@/infrastructure/scan/source-index';
import { extractTypescriptSemantics } from '@/infrastructure/scan/typescript-semantics';

import { answerabilityProbe, type Probe } from './scan-answerability-probe';
import { answerabilityRequest } from './scan-answerability-request';
import { semanticGraph } from './scan-semantic-query';

vi.mock(import('server-only'), () => ({}));

function graphOf(content: string) {
  const index = indexSource({ path: 'write.ts', language: 'typescript', content });
  const extracted = extractTypescriptSemantics(index, {
    host: 'host:server',
    repo: 'fixture/repo',
    commit: 'a'.repeat(40),
  });
  return semanticGraph({
    ...scanFixture(),
    semantic: [...extracted.semantic],
    sources: [...extracted.sources],
  });
}

const PROBE: Probe = {
  id: 'equal-write',
  sourcePath: 'write.ts',
  functionName: 'write',
  checks: [
    { kind: 'guard-exit-before-call', expected: 'same', call: 'persist', arguments: [] },
    { kind: 'ordered-calls', expected: 'persist', call: 'publish', arguments: [] },
    { kind: 'call-arguments', expected: '', call: 'persist', arguments: ['customer'] },
  ],
};

describe('bounded native question probes', () => {
  it('finds local owner records and rejects removed control structure with display text unchanged', () => {
    const graph = graphOf(
      'function write(customer, same){if(same){return customer;} persist(customer); publish(customer);}',
    );
    const baseline = answerabilityProbe(graph, PROBE);
    expect(baseline.status).toBe('supported-local-clauses');
    expect(baseline.evidence.length).toBeGreaterThan(10);
    const changed = semanticGraph({
      ...graph.document,
      semantic: (graph.document.semantic ?? []).filter(
        (record) => record.kind !== 'semantic_edge' || record.relation !== 'condition',
      ),
    });
    expect(answerabilityProbe(changed, PROBE).status).toBe('unresolved');
  });

  it('refuses a nested conditional return, a side effect inside the guard and ambiguous functions', () => {
    const nested = graphOf(
      'function write(customer,same){if(same){if(other){return customer;}} persist(customer);publish(customer);}',
    );
    const guarded = graphOf(
      'function write(customer,same){if(same){persist(customer);return customer;}publish(customer);}',
    );
    const ambiguous = graphOf('function write(){} function write(){}');
    expect(answerabilityProbe(nested, PROBE).status).toBe('unresolved');
    expect(answerabilityProbe(guarded, PROBE).status).toBe('unresolved');
    expect(answerabilityProbe(ambiguous, PROBE).matches).toBe(2);
    expect(answerabilityProbe(ambiguous, PROBE).status).toBe('unresolved');
  });

  it('rejects unsafe output names and missing or malformed checks', () => {
    expect(() => answerabilityRequest({ probes: [{ ...PROBE, id: '../escape' }] })).toThrow(
      'Invalid question probe',
    );
    expect(() =>
      answerabilityRequest({ probes: [{ ...PROBE, checks: [{ kind: 'text-search' }] }] }),
    ).toThrow('Invalid question probe');
    expect(answerabilityRequest({ probes: [PROBE] })).toEqual([PROBE]);
  });
});
