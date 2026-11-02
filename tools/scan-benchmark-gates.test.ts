import { describe, expect, it } from 'vitest';

import reference from '@/../test/fixtures/scan/benchmark-reference.json' with { type: 'json' };

import { benchmarkGates } from './scan-benchmark-gates';

function trials() {
  const scope = reference.scopes[0];
  if (!scope) throw new Error('Missing frozen benchmark oracle');
  const cold = {
    stats: { blobReads: 2, parsedFiles: 2, indexHits: 0 },
    baseline: { ruleDigest: 'rules', toolchainDigest: 'parser' },
    parserDiagnostics: [],
    retrieval: { complete: true, continued: false },
    evidenceRetrieval: { complete: true, continued: false },
    mutations: scope.questions.flatMap((question) =>
      question.checks.map((check) => ({
        check: check.id,
        applied: true,
        baseline: 'supported',
        mutated: 'failed',
        passed: true,
      })),
    ),
    depth: scope.questions.flatMap((question) =>
      question.checks.map((check) => ({
        id: check.id,
        status: 'supported' as const,
        evidence: ['op:fixture'],
        reason: 'Fixture',
      })),
    ),
  };
  return {
    id: scope.id,
    files: 2,
    cold,
    warm: { ...cold, stats: { blobReads: 0, parsedFiles: 0, indexHits: 2 } },
    rulesChanged: {
      ...cold,
      stats: { blobReads: 0, parsedFiles: 0, indexHits: 2 },
      baseline: { ...cold.baseline, ruleDigest: 'new-rules' },
    },
    parserChanged: {
      ...cold,
      stats: { blobReads: 0, parsedFiles: 2, indexHits: 0 },
      baseline: { ...cold.baseline, toolchainDigest: 'new-parser' },
    },
    incremental: { passed: true },
  };
}

describe('benchmark restart gate', () => {
  it('requires full depth and real cold/warm/rule/parser/delta work', () => {
    expect(benchmarkGates(trials())).toEqual({
      depthPassed: true,
      reusePassed: true,
      integrityPassed: true,
      mutationsPassed: true,
    });
  });

  it('rejects an omitted, duplicated or unresolved check and unknown scope', () => {
    const input = trials();
    const omitted = { ...input.cold, depth: input.cold.depth.slice(1) };
    expect(benchmarkGates({ ...input, cold: omitted }).depthPassed).toBe(false);
    expect(benchmarkGates({ ...input, id: 'unknown' }).depthPassed).toBe(false);
    const duplicate = [...input.cold.depth.slice(1), input.cold.depth[1]!];
    expect(
      benchmarkGates({ ...input, cold: { ...input.cold, depth: duplicate } }).depthPassed,
    ).toBe(false);
    const unresolved = input.warm.depth.map((check) => ({
      ...check,
      status: 'unresolved' as const,
    }));
    expect(
      benchmarkGates({ ...input, warm: { ...input.warm, depth: unresolved } }).depthPassed,
    ).toBe(false);
  });

  it('requires exactly one mutation receipt for every frozen check', () => {
    const input = trials();
    const mutations = input.cold.mutations;
    const missing = mutations.slice(1);
    const duplicate = [...mutations.slice(1), mutations[1]!];
    const unknown = mutations.map((receipt, position) =>
      position === 0 ? { ...receipt, check: 'unknown-check' } : receipt,
    );
    for (const receipts of [[], missing, duplicate, unknown]) {
      expect(
        benchmarkGates({ ...input, cold: { ...input.cold, mutations: receipts } }).mutationsPassed,
      ).toBe(false);
    }
  });

  it.each([
    { name: 'unapplied mutation', patch: { applied: false } },
    { name: 'unsupported baseline', patch: { baseline: 'unresolved' } },
    { name: 'still-supported mutated check', patch: { mutated: 'supported' } },
    { name: 'vanished mutated check', patch: { mutated: 'missing' } },
    { name: 'unrecognised mutated status', patch: { mutated: 'not_examined' } },
    { name: 'failed receipt', patch: { passed: false } },
  ])('rejects $name despite a claimed successful receipt', ({ patch }) => {
    const input = trials();
    const mutations = input.cold.mutations.map((receipt) => ({ ...receipt, ...patch }));
    expect(benchmarkGates({ ...input, cold: { ...input.cold, mutations } }).mutationsPassed).toBe(
      false,
    );
  });

  it.each(['applied', 'baseline', 'mutated'])('rejects a missing mutation %s field', (field) => {
    const input = trials();
    const mutations = input.cold.mutations.map((receipt) => {
      const incomplete = { ...receipt };
      Reflect.deleteProperty(incomplete, field);
      return incomplete;
    });
    expect(benchmarkGates({ ...input, cold: { ...input.cold, mutations } }).mutationsPassed).toBe(
      false,
    );
  });

  it('does not let no-op rule or parser invalidation pass', () => {
    const input = trials();
    expect(benchmarkGates({ ...input, rulesChanged: input.warm }).reusePassed).toBe(false);
    expect(benchmarkGates({ ...input, parserChanged: input.warm }).reusePassed).toBe(false);
    expect(benchmarkGates({ ...input, files: 0 }).reusePassed).toBe(false);
    expect(benchmarkGates({ ...input, incremental: { passed: false } }).reusePassed).toBe(false);
  });

  it('rejects parse diagnostics and incomplete evidence pages', () => {
    const input = trials();
    const parserDiagnostics = ['Unsupported syntax'];
    expect(
      benchmarkGates({ ...input, cold: { ...input.cold, parserDiagnostics } }).integrityPassed,
    ).toBe(false);
    const retrieval = { complete: false, continued: false };
    expect(benchmarkGates({ ...input, cold: { ...input.cold, retrieval } }).integrityPassed).toBe(
      false,
    );
  });
});
