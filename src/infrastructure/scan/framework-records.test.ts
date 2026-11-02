import { describe, expect, it, vi } from 'vitest';

import { springRecordFixture } from '@/../test/spring-record-kit';

import { createScanRecordReader } from './record-pages';
import { scanValidator } from './scan-format';

vi.mock(import('server-only'), () => ({}));

describe('canonical framework records', () => {
  it('validates the native contract and delivers selected bindings through bounded pages', async () => {
    const { document } = springRecordFixture();
    expect((await scanValidator())(document)).toEqual(document);
    const reader = createScanRecordReader(document);
    const input = {
      ids: ['schema:test', 'security:test', 'route:test'],
      maxRecords: 1,
      maxBytes: 4096,
    };
    const first = reader.page(input);
    expect(first.records.map((record) => record.kind)).toEqual(['route_binding']);
    expect(first.scope).toBe('selected-records-only');
    const second = reader.page({ ...input, cursor: first.nextCursor ?? '' });
    expect(second.records.map((record) => record.kind)).toEqual(['schema_binding']);
    const third = reader.page({ ...input, cursor: second.nextCursor ?? '' });
    expect(third.records.map((record) => record.kind)).toEqual(['security_binding']);
    expect(third.nextCursor).toBeNull();
  });

  it('rejects malformed structure and validly shaped dangling references at the public boundary', async () => {
    const check = await scanValidator();
    const { document } = springRecordFixture();
    expect(() =>
      check({ ...document, framework: [{ kind: 'schema_binding', id: 'incomplete' }] }),
    ).toThrow('ScanDocument');
    const { document: dangling, schema } = springRecordFixture();
    schema.properties[0]!.source = 'missing';
    expect(() => check(dangling)).toThrow('missing must reference source');
  });
});
