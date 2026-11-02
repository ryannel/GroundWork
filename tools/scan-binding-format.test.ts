import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import { scanValidator } from '@/infrastructure/scan/scan-format';

vi.mock(import('server-only'), () => ({}));

describe('canonical native binding schema', () => {
  it('accepts explicit collection mapping uncertainty and rejects unknown fields and record kinds', async () => {
    const validate = await scanValidator();
    const document = scanFixture();
    const collection = {
      kind: 'mongo_collection_binding',
      id: 'mongo:collection',
      entityType: 'fixture.Entity',
      collection: null,
      source: 'source:handler',
      gaps: ['Collection mapping unavailable.'],
    };
    expect(validate({ ...document, bindings: [collection] }).bindings).toEqual([collection]);
    expect(() =>
      validate({ ...document, bindings: [{ ...collection, guessedDeployment: true }] }),
    ).toThrow('ScanDocument:');
    expect(() =>
      validate({ ...document, bindings: [{ ...collection, kind: 'mongo_guess' }] }),
    ).toThrow('ScanDocument:');
    expect(() => validate({ ...document, bindings: [{ ...collection, collection: 5 }] })).toThrow(
      'ScanDocument:',
    );
  });
  it('rejects malformed Java resolution records and nested exception source arrays', async () => {
    const validate = await scanValidator();
    const document = scanFixture();
    expect(() =>
      validate({
        ...document,
        bindings: [
          { kind: 'java_call_binding', id: 'call', call: 'source:handler', resolution: 'exact' },
        ],
      }),
    ).toThrow('ScanDocument:');
    expect(() =>
      validate({
        ...document,
        bindings: [{ kind: 'exception_binding', id: 'throw', source_ids: 'source:handler' }],
      }),
    ).toThrow('ScanDocument:');
  });
});
