import 'server-only';

import { createHash } from 'node:crypto';

import { z } from 'zod';

import { scanRecords, type ScanRecord } from '@/domain/scan/scan-records';
import type { ScanDocument } from '@/domain/scan/scan.generated';

interface PageInput {
  readonly ids: readonly string[];
  readonly maxRecords: number;
  readonly maxBytes: number;
  readonly cursor?: string;
}
interface Page {
  readonly snapshot: string;
  readonly records: readonly ScanRecord[];
  readonly nextCursor: string | null;
  readonly limit: 'records' | 'bytes' | 'oversized-record' | null;
  readonly scope: 'selected-records-only';
}
interface Reader {
  readonly page: (input: PageInput) => Page;
}
interface Selection {
  readonly snapshot: string;
  readonly query: string;
  readonly records: readonly ScanRecord[];
}
const cursorSchema = z
  .object({
    snapshot: z.string(),
    query: z.string(),
    offset: z.number().int().min(0),
  })
  .strict();

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function offsetFor(input: PageInput, selection: Selection): number {
  if (input.cursor === undefined) return 0;
  if (input.cursor.length > 1024) throw new Error('Cursor exceeds byte budget');
  const raw: unknown = JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8'));
  const cursor = cursorSchema.parse(raw);
  if (cursor.snapshot !== selection.snapshot || cursor.query !== selection.query) {
    throw new Error('Cursor snapshot, selection or budget mismatch');
  }
  if (cursor.offset > selection.records.length) throw new Error('Cursor offset is out of bounds');
  return cursor.offset;
}

function pageAt(
  selection: Selection,
  position: { readonly offset: number; readonly count: number },
  limit: Page['limit'],
): Page {
  const { offset, count } = position;
  const next = offset + count;
  const continued = next < selection.records.length && limit !== 'oversized-record';
  return {
    snapshot: selection.snapshot,
    records: structuredClone(selection.records.slice(offset, next)),
    nextCursor: continued
      ? Buffer.from(
          JSON.stringify({ snapshot: selection.snapshot, query: selection.query, offset: next }),
        ).toString('base64url')
      : null,
    limit,
    scope: 'selected-records-only',
  };
}

function boundedPage(selection: Selection, input: PageInput): Page {
  const offset = offsetFor(input, selection);
  let count = 0;
  let page = pageAt(selection, { offset, count }, 'records');
  while (offset + count < selection.records.length && count < input.maxRecords) {
    const last = offset + count + 1 === selection.records.length;
    const candidate = pageAt(selection, { offset, count: count + 1 }, last ? null : 'records');
    if (Buffer.byteLength(JSON.stringify(candidate)) > input.maxBytes) {
      return pageAt(selection, { offset, count }, count === 0 ? 'oversized-record' : 'bytes');
    }
    count += 1;
    page = candidate;
  }
  return offset === selection.records.length ? pageAt(selection, { offset, count: 0 }, null) : page;
}

function validRequest(input: PageInput): void {
  if (input.ids.length > 32 || Buffer.byteLength(JSON.stringify(input)) > 8192) {
    throw new Error('Selected-record request exceeds byte or ID budget');
  }
  if (!Number.isInteger(input.maxRecords) || input.maxRecords < 1 || input.maxRecords > 256) {
    throw new Error('Record budget must be between 1 and 256');
  }
  if (!Number.isInteger(input.maxBytes) || input.maxBytes < 512 || input.maxBytes > 1_048_576) {
    throw new Error('Response byte budget must be between 512 and 1048576');
  }
}

/** Build once; pages select bounded IDs and never recursively fetch referenced records. */
export function createScanRecordReader(document: ScanDocument): Reader {
  const frozen = structuredClone(document);
  const records = new Map(scanRecords(frozen).map((record) => [record.id, record]));
  const snapshot = digest(frozen);
  return {
    page(input) {
      validRequest(input);
      const ids = [...new Set(input.ids)].toSorted((left, right) => left.localeCompare(right));
      const selected = ids.map((id) => {
        const record = records.get(id);
        if (record === undefined) throw new Error(`Unknown selected record ${id}`);
        return record;
      });
      const query = digest({ ids, maxBytes: input.maxBytes, maxRecords: input.maxRecords });
      return boundedPage({ snapshot, query, records: selected }, input);
    },
  };
}
