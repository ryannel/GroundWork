import { describe, expect, it, vi } from 'vitest';

import { archiveBindingFixture } from '@/../test/scan-archive-kit';
import { createScanRecordReader } from '@/infrastructure/scan/record-pages';
import { scanValidator } from '@/infrastructure/scan/scan-format';

vi.mock(import('server-only'), () => ({}));

function replacing<T extends { readonly id: string }>(
  document: ReturnType<typeof archiveBindingFixture>['document'],
  replacement: T,
) {
  return {
    ...document,
    bindings: document.bindings?.map((binding) =>
      binding.id === replacement.id ? replacement : binding,
    ),
  };
}

describe('public schedule and immutable collection format', () => {
  it('validates explicit source uncertainty and delivers separate bounded reusable records', async () => {
    const check = await scanValidator();
    const { document } = archiveBindingFixture();
    expect(check(document)).toEqual(document);
    const reader = createScanRecordReader(document);
    const request = {
      ids: ['schedule-binding', 'collection-binding'],
      maxRecords: 1,
      maxBytes: 64 * 1024,
    };
    const first = reader.page(request);
    expect(first.records.map((record) => record.kind)).toEqual(['java_collection_binding']);
    const second = reader.page({ ...request, cursor: first.nextCursor ?? '' });
    expect(second.records.map((record) => record.kind)).toEqual(['schedule_binding']);
    expect(second.nextCursor).toBeNull();
    expect(first.records.every((record) => JSON.stringify(record).length < 64 * 1024)).toBe(true);
    expect(second.records.every((record) => JSON.stringify(record).length < 64 * 1024)).toBe(true);
  });

  it('rejects runtime activation, global lock and future completion upgrades', async () => {
    const check = await scanValidator();
    const { document, schedule, collection } = archiveBindingFixture();
    for (const binding of [schedule, collection]) {
      expect(() => check(replacing(document, { ...binding, effective: true }))).toThrow(
        'ScanDocument',
      );
    }
    expect(() => check(replacing(document, { ...schedule, activation: 'active' }))).toThrow(
      'ScanDocument',
    );
    expect(() =>
      check(replacing(document, { ...schedule, lock_scope: 'global_async_completion' })),
    ).toThrow('ScanDocument');
    expect(() =>
      check(
        replacing(document, {
          ...schedule,
          async_invocations: [{ ...schedule.async_invocations[0], completed: true }],
        }),
      ),
    ).toThrow('ScanDocument');
    expect(() => check(replacing(document, { ...collection, completeness: 'complete' }))).toThrow(
      'ScanDocument',
    );
  });

  it('requires explicit declaration arrays and rejects unknown nested annotation, condition and element fields', async () => {
    const check = await scanValidator();
    const { document, schedule, collection, async } = archiveBindingFixture();
    for (const field of [
      'annotations',
      'activation_declarations',
      'conditions',
      'lock_provider_sources',
      'async_invocations',
    ]) {
      const missing = { ...schedule };
      Reflect.deleteProperty(missing, field);
      expect(() => check(replacing(document, missing))).toThrow('ScanDocument');
    }
    const missingConditions = { ...async };
    Reflect.deleteProperty(missingConditions, 'conditions');
    expect(() => check(replacing(document, missingConditions))).toThrow('ScanDocument');
    expect(() =>
      check(
        replacing(document, {
          ...schedule,
          annotations: [{ ...schedule.annotations[0], effective: true }],
        }),
      ),
    ).toThrow('ScanDocument');
    expect(() =>
      check(
        replacing(document, {
          ...schedule,
          conditions: [{ ...schedule.conditions[0], evaluated: true }],
        }),
      ),
    ).toThrow('ScanDocument');
    expect(() =>
      check(
        replacing(document, {
          ...collection,
          elements: [{ ...collection.elements[0], runtime_value: 'other' }],
        }),
      ),
    ).toThrow('ScanDocument');
  });

  it('checks kind, pin, ownership and shared invocation joins at the public boundary', async () => {
    const check = await scanValidator();
    const wrongKind = archiveBindingFixture();
    wrongKind.schedule.async_invocations[0]!.async_binding_id = 'collection-binding';
    expect(() => check(wrongKind.document)).toThrow('schedule-binding');
    const wrongPin = archiveBindingFixture();
    wrongPin.document.sources.find((source) => source.id === 'activation')!.commit = 'foreign';
    expect(() => check(wrongPin.document)).toThrow('crosses repository or commit');
    const wrongOwner = archiveBindingFixture();
    wrongOwner.schedule.conditions[0]!.owner_source = 'enable-class';
    expect(() => check(wrongOwner.document)).toThrow('schedule conditions');
    const wrongObservation = archiveBindingFixture();
    wrongObservation.schedule.async_invocations[0]!.dispatch = 'direct_self';
    expect(() => check(wrongObservation.document)).toThrow('scheduled async invocation');
    const staleConstant = archiveBindingFixture();
    staleConstant.reference.to = 'literal-element';
    expect(() => check(staleConstant.document)).toThrow('collection constant');
  });
});
