import 'server-only';

import schema from '@/../schema/scan.schema.json' with { type: 'json' };

import type { FramedEntry, FramedManifest } from './framed-scan-format';

const values = new Set(['format', 'id', 'freshness']);
export function assertFramedKey(key: string): void {
  if (!Object.hasOwn(schema.properties, key)) {
    throw new Error('Unknown or reserved scan frame key.');
  }
}
export function assertFramedHeader(manifest: FramedManifest): void {
  const keys = new Set<string>();
  for (const entry of manifest.entries) {
    assertFramedKey(entry.key);
    if (keys.has(entry.key)) throw new Error('Duplicate scan frame key.');
    keys.add(entry.key);
    if ((entry.kind === 'value') !== values.has(entry.key)) {
      throw new Error('Scan frame collection/value kind mismatch.');
    }
  }
  const format = header(manifest.entries, 'format');
  const id = header(manifest.entries, 'id');
  if (format !== 'scan/v1' || typeof id !== 'string' || id.length === 0) {
    throw new Error('Invalid logical scan frame header.');
  }
}
function header(entries: readonly FramedEntry[], key: string): unknown {
  const entry = entries.find((candidate) => candidate.key === key);
  return entry?.kind === 'value' ? JSON.parse(entry.json) : undefined;
}
