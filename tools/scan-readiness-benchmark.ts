import reference from '@/../test/fixtures/scan/benchmark-reference.json' with { type: 'json' };
import type {
  ReadinessBenchmark,
  ReadinessCheck,
  ReadinessCheckStatus,
} from '@/domain/scan/repository-readiness-types';
import { readScanScope } from '@/infrastructure/scan/scan-scope';
import { scopedProvenance } from '@/infrastructure/scan/scoped-source-provenance';

import { benchmarkGates } from './scan-benchmark-gates';
import {
  readinessArray,
  readinessNumber,
  readinessObject,
  readinessString,
} from './scan-readiness-value';

function status(value: unknown): ReadinessCheckStatus {
  if (value !== 'supported' && value !== 'failed' && value !== 'unresolved') {
    throw new Error('Unknown depth check status.');
  }
  return value;
}
function checks(value: unknown): readonly ReadinessCheck[] {
  return readinessArray(value).map((item) => {
    const row = readinessObject(item);
    return { id: readinessString(row.id), status: status(row.status) };
  });
}
function trial(value: unknown) {
  const row = readinessObject(value);
  const stats = readinessObject(row.stats);
  const baseline = readinessObject(row.baseline);
  const retrieval = readinessObject(row.retrieval);
  const evidence = readinessObject(row.evidenceRetrieval);
  return {
    stats: {
      blobReads: readinessNumber(stats.blobReads),
      parsedFiles: readinessNumber(stats.parsedFiles),
      indexHits: readinessNumber(stats.indexHits),
    },
    baseline: {
      ruleDigest: readinessString(baseline.ruleDigest),
      toolchainDigest: readinessString(baseline.toolchainDigest),
    },
    depth: checks(row.depth),
    parserDiagnostics: readinessArray(row.parserDiagnostics),
    retrieval: { complete: retrieval.complete === true, continued: retrieval.continued === true },
    evidenceRetrieval: {
      complete: evidence.complete === true,
      continued: evidence.continued === true,
    },
  };
}
function mutations(value: unknown) {
  return readinessArray(value).map((item) => {
    const row = readinessObject(item);
    return {
      check: readinessString(row.check),
      passed: row.passed === true,
      applied: row.applied === true,
      baseline: status(row.baseline),
      mutated: status(row.mutated),
    };
  });
}

export function readinessBenchmark(report: unknown): readonly ReadinessBenchmark[] {
  return readinessArray(readinessObject(report).scopes).map((value) => {
    const row = readinessObject(value);
    const cold = { ...trial(row.cold), mutations: mutations(readinessObject(row.cold).mutations) };
    const warm = trial(row.warm);
    const rulesChanged = trial(row.rulesChanged);
    const parserChanged = trial(row.parserChanged);
    const id = readinessString(row.id);
    const gates = benchmarkGates({
      id,
      files: readinessNumber(row.files),
      cold,
      warm,
      rulesChanged,
      parserChanged,
      incremental: { passed: readinessObject(row.incremental).passed === true },
    });
    return {
      scopeId: id,
      phases: {
        cold: cold.depth,
        warm: warm.depth,
        rulesChanged: rulesChanged.depth,
        parserChanged: parserChanged.depth,
      },
      mutations: cold.mutations.map((entry) => ({
        checkId: entry.check,
        applied: entry.applied && entry.passed,
        baseline: entry.baseline,
        mutated: entry.mutated,
      })),
      integrityPassed: gates.integrityPassed && gates.depthPassed && gates.mutationsPassed,
      reusePassed: gates.reusePassed,
    };
  });
}

export function readinessScopeExpectations(): readonly {
  readonly scopeId: string;
  readonly checkIds: readonly string[];
}[] {
  return reference.scopes.map((scope) => ({
    scopeId: scope.id,
    checkIds: scope.questions.flatMap((question) => question.checks.map((check) => check.id)),
  }));
}

export async function verifyReadinessBenchmark(report: unknown): Promise<void> {
  const rows = readinessArray(readinessObject(report).scopes).map(readinessObject);
  await Promise.all(
    rows.map(async (row) => {
      const id = readinessString(row.id);
      if (!reference.scopes.some((scope) => scope.id === id)) {
        throw new Error('Unknown benchmark scope.');
      }
      const scope = await readScanScope(`test/fixtures/scan/scopes/${id}.json`);
      if (
        row.repo !== scope.repo ||
        row.commit !== scope.commit ||
        row.files !== scope.files.length
      ) {
        throw new Error('Benchmark source pin or file denominator changed.');
      }
      for (const phase of ['cold', 'warm', 'rulesChanged', 'parserChanged']) {
        const baseline = readinessObject(readinessObject(row[phase]).baseline);
        const current = scopedProvenance(scope, {
          authority: scope.workspace,
          ...(phase === 'rulesChanged' ? { ruleVersion: 'benchmark-rule-invalidation/v1' } : {}),
          ...(phase === 'parserChanged'
            ? { parserVersion: 'benchmark-parser-invalidation/v1' }
            : {}),
        });
        if (!Object.entries(current).every(([key, value]) => baseline[key] === value)) {
          throw new Error('Benchmark analysis is stale; rerun the fixed scopes.');
        }
      }
    }),
  );
}
