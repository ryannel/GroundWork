import { describe, expect, it, vi } from 'vitest';

import { collectJavaBindings } from './java-call-bindings';
import { declarationSource } from './java-declaration-parts';
import { javaDeclarations } from './java-declarations';
import { indexSource } from './source-index';
import { collectConsumerBindings } from './spring-consumer-bindings';

vi.mock(import('server-only'), () => ({}));

function extract(content: string, path = 'module/src/main/java/Consumer.java') {
  const index = indexSource({ path, language: 'java', content });
  expect(index.diagnostics).toEqual([]);
  const unit = javaDeclarations(index);
  if (!unit) throw new Error('Expected Java declarations');
  const input = { indexes: [index], units: [unit], ...collectJavaBindings([index], [unit]) };
  const records = collectConsumerBindings(input);
  const text = (source: string) =>
    index.nodes.find((node) => declarationSource(index, node) === source)?.text;
  return { records, text, input };
}

const IMPORTS = `import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.context.annotation.Bean;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.core.type.TypeReference;
import com.volvocars.services.common.messaging.v2.Event;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;`;

describe('Spring Kafka source consumer bindings', () => {
  it('retains selectors, generic deserialisation, local payload and nominal source helper lineage', () => {
    const { records, text } = extract(`${IMPORTS}
      record PayloadData(String customerId) {}
      class Decoder {
        JsonMapper mapper;
        TypeReference<Event<PayloadData>> ref = new TypeReference<>() {};
        Event<PayloadData> deserialize(String json) {
          try { return mapper.readValue(json,ref); }
          catch (RuntimeException error) { throw new IllegalStateException(error); }
        }
      }
      class Service { void deleteCustomer(String id) {} }
      @ConditionalOnBean(Decoder.class)
      class Consumer {
        Decoder decoder; Service service;
        @ConditionalOnProperty(name="consumer.enabled",havingValue="true")
        @Bean("deleteFactory") ConcurrentKafkaListenerContainerFactory<String,String> factory() { return null; }
        @KafkaListener(topics="\u0024{topic}",groupId="#{group}",containerFactory="deleteFactory",batch="false")
        void consume(@Payload String json) {
          Event<PayloadData> event=decoder.deserialize(json);
          service.deleteCustomer(event.getPayload().customerId());
          Runnable deferred=() -> { throw new UnsupportedOperationException(); };
        }
      }`);
    const binding = records[0];
    expect(records).toHaveLength(1);
    expect(binding?.selectors.map((entry) => [entry.role, entry.literal])).toEqual([
      ['topics', `\${topic}`],
      ['groupId', '#{group}'],
      ['containerFactory', 'deleteFactory'],
      ['batch', 'false'],
    ]);
    expect(binding?.selectors.map((entry) => text(entry.source))).toContain(`"\${topic}"`);
    expect(binding?.factory_candidates).toHaveLength(1);
    expect(binding?.parameters[0]?.type).toBe('java.lang.String');
    expect(binding?.conditions.map((entry) => entry.annotation_type)).toEqual([
      'org.springframework.boot.autoconfigure.condition.ConditionalOnBean',
      'org.springframework.boot.autoconfigure.condition.ConditionalOnProperty',
    ]);
    expect(binding?.conditions[1]?.arguments).toContainEqual({
      name: 'havingValue',
      expression: '"true"',
    });
    expect(binding?.deserialisations[0]?.return_type).toBe(
      'com.volvocars.services.common.messaging.v2.Event<PayloadData>',
    );
    expect(binding?.deserialisations[0]?.type_reference_sources.map(text)).toEqual([
      'TypeReference<Event<PayloadData>> ref = new TypeReference<>() {};',
    ]);
    expect(binding?.model_declarations.map((entry) => entry.type)).toContain('PayloadData');
    expect(binding?.candidate_helpers.map((entry) => text(entry.target_source))).toEqual([
      'void deleteCustomer(String id) {}',
    ]);
    expect(binding?.throw_sources.map(text)).toEqual(['throw new IllegalStateException(error);']);
    const deletion = binding?.calls.find((entry) => entry.operation === 'deleteCustomer');
    expect(deletion?.target_source).toBeNull();
    expect(binding?.acknowledgement).toBe('unobserved');
    expect(binding?.retry).toBe('unobserved');
    expect(binding?.call_binding_ids.length).toBeGreaterThan(1);
    expect(binding?.value_binding_ids.length).toBeGreaterThan(1);
  });

  it('refuses wrong annotation identities, test declarations and wrong mapper identities', () => {
    expect(
      extract(
        'import unrelated.KafkaListener; class Consumer { @KafkaListener(topics="x") void consume(String json) {} }',
      ).records,
    ).toEqual([]);
    expect(
      extract(
        `${IMPORTS} class Consumer { @KafkaListener(topics="x") void consume(String json) {} }`,
        'module/src/test/java/Consumer.java',
      ).records,
    ).toEqual([]);
    const { records } = extract(`import org.springframework.kafka.annotation.KafkaListener;
      import unrelated.JsonMapper;
      class Consumer { JsonMapper mapper; @KafkaListener(topics="x") Object consume(String json) { return mapper.readValue(json,Object.class); } }`);
    expect(records[0]?.deserialisations).toEqual([]);
  });

  it('keeps inherited concrete candidates and rejects overload, varargs and abstract candidates', () => {
    const { records, text } = extract(`${IMPORTS}
      class Base { void inherited(String id) {} }
      class Service extends Base {
        void overloaded(String id) {} void overloaded(Integer id) {}
        void many(String... ids) {}
        void incompatible(String fixed, String id) {}
      }
      interface AbstractService { void absent(String id); }
      class Consumer { Service service; AbstractService external;
        @KafkaListener(topics="x") void consume(External event) {
          service.inherited(event.unknown()); service.overloaded(event.unknown());
          service.many(event.unknown()); external.absent(event.unknown());
          service.incompatible(42,event.unknown());
        }
      }`);
    expect(records[0]?.candidate_helpers.map((entry) => text(entry.target_source))).toEqual([
      'void inherited(String id) {}',
    ]);
  });

  it('keeps source application-service bodies in the shared graph and async bodies separate', () => {
    const { records, input } = extract(`${IMPORTS}
      import org.springframework.scheduling.annotation.Async;
      class Service { void perform(String value) { effect(value); } void effect(String value) {} }
      class Consumer { Service service;
        @KafkaListener(topics="x") void consume(String json) { local(json); later(json); }
        private void local(String json) { service.perform(json); }
        @Async void later(String json) { service.effect(json); }
      }`);
    const binding = records[0];
    expect(binding?.calls.map((call) => call.operation)).toEqual(['local', 'later', 'perform']);
    expect(
      binding?.calls.find((call) => call.operation === 'perform')?.target_source,
    ).not.toBeNull();
    expect(input.calls.some((call) => call.methodName === 'effect')).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(binding))).toBeLessThan(65_536);
  });

  it('uses shared lexical references instead of attaching a shadowed TypeReference field', () => {
    const { records } = extract(`${IMPORTS}
      record Data(String value) {}
      class Consumer { JsonMapper mapper;
        TypeReference<Event<Data>> reference = new TypeReference<>() {};
        @KafkaListener(topics="x") Event<Data> consume(String json) {
          String reference="decoy";
          return mapper.readValue(json,reference);
        }
      }`);
    expect(records[0]?.deserialisations).toHaveLength(1);
    expect(records[0]?.deserialisations[0]?.type_reference_sources).toEqual([]);
  });

  it('distinguishes async declarations and deferred execution ownership', () => {
    const { records, text } = extract(`${IMPORTS}
      import org.springframework.scheduling.annotation.Async;
      class Consumer {
        @KafkaListener(topics="x") void consume(String json) { later(json); Runnable task=() -> later("deferred"); }
        @Async void later(String json) { throw new IllegalStateException(); }
      }`);
    expect(
      records[0]?.calls
        .filter((entry) => entry.operation === 'later')
        .map((entry) => [text(entry.source), entry.execution]),
    ).toEqual([
      ['later(json)', 'async_declared'],
      ['later("deferred")', 'deferred_source'],
    ]);
  });
});
