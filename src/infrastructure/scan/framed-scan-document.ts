import 'server-only';

import path from 'node:path';

import { decodeFramedScan, framedUtf8 } from './framed-scan-decode';
import { encodeFramedScan } from './framed-scan-encode';
import {
  framedLogicalLimit,
  framedObject,
  framedScanManifest,
  SCAN_PAGE_COUNT,
  SCAN_PHYSICAL_LIMIT,
  type FramedScanOptions,
} from './framed-scan-format';
import { assertFramedHeader } from './framed-scan-keys';
import { boundedScanBytes, framedDigest, immutableScanBytes } from './framed-scan-storage';

async function assertLegacyProgram(filename: string, bytes: string, value: unknown): Promise<void> {
  if (
    !framedObject(value) ||
    value.format !== 'scan/v1' ||
    typeof value.id !== 'string' ||
    !/^scan:csharp-program:[a-f\d]{64}$/u.test(value.id)
  ) {
    throw new Error('Oversized scan artifact is not a legacy C# programme.');
  }
  const receipt: unknown = JSON.parse(
    framedUtf8(await boundedScanBytes(path.join(path.dirname(filename), 'receipt.json'))),
  );
  if (
    !framedObject(receipt) ||
    receipt.format !== 'scan-csharp-program-publication/v1' ||
    receipt.document !== value.id ||
    receipt.documentSha256 !== framedDigest(bytes)
  ) {
    throw new Error('Legacy C# programme publication receipt identity/hash mismatch.');
  }
}

/** Only an explicit programme caller may read a receipt-bound legacy unframed document. */
export async function readBoundedScanDocument(
  filename: string,
  options: FramedScanOptions = {},
): Promise<{ readonly bytes: string; readonly value: unknown }> {
  const limit = options.kind === 'program' ? framedLogicalLimit(options) : SCAN_PHYSICAL_LIMIT;
  // Keep a UTF-8 BOM in the hashed input, even though JSON parsing must skip it.
  const bytes = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
    await boundedScanBytes(filename, limit),
  );
  const value: unknown = JSON.parse(bytes.startsWith('\uFEFF') ? bytes.slice(1) : bytes);
  if (Buffer.byteLength(bytes) > SCAN_PHYSICAL_LIMIT) {
    await assertLegacyProgram(filename, bytes, value);
  }
  return { bytes, value };
}

/** Logical scan data and generation identities are unchanged; pages only frame storage. */
export async function writeFramedScanDocument(
  filename: string,
  document: unknown,
  options: FramedScanOptions = {},
): Promise<void> {
  if (!framedObject(document) || document.format !== 'scan/v1') {
    throw new Error('Expected logical scan/v1 data.');
  }
  const pretty = `${JSON.stringify(document, null, 2)}\n`;
  if (options.forceFraming !== true && Buffer.byteLength(pretty) <= SCAN_PHYSICAL_LIMIT) {
    await immutableScanBytes(filename, pretty);
    return;
  }
  await encodeFramedScan(filename, document, options);
}
/** Caller context controls the logical cap; no manifest can grant a programme limit. */
export async function readFramedScanJson(
  filename: string,
  options: FramedScanOptions = {},
): Promise<unknown> {
  const { value } = await readBoundedScanDocument(filename, options);
  if (!framedObject(value) || value.format !== 'scan-framed/v1') return value;
  const manifest = framedScanManifest.parse(value);
  assertFramedHeader(manifest);
  if (manifest.logicalBytes > framedLogicalLimit(options)) {
    throw new Error('Scan logical decoded total exceeds caller bound.');
  }
  const pages = manifest.entries.flatMap((entry) =>
    entry.kind === 'collection' ? entry.pages : [],
  );
  if (pages.length > SCAN_PAGE_COUNT) throw new Error('Scan frame page count exceeds64.');
  if (pages.reduce((total, page) => total + page.decodedBytes, 0) > framedLogicalLimit(options)) {
    throw new Error('Scan frame payload total exceeds caller bound.');
  }
  return decodeFramedScan(filename, manifest);
}
