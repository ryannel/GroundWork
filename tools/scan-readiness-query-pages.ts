import type { ReadinessQuery } from '@/domain/scan/repository-readiness-types';
import { sourceDigest } from '@/infrastructure/scan/source-index';

import {
  readinessArray,
  readinessNumber,
  readinessObject,
  readinessString,
} from './scan-readiness-value';

export interface ReadinessPageRecord {
  readonly id: string;
  readonly kind: string;
  readonly value: Readonly<Record<string, unknown>>;
}
interface Page {
  readonly value: Readonly<Record<string, unknown>>;
  readonly records: readonly ReadinessPageRecord[];
  readonly snapshot: string;
  readonly cursor: string | null;
}
export interface ReadinessPageSet {
  readonly records: readonly ReadinessPageRecord[];
  readonly ids: readonly string[];
  readonly pages: number;
  readonly bytes: number;
  readonly rawBytes: number;
}
function pageOf(input: unknown, limits: ReadinessQuery['limits']): Page {
  const value = readinessObject(input);
  const snapshot = readinessString(value.snapshot);
  const records = readinessArray(value.records).map((record) => {
    const row = readinessObject(record);
    return { id: readinessString(row.id), kind: readinessString(row.kind), value: row };
  });
  const cursor = value.nextCursor === null ? null : readinessString(value.nextCursor);
  const valid = [
    /^[a-f\d]{64}$/u.test(snapshot),
    value.scope === 'selected-records-only',
    records.length > 0,
    records.length <= limits.maxRecordsPerPage,
    Buffer.byteLength(JSON.stringify(value)) <= limits.maxPageBytes,
    cursor === null
      ? value.limit === null
      : ['records', 'bytes'].includes(readinessString(value.limit)),
  ].every(Boolean);
  if (!valid) {
    throw new Error('Entry query page violates the public response protocol or byte/record caps.');
  }
  return { value, records, snapshot, cursor };
}
function verifyGroup(pages: readonly Page[], limits: ReadinessQuery['limits']): void {
  const ids = pages.flatMap((page) => page.records.map((record) => record.id));
  if (ids.length > limits.idsPerRequest) {
    throw new Error('Entry query request exceeds its selected-ID budget.');
  }
  const query = sourceDigest(
    JSON.stringify({
      ids: ids.toSorted((left, right) => left.localeCompare(right)),
      maxBytes: limits.maxPageBytes,
      maxRecords: limits.maxRecordsPerPage,
    }),
  );
  let offset = 0;
  for (const page of pages) {
    offset += page.records.length;
    if (page.cursor === null) continue;
    if (page.cursor.length > 1024) {
      throw new Error('Entry query cursor exceeds the public byte budget.');
    }
    const raw: unknown = JSON.parse(Buffer.from(page.cursor, 'base64url').toString('utf8'));
    const cursor = readinessObject(raw);
    if (
      Object.keys(cursor).length !== 3 ||
      cursor.snapshot !== page.snapshot ||
      cursor.query !== query ||
      readinessNumber(cursor.offset) !== offset
    ) {
      throw new Error('Entry query continuation does not match its selected records and budgets.');
    }
  }
}

/** Verify the actual saved public responses, including every continued 32-ID selection. */
export function readinessQueryPages(
  input: unknown,
  limits: ReadinessQuery['limits'],
): ReadinessPageSet {
  const pages = readinessArray(input).map((page) => pageOf(page, limits));
  const group: Page[] = [];
  for (const page of pages) {
    group.push(page);
    if (page.cursor === null) {
      verifyGroup(group, limits);
      group.length = 0;
    }
  }
  const records = pages.flatMap((page) => page.records);
  const ids = records.map((record) => record.id);
  const bytes = pages.reduce(
    (total, page) => total + Buffer.byteLength(JSON.stringify(page.value)),
    0,
  );
  const valid = [
    group.length === 0,
    pages.length > 0,
    new Set(pages.map((page) => page.snapshot)).size === 1,
    new Set(ids).size === ids.length,
    bytes <= limits.maxBytes,
    records.length <= limits.maxRecords,
  ].every(Boolean);
  if (!valid) {
    throw new Error(
      'Entry query responses are incomplete, duplicated or outside aggregate bounds.',
    );
  }
  return {
    records,
    ids,
    pages: pages.length,
    bytes,
    rawBytes: records.reduce(
      (total, record) => total + Buffer.byteLength(JSON.stringify(record.value)),
      0,
    ),
  };
}
