import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MAX_RAW_BYTES = 1_048_576;
const MAX_CACHE_BYTES = 2_097_152;
interface BlobInput {
  readonly cacheDirectory: string;
  readonly blob: string;
  readonly bytes: number;
}
function digest(content: Buffer, blob: string): string {
  return createHash(blob.length === 64 ? 'sha256' : 'sha1')
    .update(`blob ${String(content.length)}\0`)
    .update(content)
    .digest('hex');
}
function validBlob(blob: string): boolean {
  return /^[a-f\d]{40}(?:[a-f\d]{24})?$/u.test(blob);
}
function envelope(input: unknown): input is {
  readonly format: 'ancillary-blob/v1';
  readonly blob: string;
  readonly base64: string;
} {
  if (typeof input !== 'object' || input === null) return false;
  return [
    Object.keys(input)
      .toSorted((left, right) => left.localeCompare(right))
      .join(',') === 'base64,blob,format',
    'format' in input && input.format === 'ancillary-blob/v1',
    'blob' in input && typeof input.blob === 'string',
    'base64' in input && typeof input.base64 === 'string',
  ].every(Boolean);
}
async function boundedCacheBytes(filename: string): Promise<Buffer | null> {
  try {
    const metadata = await lstat(filename);
    if (!metadata.isFile() || metadata.size > MAX_CACHE_BYTES) return null;
    const file = await open(
      filename,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > MAX_CACHE_BYTES) return null;
      const buffer = Buffer.alloc(stat.size + 1);
      const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
      return bytesRead === stat.size ? buffer.subarray(0, bytesRead) : null;
    } finally {
      await file.close();
    }
  } catch {
    return null;
  }
}

/** Cache bytes never establish authority: metadata size and the complete pinned Git blob hash must agree. */
export async function readAncillaryBlob(input: BlobInput): Promise<Buffer | null> {
  if (
    !validBlob(input.blob) ||
    !Number.isSafeInteger(input.bytes) ||
    input.bytes < 0 ||
    input.bytes > MAX_RAW_BYTES
  ) {
    return null;
  }
  const bytes = await boundedCacheBytes(path.join(input.cacheDirectory, `${input.blob}.json`));
  if (bytes === null) return null;
  try {
    const value: unknown = JSON.parse(bytes.toString('utf8'));
    if (!envelope(value) || value.blob !== input.blob) return null;
    const content = Buffer.from(value.base64, 'base64');
    return [
      content.length === input.bytes,
      content.toString('base64') === value.base64,
      digest(content, input.blob) === input.blob,
    ].every(Boolean)
      ? content
      : null;
  } catch {
    return null;
  }
}

/** Atomic raw-byte entries include binary exclusions; invalid bytes can never seed a trusted hit. */
export async function writeAncillaryBlob(input: {
  readonly cacheDirectory: string;
  readonly blob: string;
  readonly content: Buffer;
}): Promise<void> {
  if (
    !validBlob(input.blob) ||
    input.content.length > MAX_RAW_BYTES ||
    digest(input.content, input.blob) !== input.blob
  ) {
    throw new Error('Cannot cache mismatched or oversized ancillary blob bytes.');
  }
  await mkdir(input.cacheDirectory, { recursive: true });
  const filename = path.join(input.cacheDirectory, `${input.blob}.json`);
  const temporary = `${filename}.${randomUUID()}.pending`;
  await writeFile(
    temporary,
    JSON.stringify({
      format: 'ancillary-blob/v1',
      blob: input.blob,
      base64: input.content.toString('base64'),
    }),
    { flag: 'wx' },
  );
  await rename(temporary, filename);
}
