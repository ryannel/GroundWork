import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import type { ScanDocument } from '@/domain/scan/scan.generated';
import { readFramedScanJson } from '@/infrastructure/scan/framed-scan-document';
import { boundedScanBytes, framedDigest } from '@/infrastructure/scan/framed-scan-storage';
import { scanValidator } from '@/infrastructure/scan/scan-format';
import { sourceDigest } from '@/infrastructure/scan/source-index';

const reference = z.object({
  path: z.string(),
  bytes: z
    .number()
    .int()
    .nonnegative()
    .max(512 * 1024 * 1024),
  sha256: z.string(),
});
const repository = z.object({
  repo: z.string(),
  commit: z.string(),
  detail: z.string(),
  sourceStatus: z.literal('source_complete'),
});
const catalogue = z.object({
  status: z.literal('complete'),
  repositories: z.array(repository).min(1),
});
const detailShape = repository.extend({
  bindingArtifacts: z.array(reference),
  interpretationArtifact: reference,
  review: reference,
  sourceDirectory: z.string(),
  scopes: z.array(
    z.object({
      document: z.string(),
      files: z.array(z.string()),
      artifacts: z.array(z.object({ path: z.string(), digest: z.string() })),
    }),
  ),
  ancillary: z.array(z.object({ path: z.string(), state: z.string() })).default([]),
});
export type CorpusRepository = z.infer<typeof detailShape>;

export async function readCorpusCatalogue(filename: string): Promise<{
  readonly root: string;
  readonly snapshot: string;
  readonly repositories: readonly z.infer<typeof repository>[];
}> {
  const bytes = await readFile(/* turbopackIgnore: true */ filename, 'utf8');
  const parsed = catalogue.parse(JSON.parse(bytes));
  return {
    root: path.resolve(path.dirname(filename), '..'),
    snapshot: sourceDigest(bytes),
    repositories: parsed.repositories,
  };
}
function corpusPath(root: string, relative: string): string {
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`)) {
    throw new Error('Corpus reference escaped its root');
  }
  return resolved;
}
export async function checkedCorpusArtifact(
  root: string,
  ref: z.infer<typeof reference>,
): Promise<string> {
  const bytes = await boundedScanBytes(corpusPath(root, ref.path), ref.bytes);
  if (bytes.length !== ref.bytes || framedDigest(bytes) !== ref.sha256) {
    throw new Error(`Corpus artifact checksum changed: ${ref.path}`);
  }
  return bytes.toString('utf8');
}
export async function readCorpusRepository(
  root: string,
  row: z.infer<typeof repository>,
): Promise<CorpusRepository> {
  const detail = detailShape.parse(
    JSON.parse(await readFile(/* turbopackIgnore: true */ corpusPath(root, row.detail), 'utf8')),
  );
  if (detail.repo !== row.repo || detail.commit !== row.commit) {
    throw new Error('Corpus repository pin changed');
  }
  await checkedCorpusArtifact(root, detail.review);
  return detail;
}

/** Bound programs take precedence; immutable native shards retain all remaining source. */
export function corpusDocuments(
  root: string,
  detail: CorpusRepository,
): readonly { readonly filename: string; readonly digest: string; readonly program: boolean }[] {
  const bindings = detail.bindingArtifacts.filter(
    (ref) => ref.path.endsWith('/program/document.json') || ref.path.endsWith('/metadata.json'),
  );
  const scopes = detail.scopes.map((scope) => {
    const filename = corpusPath(root, scope.document);
    const ref = scope.artifacts.find(
      (artifact) => path.resolve(root, detail.sourceDirectory, artifact.path) === filename,
    );
    if (ref === undefined) throw new Error(`Missing source digest: ${scope.document}`);
    return { filename, digest: ref.digest, program: false };
  });
  return [
    ...bindings.map((ref) => ({
      filename: corpusPath(root, ref.path),
      digest: ref.sha256,
      program: true,
    })),
    ...scopes,
  ];
}
export async function readCorpusDocument(
  ref: ReturnType<typeof corpusDocuments>[number],
): Promise<ScanDocument> {
  const bytes = await boundedScanBytes(
    ref.filename,
    ref.program ? 512 * 1024 * 1024 : 64 * 1024 * 1024,
  );
  if (framedDigest(bytes) !== ref.digest) {
    throw new Error(`Selected source checksum changed: ${ref.filename}`);
  }
  // Reviewed programmes predating framing retain their explicit 512 MiB programme boundary.
  const raw: unknown =
    ref.program && bytes.length > 64 * 1024 * 1024
      ? JSON.parse(bytes.toString('utf8'))
      : await readFramedScanJson(ref.filename, { kind: ref.program ? 'program' : 'source' });
  const validate = await scanValidator();
  return validate(raw);
}
