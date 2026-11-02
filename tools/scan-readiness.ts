import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { assessRepositoryReadiness } from '@/domain/scan/repository-readiness';
import { immutablePassJson } from '@/infrastructure/scan/repository-pass-files';
import { sourceDigest } from '@/infrastructure/scan/source-index';

import { readReadinessCatalogue } from './scan-readiness-catalogue';
import { loadReadinessEvidence, loadReadinessFiles } from './scan-readiness-load';

/** Verifies current artefacts before the pure assessor. This command never starts repository scans. */
export async function scanReadiness(args: readonly string[]): Promise<void> {
  const [manifest, output] = args;
  if (manifest === undefined || output === undefined || args.length !== 2) {
    throw new Error('Usage: scan:ready <readiness-input.json> <NEW-output>');
  }
  const files = await loadReadinessFiles(manifest);
  const input = {
    ...(await loadReadinessEvidence(files)),
    catalogue: await readReadinessCatalogue(files.catalogue, files.queries),
  };
  const verdict = assessRepositoryReadiness(input);
  const namedFiles = Object.entries(files).flatMap(([name, value]) => {
    if (name === 'format' || name === 'catalogue' || name === 'queries') return [];
    return typeof value === 'string' ? [{ name, path: value }] : [];
  });
  const provenance = await Promise.all(
    namedFiles.map(async (file) => ({
      ...file,
      sha256: sourceDigest(await readFile(file.path, 'utf8')),
    })),
  );
  await mkdir(output);
  await immutablePassJson(path.join(output, 'receipt.json'), {
    format: 'scan-readiness/v1',
    ...verdict,
    repository: input.expectations.repo,
    commit: input.expectations.commit,
    provenance,
    catalogue: files.catalogue,
    queries: files.queries,
    benchmark: {
      scopes: input.benchmark.length,
      checks: input.expectations.scopeChecks.reduce((sum, scope) => sum + scope.checkIds.length, 0),
    },
    sourceUsage: input.sourceUsage,
    interpretation: {
      state: input.interpretation.document.state,
      claims: input.interpretation.document.claims.length,
      modelUsage: verdict.modelBudget,
    },
    qualification:
      'Bounded source workflow readiness; partial source answers and runtime frontiers remain explicit. Interpretation is inferred. Wider scans remain stopped.',
  });
  console.log(JSON.stringify(verdict));
  if (!verdict.fullscanWorkflowReady) process.exitCode = 2;
}
if (process.argv[1] === import.meta.filename) await scanReadiness(process.argv.slice(2));
