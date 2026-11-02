import { describe, expect, it } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';

import { entryRecordClosure } from './scan-entry-record-closure';

describe('bounded entry record closure', () => {
  it('follows explicit identities without treating descriptive text as a record link', () => {
    const document = scanFixture();
    document.sources.push({ ...document.sources[0]!, id: 'unrelated' });
    document.gaps[0]!.description = 'unrelated';
    const result = entryRecordClosure(document, ['host:server', 'gap:unknown'], {
      maxRecords: 10,
      maxBytes: 10_000,
    });
    expect(result.ids).toEqual(['host:server', 'gap:unknown', 'source:handler']);
    expect(result.missing).toEqual([]);
    expect(result.omitted).toBe(0);
  });

  it('reports unknown seeds and record/byte/oversized frontiers without returning huge records', () => {
    const document = scanFixture();
    const limit = entryRecordClosure(document, ['host:server', 'missing'], {
      maxRecords: 1,
      maxBytes: 10_000,
    });
    expect(limit.ids).toEqual(['host:server']);
    expect(limit.missing).toEqual(['missing']);
    expect(limit.omitted).toBe(1);
    expect(
      entryRecordClosure(document, ['host:server'], { maxRecords: 10, maxBytes: 0 }).ids,
    ).toEqual([]);
    document.gaps[0]!.description = 'x'.repeat(65_536);
    const oversized = entryRecordClosure(document, ['gap:unknown'], {
      maxRecords: 10,
      maxBytes: 100_000,
    });
    expect(oversized.ids).toEqual([]);
    expect(oversized.oversized).toEqual(['gap:unknown']);
  });
});
