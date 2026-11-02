import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { readAncillaryBlob, writeAncillaryBlob } from '@/infrastructure/scan/ancillary-blob-cache';
import { canonicalDataLiteral } from '@/infrastructure/scan/canonical-data-fixture';

import { repositoryGit, type RepositoryFile } from './scan-repository-inventory';

const TEXT_LIMIT = 1024 * 1024;

interface RetainedFile {
  readonly path: string;
  readonly blob: string;
  readonly bytes: number | null;
  readonly state: 'retained_unparsed' | 'excluded';
  readonly evidence: string | null;
  readonly reason: string;
  readonly origin: 'git' | 'cache' | 'none';
}

async function ancillaryBytes(input: {
  readonly repository: string;
  readonly file: RepositoryFile;
  readonly bytes: number;
  readonly cacheDirectory: string | undefined;
}): Promise<{ readonly content: Buffer; readonly origin: 'git' | 'cache' }> {
  const cached =
    input.cacheDirectory === undefined
      ? null
      : await readAncillaryBlob({
          cacheDirectory: input.cacheDirectory,
          blob: input.file.blob,
          bytes: input.bytes,
        });
  if (cached !== null) return { content: cached, origin: 'cache' };
  const content = repositoryGit(input.repository, ['cat-file', 'blob', input.file.blob]);
  if (content.length !== input.bytes) throw new Error('Pinned ancillary blob size changed.');
  if (input.cacheDirectory !== undefined && input.bytes <= TEXT_LIMIT) {
    await writeAncillaryBlob({
      cacheDirectory: input.cacheDirectory,
      blob: input.file.blob,
      content,
    });
  }
  return { content, origin: 'git' };
}

function objectSize(repository: string, blob: string): number {
  const bytes = Number(repositoryGit(repository, ['cat-file', '-s', blob]).toString('utf8').trim());
  if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Invalid Git object size.');
  return bytes;
}
function canonicalTextLimit(file: RepositoryFile): number {
  const limit = file.canonicalData?.canonicalTextLimitBytes ?? TEXT_LIMIT;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 8 * TEXT_LIMIT) {
    throw new Error('Invalid canonical text bound.');
  }
  return limit;
}
function verifyCanonical(file: RepositoryFile, content: Buffer, text: string): void {
  if (file.canonicalData === undefined) return;
  const digest = createHash('sha256').update(content).digest('hex');
  if (digest !== file.canonicalData.sha256 || canonicalDataLiteral(file.path, text) === undefined) {
    throw new Error('Canonical data fixture proof or source digest changed.');
  }
}
function retentionReason(file: RepositoryFile): string {
  return file.canonicalData === undefined
    ? 'Pinned UTF-8 bytes retained for review only; no semantic extraction or support claims.'
    : 'Canonical data fixture: full pinned static literal bytes reverified and retained; source/configuration identity and unresolved contract obligation are recorded in inventory.canonicalData.';
}

async function retainFile(
  repository: string,
  output: string,
  input: { readonly file: RepositoryFile; readonly cacheDirectory?: string },
): Promise<RetainedFile> {
  const { file, cacheDirectory } = input;
  const base = { path: file.path, blob: file.blob };
  if (file.category === 'non-regular') {
    return {
      ...base,
      bytes: null,
      origin: 'none',
      state: 'excluded',
      evidence: null,
      reason: 'Symlink or gitlink; not followed.',
    };
  }
  const bytes = objectSize(repository, file.blob);
  const limit = canonicalTextLimit(file);
  if (bytes > limit) {
    return {
      ...base,
      bytes,
      origin: 'none',
      state: 'excluded',
      evidence: null,
      reason: `Object exceeds explicit ${String(limit)}-byte ancillary limit; source bytes were not read.`,
    };
  }
  const result = await ancillaryBytes({ repository, file, bytes, cacheDirectory });
  const { content, origin } = result;
  const text = content.toString('utf8');
  if (content.includes(0) || !Buffer.from(text).equals(content)) {
    return {
      ...base,
      bytes,
      origin,
      state: 'excluded',
      evidence: null,
      reason: 'Binary/NUL content or invalid UTF-8; bytes inspected but not retained as text.',
    };
  }
  verifyCanonical(file, content, text);
  const evidence = path.join('ancillary', `${file.blob}.txt`);
  await writeFile(path.join(output, evidence), content);
  return {
    ...base,
    bytes,
    origin,
    state: 'retained_unparsed',
    evidence,
    reason: retentionReason(file),
  };
}

/** Auxiliary text is evidence for a reviewer, never an extracted semantic record. */
export async function retainAncillary(input: {
  readonly repository: string;
  readonly output: string;
  readonly files: readonly RepositoryFile[];
  readonly cacheDirectory?: string;
}): Promise<{
  readonly textLimitBytes: number;
  readonly files: readonly RetainedFile[];
  readonly metadataSizeReads: number;
  readonly blobReads: number;
  readonly cacheHits: number;
  readonly retainedTextFiles: number;
  readonly excludedFiles: number;
}> {
  await mkdir(path.join(input.output, 'ancillary'));
  const files: RetainedFile[] = [];
  for (const file of input.files.filter((entry) => !entry.selectedForParsing)) {
    files.push(
      await retainFile(input.repository, input.output, {
        file,
        ...(input.cacheDirectory === undefined ? {} : { cacheDirectory: input.cacheDirectory }),
      }),
    );
  }
  return {
    textLimitBytes: TEXT_LIMIT,
    files,
    metadataSizeReads: files.filter((file) => file.bytes !== null).length,
    blobReads: files.filter((file) => file.origin === 'git').length,
    cacheHits: files.filter((file) => file.origin === 'cache').length,
    retainedTextFiles: files.filter((file) => file.state === 'retained_unparsed').length,
    excludedFiles: files.filter((file) => file.state === 'excluded').length,
  };
}
