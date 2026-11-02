import 'server-only';

import { readBoundedScanDocument, readFramedScanJson } from './framed-scan-document';
import { framedObject, framedScanManifest, type FramedScanOptions } from './framed-scan-format';
import { framedDigest } from './framed-scan-storage';

export interface VerifiedScanSnapshot {
  readonly bytes: string;
}
const verified = new WeakMap<
  VerifiedScanSnapshot,
  { readonly sha256: string; readonly logicalSha256: string; readonly document: unknown }
>();

/** A runtime-bound handle prevents substituting unrelated logical data for hashed input bytes. */
export async function loadVerifiedScanSnapshot(
  filename: string,
  options: FramedScanOptions = {},
): Promise<VerifiedScanSnapshot> {
  const { bytes, value: physical } = await readBoundedScanDocument(filename, options);
  const framed = framedObject(physical) && physical.format === 'scan-framed/v1';
  const document = framed ? await readFramedScanJson(filename, options) : physical;
  const expected = framed
    ? framedScanManifest.parse(physical).logicalSha256
    : framedDigest(JSON.stringify(physical));
  if (framedDigest(JSON.stringify(document)) !== expected) {
    throw new Error('Scan snapshot changed or logical input identity differs.');
  }
  const snapshot = { bytes };
  verified.set(snapshot, { sha256: framedDigest(bytes), logicalSha256: expected, document });
  return snapshot;
}
export function verifiedSnapshotDocument(snapshot: VerifiedScanSnapshot, bytes: string): unknown {
  const stored = verified.get(snapshot);
  if (stored?.sha256 !== framedDigest(bytes)) {
    throw new Error('Scan snapshot is not bound to these exact verified bytes.');
  }
  if (framedDigest(JSON.stringify(stored.document)) !== stored.logicalSha256) {
    throw new Error('Verified logical scan snapshot was mutated.');
  }
  return stored.document;
}
