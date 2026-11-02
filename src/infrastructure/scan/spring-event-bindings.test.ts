import { describe, expect, it, vi } from 'vitest';

import { collectJavaBindings } from './java-call-bindings';
import { declarationSource } from './java-declaration-parts';
import { javaDeclarations } from './java-declarations';
import { indexSource } from './source-index';
import { collectEventBindings } from './spring-event-bindings';

vi.mock(import('server-only'), () => ({}));

function extract(content: string) {
  const index = indexSource({ path: 'src/main/java/Events.java', language: 'java', content });
  expect(index.diagnostics).toEqual([]);
  const unit = javaDeclarations(index);
  if (!unit) throw new Error('Expected declarations');
  const indexes = [index];
  const units = [unit];
  const records = collectEventBindings({ indexes, units, ...collectJavaBindings(indexes, units) });
  const text = (source: string) =>
    index.nodes.find((node) => declarationSource(index, node) === source)?.text;
  return { records, index, text };
}

const IMPORTS = `import com.volvocars.ecom.kafka.producer.KafkaEventPublisher;
import org.springframework.kafka.core.KafkaTemplate;
import java.util.Objects;`;

describe('event source construction', () => {
  it('retains all skip decisions, changed-value comparisons and constructor ordinal bindings', () => {
    const { records, text } = extract(`${IMPORTS}
      record Input(String id, String choice) {}
      record Payload(String identity, String selection) {}
      class Events {
        KafkaEventPublisher publisher; KafkaTemplate<String, Payload> template;
        void emit(Input before, Input current, boolean enabled) {
          if (template == null || !enabled) return;
          if (current == null) return;
          if (!changed(before,current)) return;
          Payload value = make(current);
          Object message = publisher.buildEventMessage("topic",current.id(),value,"1","producer");
          publisher.sendSafely(template,message);
        }
        boolean changed(Input before, Input current) {
          if (before == null) return true;
          return !Objects.equals(before.choice(),current.choice());
        }
        Payload make(Input current) { return new Payload(current.id(),current.choice()); }
      }`);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      operation: 'buildEventMessage',
      contract: 'external_sdk_source',
      result_observation: 'assigned',
      completeness: 'partial',
    });
    expect(records[0]?.arguments.map((argument) => argument.role)).toEqual([
      'topic_selector',
      'key',
      'event',
      'version',
      'producer',
    ]);
    expect(records[0]?.conditions).toHaveLength(4);
    expect(records[0]?.constructions[0]?.fields.map((field) => field.field)).toEqual([
      'identity',
      'selection',
    ]);
    expect(records[0]?.constructions[0]?.fields.map((field) => text(field.value_source))).toEqual([
      'current.id()',
      'current.choice()',
    ]);
    expect(records[0]?.conditions.map((condition) => text(condition.condition_source))).toEqual([
      'template == null || !enabled',
      'current == null',
      '!changed(before,current)',
      'before == null',
    ]);
    const equality = records[0]?.comparisons.find(
      (comparison) => text(comparison.source) === 'before == null',
    );
    expect(equality?.operand_sources.map(text)).toEqual(['before', 'null']);
    expect(records[0]?.comparisons.length).toBeGreaterThan(1);
    expect(records[0]?.call_binding_ids.length).toBeGreaterThan(1);
    expect(records[0]?.value_binding_ids.length).toBeGreaterThan(1);
    expect(records[1]?.result_observation).toBe('discarded');
  });

  it('does not infer a publisher from a method name, field order, or deferred lambda', () => {
    const { records } = extract(`${IMPORTS}
      class Payload { String other; String first; Payload(String first,String other) {} }
      class Events {
        KafkaEventPublisher publisher;
        void emit(Fake fake) {
          fake.sendSafely("x");
          Runnable later = () -> { if (true) return; };
          publisher.buildEventMessage("topic","key",new Payload("one","two"),"1","source");
        }
      }`);
    expect(records).toHaveLength(1);
    expect(records[0]?.conditions).toEqual([]);
    expect(records[0]?.constructions[0]?.fields).toEqual([]);
  });

  it('maps explicit class constructor assignments independently of declaration order', () => {
    const { records, text } = extract(`${IMPORTS}
      class Payload { String other; String first; Payload(String a,String b) { this.first=a; this.other=b; } }
      class Events { KafkaEventPublisher publisher;
        void emit() { publisher.buildEventMessage("topic","key",new Payload("one","two"),"1","source"); }
      }`);
    expect(
      records[0]?.constructions[0]?.fields.map((field) => [field.field, text(field.value_source)]),
    ).toEqual([
      ['first', '"one"'],
      ['other', '"two"'],
    ]);
  });

  it('retains a private source helper candidate when an external accessor type is unknown', () => {
    const { records, text } = extract(`${IMPORTS}
      record Payload(String value) {}
      class Events { KafkaEventPublisher publisher;
        void emit(External external) { Object event = make(external.generated()); publisher.buildEventMessage("topic","key",event,"1","source"); }
        private Payload make(String input) { return new Payload(input); }
      }`);
    expect(records[0]?.constructions[0]?.fields.map((field) => field.field)).toEqual(['value']);
    const candidates = records[0]?.selectors.filter((selector) => selector.operation === 'make');
    expect(candidates?.[0]?.target_source).toBeNull();
    expect(records[0]?.candidate_helpers).toHaveLength(1);
    expect(records[0]?.candidate_helpers[0]?.resolution).toBe('source_candidate');
    expect(records[0]?.candidate_helpers[0]?.argument_sources.map(text)).toEqual([
      'external.generated()',
    ]);
    expect(records[0]?.candidate_helpers[0]?.parameter_sources.map(text)).toEqual(['String input']);
  });

  it('refuses ambiguous private overloads and varargs candidate joins', () => {
    const { records } = extract(`${IMPORTS}
      record Payload(String value) {}
      class Events { KafkaEventPublisher publisher;
        void emit(External external) { Object a=make(external.generated()); Object b=many(external.generated()); publisher.buildEventMessage("topic","key",a,"1","source"); }
        private Payload make(String input) { return new Payload(input); }
        private Payload make(Integer input) { return new Payload("number"); }
        private Payload many(String... input) { return new Payload("many"); }
      }`);
    expect(records[0]?.candidate_helpers).toEqual([]);
    expect(records[0]?.constructions).toEqual([]);
  });

  it('retains source catches without inferring SDK suppression or acknowledgement', () => {
    const { records } = extract(`${IMPORTS} class Events {
      KafkaEventPublisher publisher; KafkaTemplate<String,String> template;
      void emit() { try { publisher.sendSafely(template,"message"); }
      catch (IllegalArgumentException failure) { throw new IllegalStateException(failure); } }
    }`);
    expect(records[0]?.failure_paths).toHaveLength(1);
    expect(records[0]?.gaps.join(' ')).toContain('acknowledgement');
  });
});
