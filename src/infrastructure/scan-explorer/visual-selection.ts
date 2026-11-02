import 'server-only';

import { isDeepStrictEqual } from 'node:util';

import type { CurrentRecord } from '@/domain/scan-explorer/current-contracts';
import { sourceDigest } from '@/infrastructure/scan/source-index';

/** Record IDs are identities, never permission to overwrite contradictory selected facts. */
export function uniqueVisualRecords(records: readonly CurrentRecord[]): CurrentRecord[] {
  const selected = new Map<string, CurrentRecord>();
  for (const record of records) {
    const existing = selected.get(record.id);
    if (existing !== undefined && !isDeepStrictEqual(existing, record)) {
      throw new Error(`Conflicting selected native record ${record.id} (${record.kind})`);
    }
    selected.set(record.id, record);
  }
  return [...selected.values()];
}

/** Digest selected content and provenance; mutation with an unchanged record/document ID changes it. */
export function visualContentSnapshot(content: unknown): string {
  return sourceDigest(JSON.stringify(content));
}
