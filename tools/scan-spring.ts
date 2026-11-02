import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { sourceDigest } from '@/infrastructure/scan/source-index';
import { springFrameworkDocument } from '@/infrastructure/scan/spring-framework-document';

import { springBindingInputs } from './scan-spring-inputs';

function argumentsOf(args: readonly string[]) {
  const { positionals, values } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: { cache: { type: 'string' }, 'evidence-method': { type: 'string' } },
  });
  const [capture, cloneRoot, output] = positionals;
  if (capture === undefined || cloneRoot === undefined || output === undefined) {
    throw new Error('Expected capture, clone root and new output directory.');
  }
  if (values.cache === undefined || positionals.length !== 3) {
    throw new Error(
      'Usage: scan:spring <repository-capture> <clone-root> <NEW-output> --cache <directory>',
    );
  }
  const evidenceMethods = (values['evidence-method'] ?? '').split(',').filter(Boolean);
  if (evidenceMethods.length > 256) {
    throw new Error('At most 256 native evidence method names may be selected.');
  }
  return { capture, cloneRoot, output, cache: values.cache, evidenceMethods };
}

async function scanSpring(args: readonly string[]): Promise<void> {
  const input = argumentsOf(args);
  const started = performance.now();
  const gathered = await springBindingInputs(input);
  const document = await springFrameworkDocument(gathered);
  const receipt = {
    format: 'scan-spring/v1',
    capture: path.resolve(input.capture),
    document: document.id,
    checksum: sourceDigest(JSON.stringify(document)),
    baselines: gathered.baselines,
    statistics: gathered.statistics,
    resourceStatistics: gathered.resourceStatistics,
    productionUnits: gathered.units.length,
    selectionRule: 'Java declarations under /src/main/; tests excluded',
    routes: document.framework?.filter((record) => record.kind === 'route_binding').length,
    schemas: document.framework?.filter((record) => record.kind === 'schema_binding').length,
    security: document.framework?.filter((record) => record.kind === 'security_binding').length,
    bindingCounts: Object.fromEntries(
      [...new Set((document.bindings ?? []).map((record) => record.kind))].map((kind) => [
        kind,
        document.bindings?.filter((record) => record.kind === kind).length ?? 0,
      ]),
    ),
    evidenceMethods: input.evidenceMethods,
    selectionDigest: sourceDigest(
      JSON.stringify({ source: '/src/main/', evidenceMethods: input.evidenceMethods }),
    ),
    elapsedMs: performance.now() - started,
    modelCalls: 0,
    modelTokens: 0,
    status: 'source-bindings-only',
  };
  await mkdir(input.output);
  for (const [name, value] of [
    ['document.json', document],
    ['receipt.json', receipt],
  ] as const) {
    await writeFile(path.join(input.output, name), `${JSON.stringify(value, null, 2)}\n`, {
      flag: 'wx',
    });
  }
  console.log(JSON.stringify({ output: input.output, document: document.id }));
}

await scanSpring(process.argv.slice(2));
