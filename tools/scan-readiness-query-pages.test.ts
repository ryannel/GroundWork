import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';

import { bindingReviewPages } from './scan-bindings-pages';
import { readinessQueryPages } from './scan-readiness-query-pages';

vi.mock(import('server-only'), () => ({}));
const LIMITS = {
  maxRecords: 2048,
  maxBytes: 16_777_216,
  maxRecordsPerPage: 4,
  maxPageBytes: 65_536,
  idsPerRequest: 32,
};
function fixture() {
  const document = scanFixture();
  const records = Array.from({ length: 40 }, (_, index) => ({
    ...document.sources[0]!,
    id: `source:${String(index)}`,
  }));
  document.sources.push(...records);
  return bindingReviewPages(
    document,
    records.map((record) => record.id),
  );
}

describe('readiness verification of actual public query pages', () => {
  it('accepts continued public responses with two distinct bounded ID selections', () => {
    const pages = fixture();
    const verified = readinessQueryPages(pages, LIMITS);
    expect(verified.ids).toHaveLength(40);
    expect(verified.pages).toBe(10);
    expect(verified.bytes).toBeGreaterThan(verified.rawBytes);
  });

  it('rejects missing continued pages, cross-snapshot cursors and repeated record identities', () => {
    const pages = fixture();
    expect(() =>
      readinessQueryPages(
        pages.filter((_, index) => index !== 1),
        LIMITS,
      ),
    ).toThrow(/Entry query/u);
    expect(() =>
      readinessQueryPages(
        pages.map((page, index) => (index === 0 ? { ...page, snapshot: 'b'.repeat(64) } : page)),
        LIMITS,
      ),
    ).toThrow(/Entry query/u);
    const first = pages[0];
    if (!first?.records[0]) throw new Error('Missing fixture page');
    expect(() =>
      readinessQueryPages(
        [
          {
            ...first,
            records: [first.records[0], first.records[0]],
            nextCursor: null,
            limit: null,
          },
        ],
        LIMITS,
      ),
    ).toThrow(/Entry query/u);
  });

  it('rejects response byte/record overflows, unfinished selections and larger request ID groups', () => {
    const pages = fixture();
    expect(() => readinessQueryPages(pages, { ...LIMITS, maxPageBytes: 512 })).toThrow(
      /Entry query/u,
    );
    expect(() => readinessQueryPages(pages, { ...LIMITS, maxRecordsPerPage: 1 })).toThrow(
      /Entry query/u,
    );
    expect(() => readinessQueryPages(pages, { ...LIMITS, idsPerRequest: 16 })).toThrow(
      /Entry query/u,
    );
    expect(() => readinessQueryPages(pages.slice(0, 1), LIMITS)).toThrow(/Entry query/u);
    expect(() => readinessQueryPages(pages, { ...LIMITS, maxRecords: 20 })).toThrow(/Entry query/u);
  });
});
