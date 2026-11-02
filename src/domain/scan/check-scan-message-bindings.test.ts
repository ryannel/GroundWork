import { describe, expect, it } from 'vitest';

import { messageBindingFixture } from '@/../test/scan-message-kit';

import { validateScanDocument } from './check-scan';

type Fixture = ReturnType<typeof messageBindingFixture>;
function expectRejected(record: string, mutate: (fixture: Fixture) => void) {
  const fixture = messageBindingFixture();
  mutate(fixture);
  expect(
    validateScanDocument(fixture.document).some((error) => error.startsWith(`${record}:`)),
  ).toBe(true);
}

function source(fixture: Fixture, id: string) {
  const selected = fixture.document.sources.find((entry) => entry.id === id);
  if (!selected) throw new Error(`Missing synthetic source ${id}`);
  return selected;
}

describe('consumer, configuration and enum source contracts', () => {
  it('accepts explicit uncertainty and cross-file helper, decoder and model evidence', () => {
    expect(validateScanDocument(messageBindingFixture().document)).toEqual([]);
  });

  it('rejects nested wrong-kind and wrong-pin evidence', () => {
    expectRejected('consumer-binding', (fixture) => {
      const changed = fixture;
      changed.consumer.deserialisations[0]!.type_reference_sources = ['host:server'];
    });
    expectRejected('consumer-binding', (fixture) => {
      const changed = fixture;
      source(changed, 'payload-field').commit = 'different-pin';
    });
    expectRejected('configuration-binding', (fixture) => {
      const changed = fixture;
      changed.configuration.selectors[0]!.property_source = 'host:server';
    });
    expectRejected('configuration-binding', (fixture) => {
      const changed = fixture;
      source(changed, 'property').repo = 'foreign/repo';
    });
    expectRejected('enum-binding', (fixture) => {
      const changed = fixture;
      changed.enumeration.constants[0]!.annotation_sources = ['invoke'];
    });
    expectRejected('enum-binding', (fixture) => {
      const changed = fixture;
      source(changed, 'enum-argument').commit = 'different-pin';
    });
  });

  it('rejects detached consumer annotation, selector, parameter and conditional owners', () => {
    expectRejected('consumer-binding', (fixture) => {
      const changed = fixture;
      changed.consumer.owner_source = 'helper';
    });
    expectRejected('consumer-binding', (fixture) => {
      const changed = fixture;
      changed.consumer.annotation_source = 'factory-annotation';
    });
    expectRejected('consumer-binding', (fixture) => {
      const changed = fixture;
      changed.consumer.selectors[0]!.source = 'argument';
    });
    expectRejected('consumer-binding', (fixture) => {
      const changed = fixture;
      changed.consumer.parameters[0]!.source = 'helper-parameter';
    });
    expectRejected('consumer-binding', (fixture) => {
      const changed = fixture;
      changed.consumer.parameters[0]!.payload_annotation_source = 'consumer-condition';
    });
    expectRejected('consumer-binding', (fixture) => {
      const changed = fixture;
      changed.consumer.conditions[0]!.owner_source = 'factory-class';
    });
    expectRejected('consumer-binding', (fixture) => {
      const changed = fixture;
      changed.consumer.factory_candidates[0]!.annotation_source = 'listener-annotation';
    });
  });

  it('rejects detached decoder arguments and model fields without forcing them into listener scope', () => {
    expectRejected('consumer-binding', (fixture) => {
      const changed = fixture;
      changed.consumer.deserialisations[0]!.argument_sources = ['argument'];
    });
    expectRejected('consumer-binding', (fixture) => {
      const changed = fixture;
      changed.consumer.deserialisations[0]!.owner_source = 'listener';
    });
    expectRejected('consumer-binding', (fixture) => {
      const changed = fixture;
      changed.consumer.model_declarations[0]!.field_sources = ['property'];
    });
    expectRejected('consumer-binding', (fixture) => {
      const changed = fixture;
      changed.consumer.call_binding_ids = ['enum-binding'];
    });
    expectRejected('consumer-binding', (fixture) => {
      const changed = fixture;
      changed.consumer.value_binding_ids = ['invoke'];
    });
  });

  it('rejects stale indexed call joins and upgrades of nominal candidates', () => {
    expectRejected('consumer-binding', (fixture) => {
      const changed = fixture;
      changed.consumer.calls[0]!.call_binding_id = 'enum-binding';
    });
    expectRejected('consumer-binding', (fixture) => {
      const changed = fixture;
      changed.consumer.calls[0]!.operation = 'save';
    });
    expectRejected('consumer-binding', (fixture) => {
      const changed = fixture;
      changed.consumer.calls[0]!.receiver_type = 'fixture.Decoy';
    });
    expectRejected('consumer-binding', (fixture) => {
      const changed = fixture;
      changed.consumer.calls[0]!.target_source = 'helper';
    });
    expectRejected('consumer-binding', (fixture) => {
      const changed = fixture;
      changed.consumer.calls[0]!.source = 'selector';
    });
    expectRejected('consumer-binding', (fixture) => {
      const changed = fixture;
      changed.consumer.calls[0]!.owner_source = 'helper';
    });
    expectRejected('consumer-binding', (fixture) => {
      const changed = fixture;
      changed.consumer.calls[0]!.argument_sources = ['topic'];
    });
    expectRejected('consumer-binding', (fixture) => {
      const changed = fixture;
      changed.consumer.call_binding_ids = [];
    });
    expectRejected('consumer-binding', (fixture) => {
      const changed = fixture;
      changed.call.target = 'helper';
      changed.call.resolution = 'exact';
      changed.call.signature = 'fixture.Service#delete(String):void';
    });
  });

  it('rejects detached candidate operands, parameters and mismatched arity', () => {
    expectRejected('consumer-binding', (fixture) => {
      const changed = fixture;
      changed.consumer.candidate_helpers[0]!.argument_sources = ['topic'];
    });
    expectRejected('consumer-binding', (fixture) => {
      const changed = fixture;
      changed.consumer.candidate_helpers[0]!.parameter_sources = ['parameter'];
    });
    expectRejected('consumer-binding', (fixture) => {
      const changed = fixture;
      changed.consumer.candidate_helpers[0]!.parameter_sources = [];
    });
    expectRejected('consumer-binding', (fixture) => {
      const changed = fixture;
      changed.consumer.candidate_helpers[0]!.call_source = 'selector';
    });
    expectRejected('consumer-binding', (fixture) => {
      const changed = fixture;
      changed.call.argumentTypes = [];
    });
  });

  it('rejects configuration property lookups and factory references that disagree with declarations', () => {
    expectRejected('configuration-binding', (fixture) => {
      const changed = fixture;
      changed.configuration.properties[0]!.source = 'argument';
    });
    expectRejected('configuration-binding', (fixture) => {
      const changed = fixture;
      changed.configuration.selectors[0]!.property_key = 'consumer.other-topic';
    });
    expectRejected('configuration-binding', (fixture) => {
      const changed = fixture;
      changed.configuration.selectors[0]!.receiver_type = 'fixture.Decoy';
    });
    expectRejected('configuration-binding', (fixture) => {
      const changed = fixture;
      changed.configuration.selectors[0]!.property_source = 'payload-field';
    });
    expectRejected('configuration-binding', (fixture) => {
      const changed = fixture;
      changed.configuration.factories[0]!.parameter_sources = ['parameter'];
    });
    expectRejected('configuration-binding', (fixture) => {
      const changed = fixture;
      changed.configuration.factories[0]!.call_binding_ids = ['enum-binding'];
    });
    expectRejected('configuration-binding', (fixture) => {
      const changed = fixture;
      changed.document.sources.push({
        ...source(changed, 'factory-call'),
        id: 'foreign-factory-call',
        commit: 'different-pin',
      });
      changed.factoryCall.call = 'foreign-factory-call';
    });
    expectRejected('configuration-binding', (fixture) => {
      const changed = fixture;
      changed.configuration.properties[0]!.value_kind = 'literal';
      changed.configuration.properties[0]!.value = 'active-topic';
    });
  });

  it('rejects invented Java declarations and selectors on resource configuration', () => {
    expectRejected('resource-binding', (fixture) => {
      const changed = fixture;
      changed.resource.declared_type = 'fixture.Settings';
    });
    expectRejected('resource-binding', (fixture) => {
      const changed = fixture;
      changed.resource.prefix = 'consumer';
    });
    expectRejected('resource-binding', (fixture) => {
      const changed = fixture;
      changed.resource.selectors = changed.configuration.selectors;
    });
    expectRejected('resource-binding', (fixture) => {
      const changed = fixture;
      changed.resource.factories = changed.configuration.factories;
    });
  });

  it('rejects enum duplicates, detached members and incomplete JSON name evidence', () => {
    expectRejected('enum-binding', (fixture) => {
      const changed = fixture;
      changed.enumeration.constants.push({ ...changed.enumeration.constants[0]! });
    });
    expectRejected('enum-binding', (fixture) => {
      const changed = fixture;
      changed.enumeration.constants[0]!.source = 'payload-field';
    });
    expectRejected('enum-binding', (fixture) => {
      const changed = fixture;
      changed.enumeration.constants[0]!.annotation_sources = ['factory-annotation'];
    });
    expectRejected('enum-binding', (fixture) => {
      const changed = fixture;
      changed.enumeration.constants[0]!.argument_sources = ['argument'];
    });
    expectRejected('enum-binding', (fixture) => {
      const changed = fixture;
      changed.enumeration.constants[0]!.json_name_source = null;
    });
    expectRejected('enum-binding', (fixture) => {
      const changed = fixture;
      changed.enumeration.constants[0]!.declared_json_name = null;
    });
    expectRejected('enum-binding', (fixture) => {
      const changed = fixture;
      changed.enumeration.value_method_sources = ['helper'];
    });
  });
});
