import path from 'node:path';

import { readScanScope } from '@/infrastructure/scan/scan-scope';
import { publishScopedScan } from '@/infrastructure/scan/scoped-publication';
import { runScopedSources } from '@/infrastructure/scan/scoped-source-store';

import { scanArguments } from './scan-cli-args';

export async function runScan(args: readonly string[]): Promise<void> {
  const parsed = scanArguments(args);
  const [file, cloneRoot, output] = parsed.positionals;
  if (
    file === undefined ||
    cloneRoot === undefined ||
    output === undefined ||
    parsed.positionals.length !== 3
  ) {
    throw new Error(
      'Usage: scan:run <scope.json> <clone-root> <output-directory> [--cache directory] [--java executable] [--go executable]',
    );
  }
  const scope = await readScanScope(file);
  const started = performance.now();
  const result = await runScopedSources(scope, {
    authority: scope.workspace,
    cloneRoot,
    cacheDirectory: parsed.cache ?? path.join(output, 'cache'),
    ...(parsed.java === undefined ? {} : { java: parsed.java }),
    ...(parsed.go === undefined ? {} : { go: parsed.go }),
  });
  const published = await publishScopedScan(output, { scope, result });
  console.log(
    JSON.stringify(
      {
        status: 'partial',
        scope: scope.id,
        generation: published.generation,
        elapsedMs: performance.now() - started,
        stats: result.stats,
        message:
          'Validated source/local-symbol capture. Required semantic questions may remain unresolved; this is not repository completion.',
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] === import.meta.filename) {
  await runScan(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
