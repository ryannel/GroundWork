import 'server-only';

import { createHash } from 'node:crypto';

import {
  framedJson,
  framedScanPage,
  type FramedEntry,
  type FramedManifest,
} from './framed-scan-format';
import { assertFramedKey } from './framed-scan-keys';
import { readFramePage } from './framed-scan-storage';
import { scanValidator } from './scan-format';

export function framedUtf8(bytes: Buffer): string {
  const text = bytes.toString('utf8');
  if (!Buffer.from(text).equals(bytes)) throw new Error('Scan frame contains invalid UTF-8.');
  return text;
}
interface Decoding {
  readonly values: readonly (readonly [string, unknown])[];
  readonly logicalBytes: number;
  readonly pageCount: number;
}
async function collectionValue(
  filename: string,
  input: {
    readonly entry: Extract<FramedEntry, { readonly kind: 'collection' }>;
    readonly position: number;
  },
): Promise<{ readonly json: string; readonly value: readonly unknown[] }> {
  const parts = await input.entry.pages.reduce<Promise<readonly Buffer[]>>(
    async (previous, reference, offset) => {
      const buffers = await previous;
      const pageBytes = await readFramePage(filename, reference, input.position + offset + 1);
      const page = framedScanPage.parse(JSON.parse(framedUtf8(pageBytes)));
      const bytes = Buffer.from(page.base64, 'base64');
      if (bytes.length !== reference.decodedBytes || bytes.toString('base64') !== page.base64) {
        throw new Error('Scan frame payload byte/base64 mismatch.');
      }
      return [...buffers, bytes];
    },
    Promise.resolve([]),
  );
  const json = framedUtf8(Buffer.concat(parts));
  const value: unknown = JSON.parse(json);
  if (!Array.isArray(value) || value.length !== input.entry.records) {
    throw new Error('Scan frame collection record count mismatch.');
  }
  return { json, value };
}
async function entryValue(
  filename: string,
  input: { readonly entry: FramedEntry; readonly position: number },
): Promise<{ readonly json: string; readonly value: unknown }> {
  if (input.entry.kind === 'collection') {
    return collectionValue(filename, { entry: input.entry, position: input.position });
  }
  const value: unknown = JSON.parse(input.entry.json);
  if (Array.isArray(value)) throw new Error('Array data must use record pages.');
  return { json: input.entry.json, value };
}
function prefix(entry: FramedEntry, values: Decoding['values']): string {
  assertFramedKey(entry.key);
  if (values.some(([key]) => key === entry.key)) throw new Error('Duplicate scan frame key.');
  return `${values.length === 0 ? '' : ','}${framedJson(entry.key)}:`;
}

export async function decodeFramedScan(
  filename: string,
  manifest: FramedManifest,
): Promise<unknown> {
  const hash = createHash('sha256');
  hash.update('{');
  const decoded = await manifest.entries.reduce<Promise<Decoding>>(
    async (previous, entry) => {
      const state = await previous;
      const key = prefix(entry, state.values);
      const value = await entryValue(filename, { entry, position: state.pageCount });
      const logicalBytes =
        state.logicalBytes + Buffer.byteLength(key) + Buffer.byteLength(value.json);
      if (logicalBytes > manifest.logicalBytes) {
        throw new Error('Scan frame logical byte count mismatch.');
      }
      hash.update(key).update(value.json);
      return {
        values: [...state.values, [entry.key, value.value]],
        logicalBytes,
        pageCount: state.pageCount + (entry.kind === 'collection' ? entry.pages.length : 0),
      };
    },
    Promise.resolve({ values: [], logicalBytes: 2, pageCount: 0 }),
  );
  hash.update('}');
  if (
    decoded.logicalBytes !== manifest.logicalBytes ||
    hash.digest('hex') !== manifest.logicalSha256
  ) {
    throw new Error('Scan frame logical byte/hash mismatch.');
  }
  const parse = await scanValidator();
  return parse(Object.fromEntries(decoded.values));
}
