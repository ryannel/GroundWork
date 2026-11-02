import 'server-only';

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { writeFramedScanDocument } from './framed-scan-document';
import { scanValidator } from './scan-format';
import type { ScanScope } from './scan-scope';
import { assertScopeCoverage } from './scope-coverage';
import { scopedDocument } from './scoped-document';
import type { ScopedSources } from './scoped-source-store';
import { sourceDigest } from './source-index';

async function immutableFile(file: string, value: unknown): Promise<void> {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  try {
    await writeFile(file, content, { flag: 'wx' });
  } catch (error) {
    if ((await readFile(file, 'utf8')) !== content) throw error;
  }
}

/** Immutable generations; the last pointer moves only after every artifact is written. */
export async function publishScopedScan(
  directory: string,
  input: { readonly scope: ScanScope; readonly result: ScopedSources },
): Promise<{ readonly generation: string; readonly document: ReturnType<typeof scopedDocument> }> {
  const { baseline } = input.result;
  if (
    baseline.repo !== input.scope.repo ||
    baseline.commit !== input.scope.commit ||
    baseline.ref !== input.scope.ref
  ) {
    throw new Error('Publication baseline does not match the pinned scope.');
  }
  const parse = await scanValidator();
  const document = parse(scopedDocument(input.scope, input.result));
  assertScopeCoverage(input.scope, document);
  const outputs = [
    ['document.json', document],
    ['baseline.json', input.result.baseline],
    ['scope.json', input.scope],
    [
      'coverage.json',
      {
        scope: input.scope.id,
        questions: document.receipts,
        candidates: input.result.sources.flatMap((source) => source.facts.candidates),
        semanticDiagnostics: input.result.sources.map((source) => ({
          path: source.file.path,
          exactDuplicateEdges: source.facts.semanticDiagnostics?.exactDuplicateEdges ?? 0,
        })),
        limitations: [
          'Syntax/local-symbol coverage is not semantic completeness.',
          'This publication covers only its selected manifest files.',
        ],
      },
    ],
  ] as const;
  const generation = sourceDigest(JSON.stringify(outputs));
  const folder = path.join(directory, generation);
  await mkdir(folder, { recursive: true });
  await Promise.all(
    outputs.map(async ([name, value]) =>
      name === 'document.json'
        ? writeFramedScanDocument(path.join(folder, name), value)
        : immutableFile(path.join(folder, name), value),
    ),
  );
  const temporary = path.join(directory, `.selection-${generation}.json`);
  await writeFile(
    temporary,
    `${JSON.stringify({ format: 'scan-selection/v1', generation, source: input.result.baseline, document: document.id })}\n`,
  );
  await rename(temporary, path.join(directory, 'selection.json'));
  return { generation, document };
}
