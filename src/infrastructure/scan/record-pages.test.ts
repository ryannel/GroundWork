import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';

import { createScanRecordReader } from './record-pages';

vi.mock(import('server-only'), () => ({}));

describe('bounded scan record pages', () => {
  it('pages deterministically without support closure or repeated IDs', () => {
    const reader = createScanRecordReader(scanFixture());
    const input = {
      ids: ['source:handler', 'host:server', 'source:handler'],
      maxRecords: 1,
      maxBytes: 4096,
    };
    const first = reader.page(input);
    expect(first.records.map((record) => record.id)).toEqual(['host:server']);
    expect(first.scope).toBe('selected-records-only');
    expect(first.nextCursor?.length).toBeLessThan(300);
    const second = reader.page({ ...input, cursor: first.nextCursor ?? '' });
    expect(second.records.map((record) => record.id)).toEqual(['source:handler']);
    expect(second.nextCursor).toBeNull();
    expect(reader.page(input)).toEqual(first);
  });

  it('rejects cross-snapshot and altered-budget continuations', () => {
    const document = scanFixture();
    const input = { ids: ['source:handler', 'host:server'], maxRecords: 1, maxBytes: 4096 };
    const cursor = createScanRecordReader(document).page(input).nextCursor ?? '';
    expect(() =>
      createScanRecordReader({ ...document, id: 'other' }).page({ ...input, cursor }),
    ).toThrow('mismatch');
    expect(() =>
      createScanRecordReader(document).page({ ...input, cursor, maxRecords: 2 }),
    ).toThrow('mismatch');
  });

  it('returns a recoverable oversized record frontier rather than an infinite cursor', () => {
    const document = scanFixture();
    document.gaps[0]!.description = 'large '.repeat(1000);
    const page = createScanRecordReader(document).page({
      ids: ['gap:unknown'],
      maxRecords: 1,
      maxBytes: 512,
    });
    expect(page.limit).toBe('oversized-record');
    expect(page.records).toEqual([]);
    expect(page.nextCursor).toBeNull();
    expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThanOrEqual(512);
  });

  it('enforces input budgets and rejects unknown records and malformed cursors', () => {
    const reader = createScanRecordReader(scanFixture());
    const input = { ids: ['source:handler'], maxRecords: 1, maxBytes: 4096 };
    expect(() => reader.page({ ...input, ids: ['missing'] })).toThrow('Unknown');
    expect(() => reader.page({ ...input, maxRecords: 0 })).toThrow('Record budget');
    expect(() => reader.page({ ...input, maxBytes: 1 })).toThrow('byte budget');
    expect(() => reader.page({ ...input, ids: Array.from({ length: 33 }, () => 'x') })).toThrow(
      'budget',
    );
    expect(() => reader.page({ ...input, cursor: 'x'.repeat(1025) })).toThrow('budget');
    expect(() => reader.page({ ...input, cursor: 'invalid' })).toThrow('Unexpected');
    expect(reader.page({ ...input, ids: [] }).nextCursor).toBeNull();
  });

  it('keeps the snapshot immutable when callers mutate inputs or delivered records', () => {
    const document = scanFixture();
    const reader = createScanRecordReader(document);
    const input = { ids: ['source:handler'], maxRecords: 1, maxBytes: 4096 };
    const first = reader.page(input);
    document.sources[0]!.path = 'changed.ts';
    const record = first.records[0];
    if (record?.kind !== 'source') throw new Error('Missing fixture source');
    record.path = 'also-changed.ts';
    const next = reader.page(input);
    expect(next.snapshot).toBe(first.snapshot);
    expect(next.records[0]).toMatchObject({ path: 'handler.ts' });
  });
});
