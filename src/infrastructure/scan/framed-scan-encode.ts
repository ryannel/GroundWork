import 'server-only';

import { createHash } from 'node:crypto';

import {
  framedJson,
  framedLogicalLimit,
  framedScanManifest,
  SCAN_FRAGMENT_LIMIT,
  type FramedEntry,
  type FramedPageReference,
  type FramedScanOptions,
} from './framed-scan-format';
import { assertFramedHeader, assertFramedKey } from './framed-scan-keys';
import { immutableScanBytes, prepareFrameFolder, writeFramePage } from './framed-scan-storage';

interface Encoding {
  readonly entries: readonly FramedEntry[];
  readonly logicalBytes: number;
  readonly pageCount: number;
}
async function collectionPages(
  filename: string,
  input: { readonly json: string; readonly position: number },
): Promise<readonly FramedPageReference[]> {
  const bytes = Buffer.from(input.json);
  const starts = Array.from(
    { length: Math.ceil(bytes.length / SCAN_FRAGMENT_LIMIT) },
    (_, offset) => offset * SCAN_FRAGMENT_LIMIT,
  );
  return starts.reduce<Promise<readonly FramedPageReference[]>>(async (previous, start) => {
    const pages = await previous;
    const part = bytes.subarray(start, Math.min(start + SCAN_FRAGMENT_LIMIT, bytes.length));
    const reference = await writeFramePage(filename, {
      base64: part.toString('base64'),
      position: input.position + pages.length + 1,
    });
    return [...pages, { ...reference, decodedBytes: part.length }];
  }, Promise.resolve([]));
}
function keyPrefix(key: string, count: number): string {
  assertFramedKey(key);
  return `${count === 0 ? '' : ','}${framedJson(key)}:`;
}
async function encodedEntry(
  filename: string,
  input: {
    readonly key: string;
    readonly value: unknown;
    readonly json: string;
    readonly position: number;
  },
): Promise<FramedEntry> {
  return Array.isArray(input.value)
    ? {
        key: input.key,
        kind: 'collection',
        records: input.value.length,
        pages: [
          ...(await collectionPages(filename, { json: input.json, position: input.position })),
        ],
      }
    : { key: input.key, kind: 'value', json: input.json };
}

export async function encodeFramedScan(
  filename: string,
  document: Readonly<Record<string, unknown>>,
  options: FramedScanOptions,
): Promise<void> {
  const hash = createHash('sha256');
  hash.update('{');
  await prepareFrameFolder(filename);
  const encoded = await Object.entries(document).reduce<Promise<Encoding>>(
    async (previous, [key, value]) => {
      const state = await previous;
      if (value === undefined) return state;
      const json = framedJson(value);
      const prefix = keyPrefix(key, state.entries.length);
      const logicalBytes = state.logicalBytes + Buffer.byteLength(prefix) + Buffer.byteLength(json);
      if (logicalBytes > framedLogicalLimit(options)) {
        throw new Error('Scan logical decoded total exceeds caller bound.');
      }
      hash.update(prefix).update(json);
      const entry = await encodedEntry(filename, { key, value, json, position: state.pageCount });
      return {
        entries: [...state.entries, entry],
        logicalBytes,
        pageCount: state.pageCount + (entry.kind === 'collection' ? entry.pages.length : 0),
      };
    },
    Promise.resolve({ entries: [], logicalBytes: 2, pageCount: 0 }),
  );
  hash.update('}');
  const manifest = framedScanManifest.parse({
    format: 'scan-framed/v1',
    logicalBytes: encoded.logicalBytes,
    logicalSha256: hash.digest('hex'),
    entries: encoded.entries,
  });
  assertFramedHeader(manifest);
  await immutableScanBytes(filename, `${framedJson(manifest)}\n`);
}
