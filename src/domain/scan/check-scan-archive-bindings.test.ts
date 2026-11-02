import { describe, expect, it } from 'vitest';

import { archiveBindingFixture } from '@/../test/scan-archive-kit';

import { validateScanDocument } from './check-scan';

function expectRejected(
  record: string,
  mutate: (fixture: ReturnType<typeof archiveBindingFixture>) => void,
) {
  const fixture = archiveBindingFixture();
  mutate(fixture);
  expect(
    validateScanDocument(fixture.document).some((error) => error.startsWith(`${record}:`)),
  ).toBe(true);
}

describe('schedule and immutable collection source contracts', () => {
  it('accepts bounded declarations with explicit runtime uncertainty and mixed literal and constant elements', () => {
    expect(validateScanDocument(archiveBindingFixture().document)).toEqual([]);
  });

  it('rejects wrong kinds and foreign pins in every nested source family', () => {
    const mutations: ((fixture: ReturnType<typeof archiveBindingFixture>) => void)[] = [
      (fixture) => {
        const changed = fixture;
        changed.schedule.annotations[0]!.source = 'host:server';
      },
      (fixture) => {
        const changed = fixture;
        changed.schedule.conditions[0]!.source = 'host:server';
      },
      (fixture) => {
        const changed = fixture;
        changed.schedule.activation_declarations[0]!.owner_source = 'host:server';
      },
      (fixture) => {
        const changed = fixture;
        changed.schedule.lock_provider_sources = ['host:server'];
      },
      (fixture) => {
        const changed = fixture;
        changed.schedule.async_invocations[0]!.use_source = 'host:server';
      },
      (fixture) => {
        const changed = fixture;
        changed.schedule.value_binding_ids = ['invoke'];
      },
    ];
    for (const mutate of mutations) expectRejected('schedule-binding', mutate);
    expectRejected('collection-binding', (fixture) => {
      const changed = fixture;
      changed.collection.elements[0]!.constant_source = 'host:server';
    });
    for (const source of [
      'scheduled-annotation',
      'class-condition',
      'activation',
      'executor',
      'use',
      'constant-element',
      'constant',
    ]) {
      const fixture = archiveBindingFixture();
      fixture.document.sources.find((entry) => entry.id === source)!.commit = 'foreign';
      expect(
        validateScanDocument(fixture.document).some((error) =>
          error.includes('crosses repository or commit'),
        ),
      ).toBe(true);
    }
  });

  it('rejects misplaced annotations, missing scheduling and conditions owned by another declaration', () => {
    expectRejected('schedule-binding', (fixture) => {
      const changed = fixture;
      changed.schedule.annotations = [];
    });
    expectRejected('schedule-binding', (fixture) => {
      const changed = fixture;
      changed.schedule.annotations[0]!.annotation_type =
        'org.springframework.scheduling.annotation.EnableScheduling';
    });
    expectRejected('schedule-binding', (fixture) => {
      const changed = fixture;
      changed.schedule.annotations[0]!.owner_source = 'class';
    });
    expectRejected('schedule-binding', (fixture) => {
      const changed = fixture;
      changed.schedule.annotations[0]!.source = 'annotation';
    });
    expectRejected('schedule-binding', (fixture) => {
      const changed = fixture;
      changed.schedule.conditions[0]!.owner_source = 'enable-class';
    });
    expectRejected('schedule-binding', (fixture) => {
      const changed = fixture;
      changed.schedule.activation_declarations[0]!.annotation_type =
        'org.springframework.scheduling.annotation.Scheduled';
    });
  });

  it('rejects detached invocation identity, owner, target, result use and dispatch observations', () => {
    expectRejected('schedule-binding', (fixture) => {
      const changed = fixture;
      changed.schedule.async_invocations[0]!.async_binding_id = 'event-binding';
    });
    expectRejected('schedule-binding', (fixture) => {
      const changed = fixture;
      changed.schedule.async_invocations[0]!.async_binding_id = 'missing';
    });
    expectRejected('schedule-binding', (fixture) => {
      const changed = fixture;
      changed.schedule.async_invocations[0]!.call_binding_id = 'send';
    });
    expectRejected('schedule-binding', (fixture) => {
      const changed = fixture;
      changed.schedule.async_invocations[0]!.call_source = 'event-call';
    });
    expectRejected('schedule-binding', (fixture) => {
      const changed = fixture;
      changed.schedule.async_invocations[0]!.owner_source = null;
    });
    expectRejected('schedule-binding', (fixture) => {
      const changed = fixture;
      changed.schedule.async_invocations[0]!.dispatch = 'direct_self';
    });
    expectRejected('schedule-binding', (fixture) => {
      const changed = fixture;
      changed.schedule.async_invocations[0]!.use = 'joined';
    });
    expectRejected('schedule-binding', (fixture) => {
      const changed = fixture;
      changed.schedule.async_invocations[0]!.use_source = 'return';
    });
    expectRejected('schedule-binding', (fixture) => {
      const changed = fixture;
      changed.schedule.call_binding_ids = [];
    });
    expectRejected('schedule-binding', (fixture) => {
      const changed = fixture;
      changed.call.caller = 'async';
    });
    expectRejected('schedule-binding', (fixture) => {
      const changed = fixture;
      changed.call.target = 'selector-target';
    });
    expectRejected('schedule-binding', (fixture) => {
      const changed = fixture;
      changed.async.invocations = [];
    });
  });

  it('rejects wrong collection factory identity, arity, order and lexical scope', () => {
    expectRejected('collection-binding', (fixture) => {
      const changed = fixture;
      changed.collection.factory_call_binding_id = 'async-binding';
    });
    expectRejected('collection-binding', (fixture) => {
      const changed = fixture;
      changed.collection.factory_call_binding_id = 'missing';
    });
    expectRejected('collection-binding', (fixture) => {
      const changed = fixture;
      changed.factory.receiverType = 'other.List';
    });
    expectRejected('collection-binding', (fixture) => {
      const changed = fixture;
      changed.factory.methodName = 'copyOf';
    });
    expectRejected('collection-binding', (fixture) => {
      const changed = fixture;
      changed.factory.argumentTypes = [];
    });
    expectRejected('collection-binding', (fixture) => {
      const changed = fixture;
      changed.factory.call = 'call';
    });
    expectRejected('collection-binding', (fixture) => {
      const changed = fixture;
      changed.collection.elements[0]!.position = 1;
    });
    expectRejected('collection-binding', (fixture) => {
      const changed = fixture;
      changed.collection.elements[0]!.source = 'call';
    });
    expectRejected('collection-binding', (fixture) => {
      const changed = fixture;
      changed.collection.owner_source = 'async';
    });
    expectRejected('collection-binding', (fixture) => {
      const changed = fixture;
      changed.collection.value_source = 'selector';
    });
  });

  it('rejects stale constant values, nominal types and missing lexical reference links', () => {
    expectRejected('collection-binding', (fixture) => {
      const changed = fixture;
      changed.constant.value = 'removed';
    });
    expectRejected('collection-binding', (fixture) => {
      const changed = fixture;
      changed.constant.type = 'other.String';
    });
    expectRejected('collection-binding', (fixture) => {
      const changed = fixture;
      changed.collection.elements[0]!.constant_source = 'missing';
    });
    expectRejected('collection-binding', (fixture) => {
      const changed = fixture;
      changed.reference.to = 'literal-element';
    });
    expectRejected('collection-binding', (fixture) => {
      const changed = fixture;
      changed.reference.from = 'constant-value';
    });
    expectRejected('collection-binding', (fixture) => {
      const changed = fixture;
      changed.reference.relation = 'initializer';
    });
  });

  it('rejects a duplicate source call identity that the async observation never named', () => {
    expectRejected('schedule-binding', (fixture) => {
      const changed = fixture;
      changed.document.bindings?.push({ ...changed.call, id: 'alias-invoke' });
      changed.schedule.async_invocations[0]!.call_binding_id = 'alias-invoke';
      changed.schedule.call_binding_ids = ['alias-invoke'];
    });
  });

  it('keeps async activation conditions attached to their declared method or class', () => {
    expectRejected('async-binding', (fixture) => {
      const changed = fixture;
      changed.async.conditions[0]!.owner_source = 'enable-class';
    });
    expectRejected('async-binding', (fixture) => {
      const changed = fixture;
      changed.async.conditions[0]!.source = 'host:server';
    });
  });
});
