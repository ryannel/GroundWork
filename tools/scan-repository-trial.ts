import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { checkFreshness } from '@/infrastructure/scan/freshness-status';
import type { ScanScope } from '@/infrastructure/scan/scan-scope';
import { publishScopedScan } from '@/infrastructure/scan/scoped-publication';
import { scopedProvenance } from '@/infrastructure/scan/scoped-source-provenance';
import {
  runScopedSources,
  type ScopedSourceOptions,
} from '@/infrastructure/scan/scoped-source-store';

interface RepositoryTrial {
  readonly trial: 'cold' | 'first' | 'warm';
  readonly scope: string;
  readonly generation: string;
  readonly document: string;
  readonly coverage: string;
  readonly extraction: {
    readonly elapsedMs: number;
    readonly cpuMs: number;
    readonly stats: Awaited<ReturnType<typeof runScopedSources>>['stats'];
  };
  readonly freshness: Awaited<ReturnType<typeof checkFreshness>> & { readonly elapsedMs: number };
  readonly counts: {
    readonly selectedFiles: number;
    readonly questions: number;
    readonly receipts: number;
    readonly unresolvedAnswers: number;
    readonly summaries: number;
    readonly semantic: number;
    readonly candidates: number;
    readonly semanticProjectionDuplicates: number;
    readonly diagnostics: readonly { readonly path: string; readonly message: string }[];
  };
  readonly modelCalls: number;
  readonly modelTokens: number;
  readonly publicValidation: string;
  readonly semanticAcceptance: string;
}

interface TrialInput {
  readonly scope: ScanScope;
  readonly output: string;
  readonly options: ScopedSourceOptions;
  readonly trial: 'cold' | 'first' | 'warm';
}

export async function repositoryTrial(input: TrialInput): Promise<RepositoryTrial> {
  const started = performance.now();
  const cpu = process.cpuUsage();
  const result = await runScopedSources(input.scope, input.options);
  const published = await publishScopedScan(input.output, { scope: input.scope, result });
  const cpuUsed = process.cpuUsage(cpu);
  const extraction = {
    elapsedMs: performance.now() - started,
    cpuMs: (cpuUsed.user + cpuUsed.system) / 1000,
    stats: result.stats,
  };
  const freshnessStarted = performance.now();
  const freshness = await checkFreshness({
    repository: path.join(input.options.cloneRoot, input.scope.repo),
    baseline: result.baseline,
    checkedAt: new Date().toISOString(),
    provenance: scopedProvenance(input.scope, input.options),
  });
  const report = {
    trial: input.trial,
    scope: input.scope.id,
    generation: published.generation,
    document: path.join(input.scope.id, published.generation, 'document.json'),
    coverage: path.join(input.scope.id, published.generation, 'coverage.json'),
    extraction,
    freshness: { elapsedMs: performance.now() - freshnessStarted, ...freshness },
    counts: {
      selectedFiles: input.scope.files.length,
      questions: input.scope.questions.length,
      receipts: published.document.receipts.length,
      unresolvedAnswers: published.document.receipts
        .flatMap((receipt) => receipt.answers)
        .filter((answer) => answer.answer.state === 'unresolved').length,
      summaries: published.document.summaries.length,
      semantic: published.document.semantic?.length ?? 0,
      candidates: result.sources.reduce(
        (total, source) => total + source.facts.candidates.length,
        0,
      ),
      semanticProjectionDuplicates: result.sources.reduce(
        (total, source) => total + (source.facts.semanticDiagnostics?.exactDuplicateEdges ?? 0),
        0,
      ),
      diagnostics: result.sources.flatMap((source) =>
        source.index.diagnostics.map((message) => ({ path: source.file.path, message })),
      ),
    },
    modelCalls: 0,
    modelTokens: 0,
    publicValidation: 'passed',
    semanticAcceptance: 'not-established',
  };
  await writeFile(
    path.join(input.output, `${input.trial}-metrics.json`),
    `${JSON.stringify(report, null, 2)}\n`,
    { flag: 'wx' },
  );
  return report;
}
