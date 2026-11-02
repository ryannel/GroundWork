import 'server-only';

import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  SCAN_PAGE_COUNT,
  SCAN_PAGE_LIMIT,
  SCAN_PHYSICAL_LIMIT,
  framedJson,
} from './framed-scan-format';

export function framedDigest(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}
export async function boundedScanBytes(
  filename: string,
  limit = SCAN_PHYSICAL_LIMIT,
): Promise<Buffer> {
  const file = await open(
    filename,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  ).catch((error: unknown) => {
    if (error instanceof Error && 'code' in error && error.code === 'ELOOP') {
      throw new Error('Scan artifact is not a bounded regular file.');
    }
    throw error;
  });
  try {
    const metadata = await file.stat();
    if (!metadata.isFile()) {
      throw new Error('Scan artifact is not a bounded regular file.');
    }
    if (metadata.size > limit) throw new Error('Scan artifact exceeds caller byte bound.');
    const content = Buffer.alloc(metadata.size + 1);
    const { bytesRead } = await file.read(content, 0, content.length, 0);
    if (bytesRead !== metadata.size) throw new Error('Scan artifact changed while reading.');
    return content.subarray(0, bytesRead);
  } finally {
    await file.close();
  }
}
export async function immutableScanBytes(filename: string, content: string): Promise<void> {
  if (Buffer.byteLength(content) > SCAN_PHYSICAL_LIMIT) {
    throw new Error('Scan physical file exceeds64MiB.');
  }
  try {
    await writeFile(filename, content, { flag: 'wx' });
  } catch (error) {
    const existing = await boundedScanBytes(filename);
    if (!existing.equals(Buffer.from(content))) throw error;
  }
}
function framedPagePath(filename: string, position: number): string {
  if (!Number.isInteger(position) || position < 1 || position > SCAN_PAGE_COUNT) {
    throw new Error('Scan frame page count exceeds64.');
  }
  return `${path.basename(filename, '.json')}.pages/page-${String(position).padStart(4, '0')}.json`;
}
export async function prepareFrameFolder(filename: string): Promise<void> {
  const folder = path.join(path.dirname(filename), `${path.basename(filename, '.json')}.pages`);
  await mkdir(folder, { recursive: true });
  const metadata = await lstat(folder);
  if (!metadata.isDirectory()) throw new Error('Frame page folder is not a regular directory.');
}
export async function readFramePage(
  filename: string,
  reference: { readonly path: string; readonly bytes: number; readonly sha256: string },
  position: number,
): Promise<Buffer> {
  if (reference.path !== framedPagePath(filename, position)) {
    throw new Error('Invalid scan frame page path/order.');
  }
  const folder = path.join(path.dirname(filename), `${path.basename(filename, '.json')}.pages`);
  const metadata = await lstat(folder);
  if (!metadata.isDirectory()) throw new Error('Frame page folder is not a regular directory.');
  const bytes = await boundedScanBytes(
    path.join(path.dirname(filename), reference.path),
    SCAN_PAGE_LIMIT,
  );
  if (bytes.length !== reference.bytes || framedDigest(bytes) !== reference.sha256) {
    throw new Error('Scan frame page byte/hash mismatch.');
  }
  return bytes;
}
export async function writeFramePage(
  filename: string,
  input: { readonly base64: string; readonly position: number },
): Promise<{ readonly path: string; readonly bytes: number; readonly sha256: string }> {
  const relative = framedPagePath(filename, input.position);
  const content = `${framedJson({ format: 'scan-record-page/v1', base64: input.base64 })}\n`;
  const bytes = Buffer.byteLength(content);
  if (bytes > SCAN_PAGE_LIMIT) throw new Error('Scan frame page exceeds16MiB.');
  await immutableScanBytes(path.join(path.dirname(filename), relative), content);
  return { path: relative, bytes, sha256: framedDigest(content) };
}
