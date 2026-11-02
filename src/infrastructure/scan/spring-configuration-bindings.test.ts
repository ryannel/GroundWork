import { describe, expect, it, vi } from 'vitest';

import { collectJavaBindings } from './java-call-bindings';
import { javaDeclarations } from './java-declarations';
import { indexSource } from './source-index';
import { collectConfigurationBindings } from './spring-configuration-bindings';
import { configurationResourceBindings } from './spring-configuration-resources';

vi.mock(import('server-only'), () => ({}));

function extract(content: string, sourcePath = 'module/src/main/java/Settings.java') {
  const index = indexSource({
    path: sourcePath,
    language: 'java',
    content,
  });
  const unit = javaDeclarations(index);
  if (!unit) throw new Error('Expected valid Java declarations.');
  const indexes = [index];
  const units = [unit];
  return collectConfigurationBindings({ indexes, units, ...collectJavaBindings(indexes, units) });
}

function yaml(content: string, file = 'module/src/main/resources/application.yml') {
  return configurationResourceBindings({
    repo: 'example/service',
    commit: 'a'.repeat(40),
    blob: 'b'.repeat(40),
    path: file,
    content,
  });
}

describe('declared Spring configuration', () => {
  it('recognises root-relative production declarations while excluding test declarations', () => {
    const content =
      'import org.springframework.boot.context.properties.ConfigurationProperties; @ConfigurationProperties(prefix="queue") record Settings(String topic) {}';
    expect(extract(content, 'src/main/java/Settings.java')).toHaveLength(1);
    expect(extract(content, 'src/test/java/Settings.java')).toEqual([]);
    expect(extract(content, 'other-src/main/java/Settings.java')).toEqual([]);
  });
  it('joins exact nominal record selectors to kebab case keys and excludes wrong receivers', () => {
    const records = extract(`package demo;
      import org.springframework.boot.context.properties.ConfigurationProperties;
      @ConfigurationProperties(prefix="kafka.customer-event") record Settings(boolean enabled,String topicName) {}
      record Decoy(String topicName) {}
      class Publisher { Settings settings; Decoy decoy;
        String topic() { decoy.topicName(); settings.topicName("wrong"); return settings.topicName(); }
      }`);
    expect(records).toHaveLength(1);
    expect(records[0]?.properties.map((property) => property.key)).toEqual([
      'kafka.customer-event.enabled',
      'kafka.customer-event.topic-name',
    ]);
    expect(records[0]?.selectors).toHaveLength(1);
    expect(records[0]?.selectors[0]).toMatchObject({
      receiver_type: 'demo.Settings',
      property_key: 'kafka.customer-event.topic-name',
    });
    expect(records[0]?.properties[0]).toMatchObject({ value: null, value_kind: 'declaration' });
  });

  it('rejects short annotation impostors and custom accessor guesses', () => {
    expect(
      extract(`@interface ConfigurationProperties { String prefix(); }
      @ConfigurationProperties(prefix="fake") record Settings(String topicName) {}`),
    ).toEqual([]);
    const records =
      extract(`import org.springframework.boot.context.properties.ConfigurationProperties;
      @ConfigurationProperties(prefix="real") class Settings { String topicName; String topicName(){return "other";} }
      class Use { Settings settings; String use(){return settings.topicName();} }`);
    expect(records[0]?.selectors).toEqual([]);
  });

  it('retains only conditions of exact source-linked bean candidates', () => {
    const records = extract(`package demo;
      import org.springframework.boot.context.properties.ConfigurationProperties;
      import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
      import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
      import org.springframework.context.annotation.Bean;
      @ConfigurationProperties(prefix="kafka.customer") record Settings(boolean enabled,String topicName) {}
      @ConditionalOnProperty(name="kafka.customer.enabled",havingValue="true")
      class Producer {
        @Bean @ConditionalOnBean(Settings.class) Object template() { return new Object(); }
      }
      @ConditionalOnProperty(name="kafka.unrelated.enabled",havingValue="true")
      class Unrelated { @Bean Object ignored() {return new Object();} }
      class Consumer {
        @Bean @ConditionalOnProperty(name="kafka.customer.enabled",havingValue="true")
        Object selected(Settings settings) {return new Object();}
      }`);
    expect(records).toHaveLength(1);
    expect(records[0]?.factories.map((factory) => factory.name)).toEqual(['template', 'selected']);
    expect(records[0]?.conditions).toHaveLength(3);
    expect(records[0]?.conditions.map((condition) => condition.annotation_type)).toEqual([
      'org.springframework.boot.autoconfigure.condition.ConditionalOnProperty',
      'org.springframework.boot.autoconfigure.condition.ConditionalOnBean',
      'org.springframework.boot.autoconfigure.condition.ConditionalOnProperty',
    ]);
    expect(records[0]?.conditions[0]?.arguments).toContainEqual({
      name: 'havingValue',
      expression: '"true"',
    });
  });

  it('retains typed scalars, missing placeholders and source profile declarations without evaluation', () => {
    const result = yaml(
      `kafka:\n  enabled: false\n  count: 3\n  empty: null\n  topic-name: \${MISSING_TOPIC:source-default}\nlist: [one, two]\n`,
      'module/src/main/resources/application-local.yml',
    );
    expect(result.gaps).toEqual([]);
    expect(result.bindings[0]?.profile).toBe('local');
    expect(result.bindings[0]?.properties).toEqual([
      expect.objectContaining({ key: 'kafka.enabled', value: false, value_kind: 'literal' }),
      expect.objectContaining({ key: 'kafka.count', value: 3, value_kind: 'literal' }),
      expect.objectContaining({ key: 'kafka.empty', value: null, value_kind: 'literal' }),
      expect.objectContaining({
        key: 'kafka.topic-name',
        value: `\${MISSING_TOPIC:source-default}`,
        value_kind: 'expression',
        placeholders: ['MISSING_TOPIC:source-default'],
      }),
    ]);
    expect(result.sources.every((source) => source.commit === 'a'.repeat(40))).toBe(true);
  });

  it('keeps document profiles separate and rejects invalid duplicate keys', () => {
    const result = yaml(
      'spring.config.activate.on-profile: production\ntopic: first\n---\ntopic: second\n',
    );
    expect(result.bindings.map((binding) => binding.profile)).toEqual(['production', null]);
    expect(yaml('topic: first\ntopic: second').bindings).toEqual([]);
    expect(yaml('topic: first\ntopic: second').gaps).toHaveLength(1);
  });
});
