import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { checkFreshness } from '@/infrastructure/scan/freshness-status';
import { readScanScope } from '@/infrastructure/scan/scan-scope';
import { scopedProvenance } from '@/infrastructure/scan/scoped-source-provenance';
import type { ScopedSourceOptions } from '@/infrastructure/scan/scoped-source-store';

import { benchmarkGates } from './scan-benchmark-gates';
import { benchmarkIncremental } from './scan-benchmark-incremental';
import { benchmarkTrial } from './scan-benchmark-trial';
import { scanArguments } from './scan-cli-args';

const SCOPES = ['spring-write-async', 'go-dispatch-river', 'next-actor-endpoint'];

async function scopeBenchmark(input: {
  readonly id: string;
  readonly cloneRoot: string;
  readonly output: string;
  readonly java?: string;
  readonly go?: string;
}) {
  const scope = await readScanScope(`test/fixtures/scan/scopes/${input.id}.json`);
  const output = path.join(input.output, scope.id);
  const options: ScopedSourceOptions = {
    authority: scope.workspace,
    cloneRoot: input.cloneRoot,
    cacheDirectory: path.join(output, 'cache'),
    ...(input.java === undefined ? {} : { java: input.java }),
    ...(input.go === undefined ? {} : { go: input.go }),
  };
  const cold = await benchmarkTrial({ scope, options, output, publish: true });
  const warm = await benchmarkTrial({ scope, options, output, publish: false });
  const freshnessStarted = performance.now();
  const freshness = await checkFreshness({
    repository: path.join(input.cloneRoot, scope.repo),
    baseline: cold.baseline,
    checkedAt: new Date().toISOString(),
    provenance: scopedProvenance(scope, options),
  });
  const freshnessMs = performance.now() - freshnessStarted;
  const incremental = await benchmarkIncremental(scope, options, output);
  const rulesChanged = await benchmarkTrial({
    scope,
    options: { ...options, ruleVersion: 'benchmark-rule-invalidation/v1' },
    output,
    publish: false,
  });
  const parserChanged = await benchmarkTrial({
    scope,
    options: { ...options, parserVersion: 'benchmark-parser-invalidation/v1' },
    output,
    publish: false,
  });
  return {
    id: scope.id,
    repo: scope.repo,
    commit: scope.commit,
    files: scope.files.length,
    cold,
    warm,
    freshnessMs,
    freshness,
    incremental,
    rulesChanged,
    parserChanged,
  };
}

function benchmarkReport(scopes: readonly Awaited<ReturnType<typeof scopeBenchmark>>[]) {
  const gates = scopes.map((scope) => benchmarkGates(scope));
  const depthPassed = gates.every((gate) => gate.depthPassed);
  const reusePassed = gates.every((gate) => gate.reusePassed);
  const integrityPassed = gates.every((gate) => gate.integrityPassed);
  const mutationsPassed = gates.every((gate) => gate.mutationsPassed);
  return {
    format: 'scan-benchmark/v1',
    widerScans: 'stopped',
    depthPassed,
    reusePassed,
    integrityPassed,
    mutationsPassed,
    implementationModelTokens: 'not_measured',
    oldAgentWorkflowTiming: 'not_measured',
    qualification:
      'Cold means an empty source/index cache; OS/compiler adapter caches may already be warm. Comparison is scripted cold/warm/invalidation, not a measured speedup over prior agent scans. Unresolved depth checks fail the restart gate.',
    scopes,
  };
}

export async function runBenchmark(args: readonly string[]): Promise<void> {
  const parsed = scanArguments(args);
  const [cloneRoot, output] = parsed.positionals;
  if (
    cloneRoot === undefined ||
    output === undefined ||
    parsed.positionals.length !== 2 ||
    parsed.cache !== undefined
  ) {
    throw new Error(
      'Usage: scan:benchmark <clone-root> <NEW-output-directory> [--java executable] [--go executable]',
    );
  }
  await mkdir(output, { recursive: false });
  const input = {
    cloneRoot,
    output,
    ...(parsed.java === undefined ? {} : { java: parsed.java }),
    ...(parsed.go === undefined ? {} : { go: parsed.go }),
  };
  const scopes: Awaited<ReturnType<typeof scopeBenchmark>>[] = [];
  for (const id of SCOPES) {
    const result = await scopeBenchmark({ ...input, id });
    scopes.push(result);
  }
  const report = benchmarkReport(scopes);
  const { depthPassed, reusePassed, integrityPassed, mutationsPassed } = report;
  await writeFile(path.join(output, 'benchmark.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        report: path.join(output, 'benchmark.json'),
        depthPassed,
        reusePassed,
        integrityPassed,
        mutationsPassed,
        scopes: scopes.map((scope) => ({
          id: scope.id,
          coldMs: scope.cold.extractionMs,
          warmMs: scope.warm.extractionMs,
          coldReads: scope.cold.stats.blobReads,
          warmReads: scope.warm.stats.blobReads,
          depthSupported: scope.cold.depth.filter((check) => check.status === 'supported').length,
          depthChecks: scope.cold.depth.length,
        })),
      },
      null,
      2,
    ),
  );
  if ([depthPassed, reusePassed, integrityPassed, mutationsPassed].some((passed) => !passed)) {
    process.exitCode = 2;
  }
}

if (process.argv[1] === import.meta.filename) {
  await runBenchmark(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
