import { appendFile, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  planFreshnessInvalidation,
  type FreshnessFact,
  type FreshnessInvalidation,
} from '@/domain/scan/freshness-plan';
import type { FreshnessResult } from '@/domain/scan/scan.generated';
import { assessFreshness, observeRef } from '@/infrastructure/scan/freshness-git';
import type { ScanScope } from '@/infrastructure/scan/scan-scope';
import {
  runScopedSources,
  type ScopedSourceOptions,
  type ScopedSources,
  type ScopedSourceStats,
} from '@/infrastructure/scan/scoped-source-store';

import {
  createBenchmarkFixture,
  commitFixture,
  fixturePath,
  type IncrementalFixture,
} from './scan-benchmark-fixture';

interface IncrementalTrial {
  readonly elapsedMs: number;
  readonly cpuMicros: { readonly user: number; readonly system: number };
  readonly stats: ScopedSourceStats;
}
interface IncrementalChange extends IncrementalTrial {
  readonly freshness: FreshnessResult;
  readonly invalidation: FreshnessInvalidation;
  readonly anchorsRefreshed: boolean;
  readonly passed: boolean;
}
interface IncrementalResult {
  readonly authority: 'synthetic_fixture';
  readonly qualification: string;
  readonly sourceCacheStats: ScopedSourceStats;
  readonly baseline: IncrementalTrial;
  readonly singleFileChange: IncrementalChange;
  readonly sameBlobRename: IncrementalChange;
  readonly passed: boolean;
  readonly runtimeModelCalls: 0;
  readonly runtimeModelTokens: 0;
}
interface TimedSources {
  readonly trial: IncrementalTrial;
  readonly result: ScopedSources;
}
async function timedSources(scope: ScanScope, options: ScopedSourceOptions): Promise<TimedSources> {
  const started = performance.now();
  const cpu = process.cpuUsage();
  const result = await runScopedSources(scope, options);
  return {
    result,
    trial: {
      elapsedMs: performance.now() - started,
      cpuMicros: process.cpuUsage(cpu),
      stats: result.stats,
    },
  };
}

function freshnessFacts(scope: ScanScope, sources: ScopedSources): readonly FreshnessFact[] {
  return sources.sources.flatMap((source) => [
    {
      id: `fixture-file:${source.file.path}`,
      paths: [source.file.path],
      dependsOn: [],
      negativeSearches: [],
      scope: scope.id,
      closureComplete: false,
    },
    ...source.facts.summaries.map((summary) => ({
      id: summary.id,
      paths: [source.file.path],
      dependsOn: summary.operations.flatMap((operation) =>
        operation.kind === 'call' && operation.target.state === 'supported'
          ? operation.target.value
          : [],
      ),
      negativeSearches: [],
      scope: scope.id,
      closureComplete: false,
    })),
  ]);
}

async function inspectChange(input: {
  readonly fixture: IncrementalFixture;
  readonly previous: ScopedSources;
  readonly scope: ScanScope;
  readonly renamePath?: string;
}): Promise<{ readonly measured: TimedSources; readonly change: IncrementalChange }> {
  const measured = await timedSources(input.scope, input.fixture.options);
  const observation = await observeRef({
    repository: input.fixture.repository,
    ref: input.scope.ref,
    checkedAt: new Date().toISOString(),
  });
  const freshness = await assessFreshness({
    repository: input.fixture.repository,
    baseline: input.previous.baseline,
    current: measured.result.baseline,
    observation,
    provenanceComplete: false,
  });
  const invalidation = planFreshnessInvalidation({
    changes: freshness.changedFiles,
    facts: freshnessFacts(input.scope, input.previous),
  });
  const anchorsRefreshed = anchorsCurrent(measured.result, input.renamePath, input.scope.commit);
  const passed = changePassed({
    stats: measured.trial.stats,
    files: input.scope.files.length,
    freshness,
    invalidation,
    renamePath: input.renamePath,
    anchorsRefreshed,
  });
  return {
    measured,
    change: { ...measured.trial, freshness, invalidation, anchorsRefreshed, passed },
  };
}

function anchorsCurrent(
  sources: ScopedSources,
  target: string | undefined,
  revision: string,
): boolean {
  if (target === undefined) return true;
  return sources.sources.some(
    (source) =>
      source.file.path === target &&
      source.index.path === target &&
      source.facts.sources.every(
        (anchor) =>
          anchor.path === target && anchor.commit === revision && anchor.blob === source.blob,
      ),
  );
}

function changePassed(input: {
  readonly stats: ScopedSourceStats;
  readonly files: number;
  readonly freshness: FreshnessResult;
  readonly invalidation: FreshnessInvalidation;
  readonly renamePath: string | undefined;
  readonly anchorsRefreshed: boolean;
}): boolean {
  const expected = input.renamePath === undefined ? 1 : 0;
  const renameValid =
    input.renamePath === undefined ||
    input.invalidation.refreshedAnchors.includes(input.renamePath);
  return [
    input.stats.blobReads === expected,
    input.stats.parsedFiles === expected,
    input.stats.reusedFiles === input.files - expected,
    input.freshness.changedFiles.length === 1,
    input.invalidation.changedFilesToParse.length === expected,
    input.invalidation.invalidatedFacts.length > 0,
    renameValid,
    input.anchorsRefreshed,
  ].every(Boolean);
}

function renamedScope(
  scope: ScanScope,
  change: {
    readonly previous: string;
    readonly next: string;
    readonly revision: string;
  },
): ScanScope {
  return {
    ...scope,
    commit: change.revision,
    files: scope.files.map((file) =>
      file.path === change.previous ? { ...file, path: change.next } : file,
    ),
    questions: scope.questions.map((question) =>
      question.path === change.previous ? { ...question, path: change.next } : question,
    ),
  };
}

async function fixtureBenchmark(
  fixture: IncrementalFixture,
): Promise<Omit<IncrementalResult, 'sourceCacheStats' | 'passed'>> {
  const first = fixture.scope.files[0];
  if (!first) throw new Error('Incremental benchmark requires a selected source file.');
  const baseline = await timedSources(fixture.scope, fixture.options);
  await appendFile(fixturePath(fixture.repository, first.path), '\n');
  const changedScope = {
    ...fixture.scope,
    commit: commitFixture(fixture.repository, 'Synthetic newline-only source change'),
  };
  const changed = await inspectChange({ fixture, previous: baseline.result, scope: changedScope });
  const extension = path.extname(first.path);
  const stem = extension === '' ? first.path : first.path.slice(0, -extension.length);
  const nextPath = `${stem}.fixture-renamed${extension}`;
  if (fixture.scope.files.some((file) => file.path === nextPath)) {
    throw new Error('Fixture rename path already exists.');
  }
  await rename(
    fixturePath(fixture.repository, first.path),
    fixturePath(fixture.repository, nextPath),
  );
  const renamed = renamedScope(changedScope, {
    previous: first.path,
    next: nextPath,
    revision: commitFixture(fixture.repository, 'Synthetic same-blob rename'),
  });
  const moved = await inspectChange({
    fixture,
    previous: changed.measured.result,
    scope: renamed,
    renamePath: nextPath,
  });
  return {
    authority: 'synthetic_fixture',
    qualification:
      'Newline-only source change and same-blob rename test incremental mechanics; they establish no semantic depth or runtime behaviour.',
    baseline: baseline.trial,
    singleFileChange: changed.change,
    sameBlobRename: moved.change,
    runtimeModelCalls: 0,
    runtimeModelTokens: 0,
  };
}

/** Only selected cached bytes enter a temporary Git repository; original clones are read-only. */
export async function benchmarkIncremental(
  scope: ScanScope,
  options: ScopedSourceOptions,
  output: string,
): Promise<IncrementalResult> {
  const selected = await runScopedSources(scope, options);
  const directory = await mkdtemp(path.join(tmpdir(), 'groundwork-incremental-'));
  try {
    const fixture = await createBenchmarkFixture({ scope, options, selected, directory });
    const result = await fixtureBenchmark(fixture);
    const sourceCacheReady = selected.stats.blobReads === 0 && selected.stats.parsedFiles === 0;
    const report: IncrementalResult = {
      ...result,
      sourceCacheStats: selected.stats,
      passed: sourceCacheReady && result.singleFileChange.passed && result.sameBlobRename.passed,
    };
    await mkdir(output, { recursive: true });
    await writeFile(path.join(output, 'incremental.json'), `${JSON.stringify(report, null, 2)}\n`);
    return report;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
