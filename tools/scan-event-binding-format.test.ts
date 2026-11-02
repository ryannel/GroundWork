import { describe, expect, it, vi } from 'vitest';

import { eventBindingFixture } from '@/../test/scan-event-kit';
import { scanValidator } from '@/infrastructure/scan/scan-format';

vi.mock(import('server-only'), () => ({}));

function replaceBinding<T extends { readonly id: string }>(
  document: ReturnType<typeof eventBindingFixture>['document'],
  replacement: T,
) {
  return {
    ...document,
    bindings: document.bindings?.map((binding) =>
      binding.id === replacement.id ? replacement : binding,
    ),
  };
}

describe('public async, execution and event format', () => {
  it('accepts all three closed source-only contracts through the public boundary', async () => {
    const check = await scanValidator();
    const { document } = eventBindingFixture();
    expect(check(document)).toEqual(document);
  });

  it('rejects unsupported delivery, activation and completion claims', async () => {
    const check = await scanValidator();
    const { document, async, execution, event } = eventBindingFixture();
    for (const binding of [async, execution, event]) {
      expect(() => check(replaceBinding(document, { ...binding, delivered: true }))).toThrow(
        'ScanDocument',
      );
    }
    expect(() => check(replaceBinding(document, { ...async, activation: 'active' }))).toThrow(
      'ScanDocument',
    );
    expect(() =>
      check(replaceBinding(document, { ...execution, completion: 'completed' })),
    ).toThrow('ScanDocument');
    expect(() => check(replaceBinding(document, { ...event, contract: 'guessed' }))).toThrow(
      'ScanDocument',
    );
  });

  it('rejects malformed nested operands and invented invocation dispatch states', async () => {
    const check = await scanValidator();
    const { document, async, event } = eventBindingFixture();
    expect(() =>
      check(
        replaceBinding(document, {
          ...async,
          invocations: [{ ...async.invocations[0], dispatch: 'intercepted' }],
        }),
      ),
    ).toThrow('ScanDocument');
    expect(() =>
      check(
        replaceBinding(document, {
          ...event,
          arguments: [{ position: -1, source: 'event-arg', role: 'message', type: null }],
        }),
      ),
    ).toThrow('ScanDocument');
    expect(() =>
      check(
        replaceBinding(document, {
          ...event,
          constructions: [{ ...event.constructions[0], unexpected: 'value' }],
        }),
      ),
    ).toThrow('ScanDocument');
  });

  it('uses semantic validation for wrong-kind nested evidence and stale Java call links', async () => {
    const check = await scanValidator();
    const fixture = eventBindingFixture();
    fixture.event.arguments[0]!.source = 'host:server';
    expect(() => check(fixture.document)).toThrow('must reference source');
    const stale = eventBindingFixture();
    stale.async.invocations[0]!.call_binding_id = 'send';
    expect(() => check(stale.document)).toThrow('async-binding');
  });
  it('requires explicit source candidate arrays and rejects upgrades to exact resolution', async () => {
    const check = await scanValidator();
    const { document, event } = eventBindingFixture();
    const missing = { ...event };
    Reflect.deleteProperty(missing, 'candidate_helpers');
    expect(() => check(replaceBinding(document, missing))).toThrow('ScanDocument');
    expect(() =>
      check(
        replaceBinding(document, {
          ...event,
          candidate_helpers: [
            {
              call_source: 'event-call',
              target_source: 'async',
              argument_sources: [],
              parameter_sources: [],
              resolution: 'exact',
            },
          ],
        }),
      ),
    ).toThrow('ScanDocument');
  });
});
