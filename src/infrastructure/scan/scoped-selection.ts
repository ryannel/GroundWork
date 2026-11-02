import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import type { SourceBaseline } from '@/domain/scan/scan.generated';

import { readFramedScanJson } from './framed-scan-document';
import { parseScanScope, type ScanScope } from './scan-scope';
import { sourceDigest } from './source-index';

const selectionSchema = z
  .object({
    format: z.literal('scan-selection/v1'),
    generation: z.string().regex(/^[a-f\d]{64}$/u),
    document: z.string(),
    source: z
      .object({
        repo: z.string(),
        commit: z.string(),
        tree: z.string(),
        ref: z.string(),
        environmentDigest: z.string(),
        ruleDigest: z.string(),
        toolchainDigest: z.string(),
        configDigest: z.string(),
      })
      .strict(),
  })
  .strict();

async function generationMatches(
  directory: string,
  selection: z.infer<typeof selectionSchema>,
  scope: ScanScope,
): Promise<boolean> {
  const names = ['document.json', 'baseline.json', 'scope.json', 'coverage.json'];
  const outputs = await Promise.all(
    names.map(async (name) => {
      const value = await readFramedScanJson(path.join(directory, selection.generation, name));
      return { name, value };
    }),
  );
  const document = z
    .object({ id: z.string() })
    .parse(outputs.find((entry) => entry.name === 'document.json')?.value);
  if (document.id !== selection.document) return false;
  const storedScope = parseScanScope(outputs.find((entry) => entry.name === 'scope.json')?.value);
  if (JSON.stringify(storedScope) !== JSON.stringify(parseScanScope(scope))) return false;
  return (
    sourceDigest(JSON.stringify(outputs.map((entry) => [entry.name, entry.value]))) ===
    selection.generation
  );
}

const BASELINE_KEYS: readonly (keyof SourceBaseline)[] = [
  'repo',
  'commit',
  'tree',
  'ref',
  'environmentDigest',
  'ruleDigest',
  'toolchainDigest',
  'configDigest',
];

/** Only skips extraction when the selected publication has matching current provenance. */
export async function currentScopedGeneration(
  directory: string,
  input: {
    readonly scope: ScanScope;
    readonly baseline: SourceBaseline;
  },
): Promise<string | null> {
  try {
    const value: unknown = JSON.parse(
      await readFile(path.join(directory, 'selection.json'), 'utf8'),
    );
    const selection = selectionSchema.parse(value);
    if (!BASELINE_KEYS.every((key) => selection.source[key] === input.baseline[key])) {
      return null;
    }
    if (!(await generationMatches(directory, selection, input.scope))) return null;
    return selection.generation;
  } catch {
    return null;
  }
}
