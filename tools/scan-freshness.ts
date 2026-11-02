import { parseArgs } from 'node:util';

import {
  readFreshnessBaseline,
  readFreshnessProvenance,
} from '@/infrastructure/scan/freshness-input';
import { checkFreshness, type CurrentProvenance } from '@/infrastructure/scan/freshness-status';
import { readScanScope } from '@/infrastructure/scan/scan-scope';
import { scopedProvenance } from '@/infrastructure/scan/scoped-source-provenance';

async function provenanceFor(
  values: {
    readonly provenance?: string | undefined;
    readonly scope?: string | undefined;
    readonly java?: string | undefined;
    readonly go?: string | undefined;
  },
  repo: string,
): Promise<CurrentProvenance | undefined> {
  if (values.provenance !== undefined && values.scope !== undefined) {
    throw new Error('Choose --scope or --provenance, not both.');
  }
  if (values.provenance !== undefined) return readFreshnessProvenance(values.provenance);
  if (values.scope === undefined) return undefined;
  const scope = await readScanScope(values.scope);
  if (scope.repo !== repo) throw new Error('--scope must belong to the baseline repository.');
  return scopedProvenance(scope, {
    authority: scope.workspace,
    ...(values.java === undefined ? {} : { java: values.java }),
    ...(values.go === undefined ? {} : { go: values.go }),
  });
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      ref: { type: 'string' },
      remote: { type: 'string' },
      provenance: { type: 'string' },
      scope: { type: 'string' },
      java: { type: 'string' },
      go: { type: 'string' },
    },
  });
  const [baselineFile, repository] = positionals;
  if (baselineFile === undefined || repository === undefined || positionals.length !== 2) {
    throw new Error(
      'Usage: scan:freshness <baseline.json> <repoDir> [--ref refs/heads/main] [--remote origin] [--scope scope.json | --provenance current-provenance.json] [--java executable] [--go executable]',
    );
  }
  const baseline = await readFreshnessBaseline(baselineFile);
  const provenance = await provenanceFor(values, baseline.repo);
  const result = await checkFreshness({
    repository,
    baseline,
    checkedAt: new Date().toISOString(),
    ...(values.ref === undefined ? {} : { ref: values.ref }),
    ...(values.remote === undefined ? {} : { remote: values.remote }),
    ...(provenance === undefined ? {} : { provenance }),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Freshness check failed.'}\n`);
  process.exitCode = 1;
});
