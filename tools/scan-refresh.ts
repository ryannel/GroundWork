import path from 'node:path';
import { parseArgs } from 'node:util';

import { readFreshnessBaseline } from '@/infrastructure/scan/freshness-input';
import { checkFreshness, type FreshnessStatus } from '@/infrastructure/scan/freshness-status';
import { readScanScope, type ScanScope } from '@/infrastructure/scan/scan-scope';
import { publishScopedScan } from '@/infrastructure/scan/scoped-publication';
import { currentScopedGeneration } from '@/infrastructure/scan/scoped-selection';
import { scopedProvenance } from '@/infrastructure/scan/scoped-source-provenance';
import { runScopedSources } from '@/infrastructure/scan/scoped-source-store';

const USAGE =
  'Usage: scan:refresh <scope.json> <baseline.json> <clone-root> <output-directory> [--ref local-ref] [--cache directory] [--java executable] [--go executable]';
function requiredArgument(args: readonly string[], position: number): string {
  const argument = args[position];
  if (argument === undefined) throw new Error(USAGE);
  return argument;
}

function unchangedScope(
  scope: ScanScope,
  baseline: Awaited<ReturnType<typeof readFreshnessBaseline>>,
): void {
  if (
    baseline.repo !== scope.repo ||
    baseline.commit !== scope.commit ||
    baseline.ref !== scope.ref
  ) {
    throw new Error('Baseline must belong to the supplied pinned scope and ref.');
  }
}

function refreshArguments(args: readonly string[]) {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      ref: { type: 'string' },
      cache: { type: 'string' },
      java: { type: 'string' },
      go: { type: 'string' },
    },
  });
  if (positionals.length !== 4) throw new Error(USAGE);
  return {
    values,
    scopeFile: requiredArgument(positionals, 0),
    baselineFile: requiredArgument(positionals, 1),
    cloneRoot: requiredArgument(positionals, 2),
    output: requiredArgument(positionals, 3),
  };
}

function refreshable(
  scope: ScanScope,
  status: FreshnessStatus,
): NonNullable<FreshnessStatus['currentBaseline']> {
  if (status.currentBaseline === null || !status.changedFileListKnown) {
    throw new Error(
      'Current local ref or baseline objects are unavailable. No source was fetched and the previous publication remains selected.',
    );
  }
  const selected = new Set(scope.files.map((file) => file.path));
  const retired = status.freshness.changedFiles.filter(
    (change) =>
      (change.status === 'deleted' || change.status === 'renamed') &&
      selected.has(change.previousPath ?? change.path),
  );
  if (retired.length > 0) {
    throw new Error(
      `Selected source was deleted or renamed: ${retired.map((change) => change.previousPath ?? change.path).join(', ')}. Review the explicit scope manifest before refreshing; the previous publication remains selected.`,
    );
  }
  return status.currentBaseline;
}

async function skipCurrentPublication(
  scope: ScanScope,
  status: FreshnessStatus,
  output: string,
): Promise<boolean> {
  if (!status.freshness.sourceCurrent || status.currentBaseline === null) return false;
  const generation = await currentScopedGeneration(output, {
    scope,
    baseline: status.currentBaseline,
  });
  if (generation === null) return false;
  console.log(
    JSON.stringify(
      {
        status: 'partial',
        unchanged: true,
        generation,
        observation: status.freshness.observation,
        stats: {
          blobReads: 0,
          parsedFiles: 0,
          indexHits: 0,
          reusedFiles: scope.files.length,
          sourceBytes: 0,
        },
        message:
          'Source and current analysis provenance match the selected publication. Semantic questions may remain unresolved.',
      },
      null,
      2,
    ),
  );
  return true;
}

export async function refreshScan(args: readonly string[]): Promise<void> {
  const { values, scopeFile, baselineFile, cloneRoot, output } = refreshArguments(args);
  const scope = await readScanScope(scopeFile);
  const baseline = await readFreshnessBaseline(baselineFile);
  unchangedScope(scope, baseline);
  const ref = values.ref ?? scope.ref;
  const currentOptions = {
    authority: scope.workspace,
    ...(values.java === undefined ? {} : { java: values.java }),
    ...(values.go === undefined ? {} : { go: values.go }),
  };
  const status = await checkFreshness({
    repository: path.join(cloneRoot, scope.repo),
    baseline,
    checkedAt: new Date().toISOString(),
    provenance: scopedProvenance(scope, currentOptions),
    ref,
  });
  const current = refreshable(scope, status);
  if (await skipCurrentPublication(scope, status, output)) return;
  const selectedPaths = new Set(scope.files.map((file) => file.path));
  const updatedScope = { ...scope, commit: current.commit, ref };
  const result = await runScopedSources(updatedScope, {
    ...currentOptions,
    cloneRoot,
    cacheDirectory: values.cache ?? path.join(output, 'cache'),
  });
  const publication = await publishScopedScan(output, { scope: updatedScope, result });
  console.log(
    JSON.stringify(
      {
        status: 'partial',
        scope: scope.id,
        generation: publication.generation,
        previousCommit: scope.commit,
        commit: updatedScope.commit,
        observation: status.freshness.observation,
        changedSelectedFiles: status.freshness.changedFiles
          .filter((change) => selectedPaths.has(change.path))
          .map((change) => change.path),
        stats: result.stats,
        message:
          'Refreshed only the explicit source scope. Semantic questions may remain unresolved; no wider repository scan has run.',
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] === import.meta.filename) {
  await refreshScan(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
