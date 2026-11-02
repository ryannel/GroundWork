import { describe, expect, it, vi } from 'vitest';

import { messageBindingFixture } from '@/../test/scan-message-kit';
import { createScanRecordReader } from '@/infrastructure/scan/record-pages';
import { scanValidator } from '@/infrastructure/scan/scan-format';

vi.mock(import('server-only'), () => ({}));

function replacing<T extends { readonly id: string }>(
  document: ReturnType<typeof messageBindingFixture>['document'],
  replacement: T,
) {
  return {
    ...document,
    bindings: document.bindings?.map((binding) =>
      binding.id === replacement.id ? replacement : binding,
    ),
  };
}

describe('public consumer, configuration and enum format', () => {
  it('validates closed source declarations and delivers each kind through bounded record pages', async () => {
    const check = await scanValidator();
    const { document } = messageBindingFixture();
    expect(check(document)).toEqual(document);
    const reader = createScanRecordReader(document);
    const first = reader.page({
      ids: ['consumer-binding', 'configuration-binding', 'enum-binding'],
      maxRecords: 1,
      maxBytes: 12_000,
    });
    expect(first.records.map((record) => record.kind)).toEqual(['configuration_binding']);
    const second = reader.page({
      ids: ['consumer-binding', 'configuration-binding', 'enum-binding'],
      maxRecords: 1,
      maxBytes: 12_000,
      cursor: first.nextCursor ?? '',
    });
    expect(second.records.map((record) => record.kind)).toEqual(['consumer_binding']);
    const third = reader.page({
      ids: ['consumer-binding', 'configuration-binding', 'enum-binding'],
      maxRecords: 1,
      maxBytes: 12_000,
      cursor: second.nextCursor ?? '',
    });
    expect(third.records.map((record) => record.kind)).toEqual(['enum_binding']);
    expect(third.nextCursor).toBeNull();
  });

  it('rejects effective activation, broker acknowledgement, retry and codec claims', async () => {
    const check = await scanValidator();
    const { document, consumer, configuration, enumeration } = messageBindingFixture();
    for (const binding of [consumer, configuration, enumeration]) {
      expect(() => check(replacing(document, { ...binding, effective: true }))).toThrow(
        'ScanDocument',
      );
    }
    expect(() => check(replacing(document, { ...consumer, activation: 'active' }))).toThrow(
      'ScanDocument',
    );
    expect(() =>
      check(replacing(document, { ...consumer, acknowledgement: 'acknowledged' })),
    ).toThrow('ScanDocument');
    expect(() => check(replacing(document, { ...consumer, retry: 'configured' }))).toThrow(
      'ScanDocument',
    );
    expect(() => check(replacing(document, { ...enumeration, codec: 'jackson' }))).toThrow(
      'ScanDocument',
    );
  });

  it('rejects missing explicit candidate/condition arrays and exact candidate upgrades', async () => {
    const check = await scanValidator();
    const { document, consumer } = messageBindingFixture();
    for (const field of ['candidate_helpers', 'conditions']) {
      const missing = { ...consumer };
      Reflect.deleteProperty(missing, field);
      expect(() => check(replacing(document, missing))).toThrow('ScanDocument');
    }
    expect(() =>
      check(
        replacing(document, {
          ...consumer,
          candidate_helpers: [{ ...consumer.candidate_helpers[0], resolution: 'exact' }],
        }),
      ),
    ).toThrow('ScanDocument');
    expect(() =>
      check(
        replacing(document, {
          ...consumer,
          calls: [{ ...consumer.calls[0], execution: 'scheduled' }],
        }),
      ),
    ).toThrow('ScanDocument');
  });

  it('rejects unknown nested property, selector and enum fields', async () => {
    const check = await scanValidator();
    const { document, consumer, configuration, enumeration } = messageBindingFixture();
    expect(() =>
      check(
        replacing(document, {
          ...consumer,
          selectors: [{ ...consumer.selectors[0], effective_topic: 'runtime-topic' }],
        }),
      ),
    ).toThrow('ScanDocument');
    expect(() =>
      check(
        replacing(document, {
          ...configuration,
          properties: [{ ...configuration.properties[0], resolved: true }],
        }),
      ),
    ).toThrow('ScanDocument');
    expect(() =>
      check(
        replacing(document, {
          ...enumeration,
          constants: [{ ...enumeration.constants[0], effective_wire_name: 'runtime-name' }],
        }),
      ),
    ).toThrow('ScanDocument');
  });

  it('checks kind, pin and declaration joins at the public boundary', async () => {
    const check = await scanValidator();
    const wrongKind = messageBindingFixture();
    wrongKind.consumer.model_declarations[0]!.field_sources = ['host:server'];
    expect(() => check(wrongKind.document)).toThrow('must reference source');
    const wrongLookup = messageBindingFixture();
    wrongLookup.configuration.selectors[0]!.property_key = 'consumer.other';
    expect(() => check(wrongLookup.document)).toThrow('configuration-binding');
    const wrongEnum = messageBindingFixture();
    wrongEnum.enumeration.constants[0]!.json_name_source = null;
    expect(() => check(wrongEnum.document)).toThrow('enum-binding');
  });
});
