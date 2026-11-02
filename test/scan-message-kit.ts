import type {
  ConfigurationBinding,
  ConsumerBinding,
  EnumBinding,
  JavaCallBinding,
} from '@/domain/scan/scan.generated';

import { scanFixture } from './scan-kit';

const SPANS = [
  ['listener-class', 'Listener.java', 1, 100],
  ['listener', 'Listener.java', 10, 40],
  ['listener-annotation', 'Listener.java', 10, 11],
  ['topic', 'Listener.java', 11, 11],
  ['parameter', 'Listener.java', 12, 12],
  ['payload-annotation', 'Listener.java', 12, 12],
  ['consumer-condition', 'Listener.java', 2, 2],
  ['call', 'Listener.java', 25, 25],
  ['argument', 'Listener.java', 25, 25],
  ['receiver', 'Listener.java', 25, 25],
  ['selector', 'Listener.java', 30, 30],
  ['factory-class', 'Factory.java', 1, 70],
  ['factory', 'Factory.java', 10, 50],
  ['factory-annotation', 'Factory.java', 10, 10],
  ['factory-parameter', 'Factory.java', 11, 11],
  ['factory-call', 'Factory.java', 20, 20],
  ['factory-receiver', 'Factory.java', 20, 20],
  ['factory-condition', 'Factory.java', 2, 2],
  ['settings', 'Settings.java', 1, 50],
  ['property', 'Settings.java', 3, 3],
  ['resource', 'application.yaml', 1, 20],
  ['resource-property', 'application.yaml', 2, 2],
  ['decoder', 'Decoder.java', 10, 50],
  ['decode-call', 'Decoder.java', 20, 20],
  ['decode-argument', 'Decoder.java', 20, 20],
  ['type-reference', 'Decoder.java', 3, 3],
  ['decode-catch', 'Decoder.java', 30, 32],
  ['decode-throw', 'Decoder.java', 31, 31],
  ['decode-return', 'Decoder.java', 20, 20],
  ['payload', 'Payload.java', 1, 20],
  ['payload-field', 'Payload.java', 2, 2],
  ['helper', 'Service.java', 10, 50],
  ['helper-parameter', 'Service.java', 10, 10],
  ['enum', 'Choice.java', 1, 30],
  ['enum-constant', 'Choice.java', 3, 3],
  ['enum-annotation', 'Choice.java', 3, 3],
  ['enum-argument', 'Choice.java', 3, 3],
  ['enum-value-method', 'Choice.java', 10, 12],
] as const;

function consumer(): ConsumerBinding {
  return {
    kind: 'consumer_binding',
    id: 'consumer-binding',
    source: 'listener',
    owner_source: 'listener-class',
    owner_type: 'fixture.Listener',
    annotation_source: 'listener-annotation',
    selectors: [{ role: 'topics', expression: '"${topic}"', source: 'topic', literal: '${topic}' }],
    parameters: [
      {
        source: 'parameter',
        type: 'java.lang.String',
        payload_annotation_source: 'payload-annotation',
      },
    ],
    conditions: [
      {
        source: 'consumer-condition',
        owner_source: 'listener-class',
        annotation_type: 'org.springframework.boot.autoconfigure.condition.ConditionalOnBean',
        arguments: [{ name: 'value', expression: 'Factory.class' }],
      },
      {
        source: 'factory-condition',
        owner_source: 'factory-class',
        annotation_type: 'org.springframework.boot.autoconfigure.condition.ConditionalOnProperty',
        arguments: [
          { name: 'name', expression: '"consumer.enabled"' },
          { name: 'havingValue', expression: '"true"' },
        ],
      },
    ],
    factory_candidates: [
      {
        source: 'factory',
        annotation_source: 'factory-annotation',
        return_type:
          'org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory<java.lang.String,java.lang.String>',
        selection: 'source_name_candidate',
      },
    ],
    deserialisations: [
      {
        source: 'decode-call',
        owner_source: 'decoder',
        receiver_type: 'tools.jackson.databind.json.JsonMapper',
        argument_sources: ['decode-argument'],
        return_type: 'com.volvocars.services.common.messaging.v2.Event<fixture.Payload>',
        type_reference_sources: ['type-reference'],
      },
    ],
    model_declarations: [
      { source: 'payload', type: 'fixture.Payload', field_sources: ['payload-field'] },
    ],
    calls: [
      {
        call_binding_id: 'invoke',
        source: 'call',
        owner_source: 'listener',
        target_source: null,
        operation: 'delete',
        receiver_type: 'fixture.Service',
        argument_sources: ['argument'],
        execution: 'direct_source',
      },
    ],
    candidate_helpers: [
      {
        call_source: 'call',
        target_source: 'helper',
        argument_sources: ['argument'],
        parameter_sources: ['helper-parameter'],
        resolution: 'nominal_source_candidate',
      },
    ],
    return_sources: ['decode-return'],
    throw_sources: ['decode-throw'],
    catch_sources: ['decode-catch'],
    call_binding_ids: ['invoke'],
    value_binding_ids: [],
    support: ['listener', 'listener-class'],
    activation: 'declared_runtime_unverified',
    acknowledgement: 'unobserved',
    retry: 'unobserved',
    completeness: 'partial',
    gaps: ['Effective listener and broker state unobserved.'],
  };
}

function configuration(): ConfigurationBinding {
  return {
    kind: 'configuration_binding',
    id: 'configuration-binding',
    source: 'settings',
    format: 'java_properties',
    conditions: [],
    declared_type: 'fixture.Settings',
    prefix: 'consumer',
    profile: null,
    properties: [
      {
        key: 'consumer.topic',
        value: null,
        value_kind: 'declaration',
        type: 'java.lang.String',
        source: 'property',
        placeholders: [],
      },
    ],
    selectors: [
      {
        source: 'selector',
        receiver_type: 'fixture.Settings',
        operation: 'topic',
        property_key: 'consumer.topic',
        property_source: 'property',
      },
    ],
    factories: [
      {
        source: 'factory',
        name: 'createFactory',
        return_type: 'org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory',
        parameter_sources: ['factory-parameter'],
        call_binding_ids: ['factory-invoke'],
      },
    ],
    completeness: 'partial',
    gaps: ['Runtime precedence unobserved.'],
  };
}

function resource(): ConfigurationBinding {
  return {
    kind: 'configuration_binding',
    id: 'resource-binding',
    source: 'resource',
    format: 'yaml',
    conditions: [],
    declared_type: null,
    prefix: null,
    profile: 'dev',
    properties: [
      {
        key: 'consumer.topic',
        value: '${TOPIC:source-default}',
        value_kind: 'expression',
        type: null,
        source: 'resource-property',
        placeholders: ['${TOPIC:source-default}'],
      },
    ],
    selectors: [],
    factories: [],
    completeness: 'partial',
    gaps: ['Effective environment unobserved.'],
  };
}

function enumeration(): EnumBinding {
  return {
    kind: 'enum_binding',
    id: 'enum-binding',
    source: 'enum',
    type: 'fixture.Choice',
    constants: [
      {
        name: 'CREATED',
        source: 'enum-constant',
        declared_json_name: 'Created',
        json_name_source: 'enum-annotation',
        annotation_sources: ['enum-annotation'],
        argument_sources: ['enum-argument'],
      },
    ],
    value_method_sources: ['enum-value-method'],
    codec: 'unobserved',
    completeness: 'partial',
    gaps: ['Effective codec unobserved.'],
  };
}

function invocation(): JavaCallBinding {
  return {
    kind: 'java_call_binding',
    id: 'invoke',
    call: 'call',
    caller: 'listener',
    receiver: 'receiver',
    receiverType: 'fixture.Service',
    methodName: 'delete',
    argumentTypes: [null],
    target: null,
    signature: null,
    resolution: 'unresolved',
    reason: 'External accessor result type unknown.',
    guards: [],
  };
}

/** Small synthetic pins exercise nested evidence without importing a repository capture. */
export function messageBindingFixture() {
  const document = scanFixture();
  const template = document.sources[0]!;
  document.sources.push(
    ...SPANS.map(([id, path, from, to]) => ({
      ...template,
      id,
      path,
      lines: [from, to] as [number, number],
    })),
  );
  const consumerBinding = consumer();
  const configurationBinding = configuration();
  const resourceBinding = resource();
  const enumBinding = enumeration();
  const call = invocation();
  const factoryCall: JavaCallBinding = {
    ...call,
    id: 'factory-invoke',
    call: 'factory-call',
    caller: 'factory',
    receiver: 'factory-receiver',
    receiverType: 'fixture.Factory',
    methodName: 'create',
    argumentTypes: [],
  };
  document.bindings = [
    call,
    factoryCall,
    consumerBinding,
    configurationBinding,
    resourceBinding,
    enumBinding,
  ];
  return {
    document,
    consumer: consumerBinding,
    configuration: configurationBinding,
    resource: resourceBinding,
    enumeration: enumBinding,
    call,
    factoryCall,
  };
}
