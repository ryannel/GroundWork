import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ScanDocument } from '@/domain/scan/scan.generated';
import { csharpProgramDocument } from '@/infrastructure/scan/csharp-program-document';
import { writeFramedScanDocument } from '@/infrastructure/scan/framed-scan-document';
import { repositoryPassJson } from '@/infrastructure/scan/repository-pass-files';
import { scanValidator } from '@/infrastructure/scan/scan-format';
import { readScanScope } from '@/infrastructure/scan/scan-scope';
import { assertScopeCoverage } from '@/infrastructure/scan/scope-coverage';
import { runScopedSources } from '@/infrastructure/scan/scoped-source-store';
import { sourceDigest } from '@/infrastructure/scan/source-index';

const DOCUMENT_FILE = 'document.json';
interface Inputs {
  readonly format: 'scan-csharp-program-inputs/v1';
  readonly cloneRoot: string;
  readonly cacheDirectory: string;
  readonly shards: readonly string[];
}
function record(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}
function textField(value: Readonly<Record<string, unknown>>, field: string): string {
  const result = value[field];
  if (typeof result !== 'string' || result.length === 0) throw new Error(`Missing ${field}.`);
  return result;
}
export function csharpProgramInputs(value: unknown): Inputs {
  if (!record(value) || value.format !== 'scan-csharp-program-inputs/v1') {
    throw new Error('Expected C# program input manifest.');
  }
  if (
    Object.keys(value).some(
      (key) => !['format', 'cloneRoot', 'cacheDirectory', 'shards'].includes(key),
    )
  ) {
    throw new Error('Unknown C# program input field.');
  }
  const shards = value.shards;
  if (
    !Array.isArray(shards) ||
    !shards.every((item: unknown): item is string => typeof item === 'string' && item.length > 0)
  ) {
    throw new Error('Expected immutable shard generation paths.');
  }
  if (shards.length === 0 || shards.length > 16) {
    throw new Error('Select one to sixteen immutable source shards.');
  }
  return {
    format: value.format,
    cloneRoot: textField(value, 'cloneRoot'),
    cacheDirectory: textField(value, 'cacheDirectory'),
    shards,
  };
}
export function resolvedCsharpProgramInputs(inputs: Inputs, base: string): Inputs {
  return {
    ...inputs,
    cloneRoot: path.resolve(base, inputs.cloneRoot),
    cacheDirectory: path.resolve(base, inputs.cacheDirectory),
    shards: inputs.shards.map((shard) => path.resolve(base, shard)),
  };
}
async function readShard(
  directory: string,
  request: {
    readonly inputs: Inputs;
    readonly base: string;
    readonly parse: (input: unknown) => ScanDocument;
  },
) {
  const scope = await readScanScope(path.join(directory, 'scope.json'));
  if (scope.files.some((file) => file.language !== 'csharp')) {
    throw new Error('C# program shards may contain only C# source.');
  }
  const document = request.parse(await repositoryPassJson(path.join(directory, DOCUMENT_FILE)));
  assertScopeCoverage(scope, document);
  const baseline = await repositoryPassJson(path.join(directory, 'baseline.json'));
  const result = await runScopedSources(scope, {
    cloneRoot: path.resolve(request.base, request.inputs.cloneRoot),
    cacheDirectory: path.resolve(request.base, request.inputs.cacheDirectory),
    authority: scope.workspace,
  });
  if (sourceDigest(JSON.stringify(baseline)) !== sourceDigest(JSON.stringify(result.baseline))) {
    throw new Error('Shard analysis is stale; republish the pinned scope before aggregating.');
  }
  return {
    document,
    indexes: result.sources.map((source) => source.index),
    receipt: { directory, document: document.id, baseline: result.baseline, stats: result.stats },
  };
}

/** Aggregates explicitly selected current C# source shards; never starts a repository queue. */
export async function runCsharpProgram(args: readonly string[]): Promise<void> {
  const [manifest, destination] = args;
  if (manifest === undefined || destination === undefined || args.length !== 2) {
    throw new Error('Usage: scan-csharp-program.ts <inputs.json> <NEW-output-directory>');
  }
  const base = path.dirname(path.resolve(manifest));
  const inputs = resolvedCsharpProgramInputs(
    csharpProgramInputs(await repositoryPassJson(manifest)),
    base,
  );
  const parse = await scanValidator();
  const shards: Awaited<ReturnType<typeof readShard>>[] = [];
  let count = 0;
  for (const selected of inputs.shards) {
    const scope = await readScanScope(path.join(path.resolve(base, selected), 'scope.json'));
    count += scope.files.length;
  }
  if (count > 512) throw new Error('C# program aggregation is bounded to 512 selected indexes.');
  for (const selected of inputs.shards) {
    shards.push(await readShard(path.resolve(base, selected), { inputs, base, parse }));
  }
  const document = parse(
    csharpProgramDocument(
      shards.map((shard) => shard.document),
      shards.flatMap((shard) => shard.indexes),
    ),
  );
  await publishProgram({ output: path.resolve(destination), document, inputs, shards });
}

async function publishProgram(request: {
  readonly output: string;
  readonly document: ScanDocument;
  readonly inputs: Inputs;
  readonly shards: readonly Awaited<ReturnType<typeof readShard>>[];
}): Promise<void> {
  const { output, document, inputs, shards } = request;
  await mkdir(output);
  await writeFramedScanDocument(path.join(output, DOCUMENT_FILE), document, { kind: 'program' });
  const receipt = {
    format: 'scan-csharp-program-publication/v1',
    document: document.id,
    documentSha256: sourceDigest(await readFile(path.join(output, DOCUMENT_FILE), 'utf8')),
    logicalDocumentSha256: sourceDigest(JSON.stringify(document)),
    driverSha256: sourceDigest(await readFile(import.meta.filename, 'utf8')),
    indexes: shards.reduce((total, shard) => total + shard.indexes.length, 0),
    shards: shards.map((shard) => shard.receipt),
    sourcePolicy: 'Explicit pinned shards only; no fetch, target build, restore or execution',
    limitations: [
      'Source ingestion and symbol binding are distinct from endpoint semantic acceptance.',
      'Interface/DI implementation candidates do not prove runtime activation.',
    ],
  };
  await writeFile(path.join(output, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, {
    flag: 'wx',
  });
  await writeFile(path.join(output, 'inputs.json'), `${JSON.stringify(inputs, null, 2)}\n`, {
    flag: 'wx',
  });
  console.log(JSON.stringify({ status: 'validated', ...receipt, output }, null, 2));
}
if (process.argv[1] === import.meta.filename) await runCsharpProgram(process.argv.slice(2));
