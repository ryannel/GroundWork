import reference from '@/../test/fixtures/scan/benchmark-reference.json' with { type: 'json' };
import type { SourceBaseline } from '@/domain/scan/scan.generated';
import type { ScopedSourceStats } from '@/infrastructure/scan/scoped-source-store';

import type { DepthResult } from './scan-benchmark-depth-facts';

interface ComparableTrial {
  readonly stats: Pick<ScopedSourceStats, 'blobReads' | 'parsedFiles' | 'indexHits'>;
  readonly baseline: Pick<SourceBaseline, 'ruleDigest' | 'toolchainDigest'>;
  readonly depth: readonly Pick<DepthResult, 'id' | 'status'>[];
  readonly parserDiagnostics: readonly unknown[];
  readonly retrieval: { readonly complete: boolean; readonly continued: boolean };
  readonly evidenceRetrieval: { readonly complete: boolean; readonly continued: boolean };
}
interface ScopeTrials {
  readonly id: string;
  readonly files: number;
  readonly warm: ComparableTrial;
  readonly rulesChanged: ComparableTrial;
  readonly parserChanged: ComparableTrial;
  readonly incremental: { readonly passed: boolean };
  readonly cold: ComparableTrial & {
    readonly mutations: readonly MutationReceipt[];
  };
}

interface MutationReceipt {
  readonly check: string;
  readonly passed: boolean;
  readonly applied: boolean;
  readonly baseline: string;
  readonly mutated: string;
}

const alphabetical = (left: string, right: string): number => left.localeCompare(right);

function hasDepth(trial: ComparableTrial, expected: readonly string[]): boolean {
  const observed = trial.depth.map((check) => check.id).toSorted(alphabetical);
  return (
    expected.length > 0 &&
    JSON.stringify(observed) === JSON.stringify(expected.toSorted(alphabetical)) &&
    trial.depth.every((check) => check.status === 'supported')
  );
}

function validMutation(receipt: MutationReceipt): boolean {
  return [
    receipt.passed,
    receipt.applied,
    receipt.baseline === 'supported',
    receipt.mutated === 'failed' || receipt.mutated === 'unresolved',
  ].every(Boolean);
}

/** A no-op invalidation and an omitted semantic check must both fail the restart gate. */
export function benchmarkGates(input: ScopeTrials): {
  readonly depthPassed: boolean;
  readonly reusePassed: boolean;
  readonly integrityPassed: boolean;
  readonly mutationsPassed: boolean;
} {
  const expected =
    reference.scopes
      .find((scope) => scope.id === input.id)
      ?.questions.flatMap((question) => question.checks.map((check) => check.id)) ?? [];
  const { cold, warm, rulesChanged: rules, parserChanged: parser } = input;
  return {
    mutationsPassed:
      expected.length > 0 &&
      JSON.stringify(input.cold.mutations.map((check) => check.check).toSorted(alphabetical)) ===
        JSON.stringify(expected.toSorted(alphabetical)) &&
      input.cold.mutations.every(validMutation),
    integrityPassed: [cold, warm, rules, parser].every((trial) =>
      [
        trial.parserDiagnostics.length === 0,
        trial.retrieval.complete,
        !trial.retrieval.continued,
        trial.evidenceRetrieval.complete,
        !trial.evidenceRetrieval.continued,
      ].every(Boolean),
    ),
    depthPassed: [cold, warm, rules, parser].every((trial) => hasDepth(trial, expected)),
    reusePassed: [
      input.files > 0,
      cold.stats.blobReads === input.files,
      cold.stats.parsedFiles === input.files,
      warm.stats.blobReads === 0,
      warm.stats.parsedFiles === 0,
      warm.stats.indexHits === input.files,
      rules.stats.blobReads === 0,
      rules.stats.parsedFiles === 0,
      rules.stats.indexHits === input.files,
      rules.baseline.ruleDigest !== cold.baseline.ruleDigest,
      parser.stats.blobReads === 0,
      parser.stats.parsedFiles === input.files,
      parser.stats.indexHits === 0,
      parser.baseline.toolchainDigest !== cold.baseline.toolchainDigest,
      input.incremental.passed,
    ].every(Boolean),
  };
}
