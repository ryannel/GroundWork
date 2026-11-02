import { describe, expect, it } from 'vitest';

import { eventBindingFixture } from '@/../test/scan-event-kit';

import { validateScanDocument } from './check-scan';

function expectRejected(
  record: string,
  mutate: (fixture: ReturnType<typeof eventBindingFixture>) => void,
) {
  const fixture = eventBindingFixture();
  mutate(fixture);
  expect(
    validateScanDocument(fixture.document).some((error) => error.startsWith(`${record}:`)),
  ).toBe(true);
}

function candidateFixture() {
  const fixture = eventBindingFixture();
  const source = fixture.document.sources.find((entry) => entry.id === 'async')!;
  fixture.document.sources.push(
    { ...source, id: 'helper', lines: [60, 70] },
    { ...source, id: 'helper-parameter', lines: [60, 60] },
  );
  fixture.event.candidate_helpers = [
    {
      call_source: 'event-call',
      target_source: 'helper',
      argument_sources: ['event-arg'],
      parameter_sources: ['helper-parameter'],
      resolution: 'source_candidate',
    },
  ];
  return fixture;
}

describe('async, execution and event source contracts', () => {
  it('accepts source-only uncertainty, class annotations and cross-file constructor field declarations', () => {
    expect(validateScanDocument(eventBindingFixture().document)).toEqual([]);
  });

  it('rejects wrong-pin and wrong-kind evidence in each binding family', () => {
    for (const kind of ['async', 'execution', 'event'] as const) {
      expectRejected(`${kind}-binding`, (fixture) => {
        const changed = fixture;
        changed.document.sources.push({
          ...changed.document.sources[0]!,
          id: 'foreign',
          commit: 'b'.repeat(40),
        });
        changed[kind].support = ['foreign'];
      });
      expectRejected(`${kind}-binding`, (fixture) => {
        const changed = fixture;
        changed[kind].support = ['host:server'];
      });
      expectRejected(`${kind}-binding`, (fixture) => {
        const changed = fixture;
        changed[kind].call_binding_ids = ['event-binding'];
      });
      expectRejected(`${kind}-binding`, (fixture) => {
        const changed = fixture;
        changed[kind].value_binding_ids = ['invoke'];
      });
    }
  });

  it('rejects invocation owners, stale call identities, stale targets and detached use evidence', () => {
    expectRejected('async-binding', (fixture) => {
      const changed = fixture;
      changed.async.invocations[0]!.owner_source = 'async';
    });
    expectRejected('async-binding', (fixture) => {
      const changed = fixture;
      changed.async.invocations[0]!.use_source = 'return';
    });
    expectRejected('async-binding', (fixture) => {
      const changed = fixture;
      changed.async.invocations[0]!.call_binding_id = 'send';
    });
    expectRejected('async-binding', (fixture) => {
      const changed = fixture;
      changed.async.call_binding_ids = [];
    });
    expectRejected('async-binding', (fixture) => {
      const changed = fixture;
      changed.call.target = 'selector-target';
    });
    expectRejected('async-binding', (fixture) => {
      const changed = fixture;
      changed.async.owner_source = 'caller';
    });
  });

  it('rejects execution paths outside the selected method and detached call results', () => {
    for (const field of [
      'return_sources',
      'throw_sources',
      'catch_sources',
      'finally_sources',
    ] as const) {
      expectRejected('execution-binding', (fixture) => {
        const changed = fixture;
        changed.execution[field] = ['call'];
      });
    }
    expectRejected('execution-binding', (fixture) => {
      const changed = fixture;
      changed.execution.transaction_sources = ['executor'];
    });
    expectRejected('execution-binding', (fixture) => {
      const changed = fixture;
      changed.execution.call_results[0]!.call_binding_id = 'invoke';
    });
    expectRejected('execution-binding', (fixture) => {
      const changed = fixture;
      changed.execution.call_results[0]!.use_source = 'use';
    });
    expectRejected('execution-binding', (fixture) => {
      const changed = fixture;
      changed.send.caller = 'caller';
    });
    expectRejected('execution-binding', (fixture) => {
      const changed = fixture;
      changed.execution.call_binding_ids = [];
    });
  });

  it('rejects detached event operands, constructor values and field values absent from its arguments', () => {
    expectRejected('event-binding', (fixture) => {
      const changed = fixture;
      changed.event.client.receiver_source = 'receiver';
    });
    expectRejected('event-binding', (fixture) => {
      const changed = fixture;
      changed.event.arguments[0]!.source = 'return';
    });
    expectRejected('event-binding', (fixture) => {
      const changed = fixture;
      changed.event.constructions[0]!.argument_sources = ['return'];
    });
    expectRejected('event-binding', (fixture) => {
      const changed = fixture;
      changed.event.constructions[0]!.fields[0]!.value_source = 'constructor';
    });
    expectRejected('event-binding', (fixture) => {
      const changed = fixture;
      changed.event.constructions[0]!.fields[0]!.field_source = 'missing';
    });
  });

  it('rejects detached conditions, builder operands and stale selector targets or receiver types', () => {
    expectRejected('event-binding', (fixture) => {
      const changed = fixture;
      changed.event.conditions[0]!.condition_source = 'return';
    });
    expectRejected('event-binding', (fixture) => {
      const changed = fixture;
      changed.event.conditions[0]!.return_sources = ['return'];
    });
    expectRejected('event-binding', (fixture) => {
      const changed = fixture;
      changed.event.builder_calls[0]!.argument_sources = ['return'];
    });
    expectRejected('event-binding', (fixture) => {
      const changed = fixture;
      changed.event.builder_calls[0]!.receiver_source = 'return';
    });
    expectRejected('event-binding', (fixture) => {
      const changed = fixture;
      changed.event.selectors[0]!.target_source = 'async';
    });
    expectRejected('event-binding', (fixture) => {
      const changed = fixture;
      changed.event.selectors[0]!.receiver_type = 'changed.Decoy';
    });
    expectRejected('event-binding', (fixture) => {
      const changed = fixture;
      changed.event.selectors[0]!.operation = 'wrong';
    });
  });
  it('accepts same-file unresolved helper candidates without upgrading them to exact call targets', () => {
    const fixture = candidateFixture();
    expect(validateScanDocument(fixture.document)).toEqual([]);
    expect(fixture.send.resolution).toBe('unresolved');
    expect(fixture.send.target).toBeNull();
  });

  it('rejects candidate arity, unknown calls, unlisted calls and detached formal parameters', () => {
    const wrongArity = candidateFixture();
    wrongArity.event.candidate_helpers[0]!.parameter_sources = [];
    expect(
      validateScanDocument(wrongArity.document).some((error) => error.startsWith('event-binding:')),
    ).toBe(true);
    const unknown = candidateFixture();
    unknown.event.candidate_helpers[0]!.call_source = 'builder';
    expect(
      validateScanDocument(unknown.document).some((error) => error.startsWith('event-binding:')),
    ).toBe(true);
    const unlisted = candidateFixture();
    unlisted.event.call_binding_ids = ['selector-call'];
    expect(
      validateScanDocument(unlisted.document).some((error) => error.startsWith('event-binding:')),
    ).toBe(true);
    const detached = candidateFixture();
    detached.event.candidate_helpers[0]!.parameter_sources = ['event-arg'];
    expect(
      validateScanDocument(detached.document).some((error) => error.startsWith('event-binding:')),
    ).toBe(true);
  });
});
