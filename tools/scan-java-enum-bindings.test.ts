import { describe, expect, it, vi } from 'vitest';

import { declarationSource } from '@/infrastructure/scan/java-declaration-parts';
import { javaDeclarations } from '@/infrastructure/scan/java-declarations';
import { collectEnumBindings } from '@/infrastructure/scan/java-enum-bindings';
import { indexSource } from '@/infrastructure/scan/source-index';

vi.mock(import('server-only'), () => ({}));

function extract(content: string) {
  const index = indexSource({ path: 'core/src/main/java/Types.java', language: 'java', content });
  expect(index.diagnostics).toEqual([]);
  const unit = javaDeclarations(index);
  if (!unit) throw new Error('Expected valid Java declarations.');
  return {
    records: collectEnumBindings({ indexes: [index], units: [unit] }),
    text: (source: string | null | undefined) =>
      index.nodes.find((node) => declarationSource(index, node) === source)?.text,
  };
}

const JACKSON =
  'import com.fasterxml.jackson.annotation.JsonProperty; import com.fasterxml.jackson.annotation.JsonValue;';

describe('native enum declaration bindings', () => {
  it('retains explicit JsonProperty literal values independently of named argument order', () => {
    const { records, text } = extract(
      `${JACKSON}
      enum EventType {
        @JsonProperty(required=true,value="created") CREATED,
        @JsonProperty(value="archived",required=false) ARCHIVED,
        @com.fasterxml.jackson.annotation.JsonProperty("updated") UPDATED,
        UNANNOTATED;
      }`,
    );
    expect(records).toHaveLength(1);
    expect(
      records[0]?.constants.map((constant) => [constant.name, constant.declared_json_name]),
    ).toEqual([
      ['CREATED', 'created'],
      ['ARCHIVED', 'archived'],
      ['UPDATED', 'updated'],
      ['UNANNOTATED', null],
    ]);
    expect(records[0]?.constants.map((constant) => text(constant.json_name_source))).toEqual([
      '"created"',
      '"archived"',
      '"updated"',
      undefined,
    ]);
    expect(records[0]?.constants.map((constant) => constant.annotation_sources.length)).toEqual([
      1, 1, 1, 0,
    ]);
    expect(records[0]).toMatchObject({ codec: 'unobserved', completeness: 'partial' });
  });

  it('uses decoded compiler literals and retains enum constructor arguments with source anchors', () => {
    const { records, text } = extract(String.raw`${JACKSON}
      enum State {
        @JsonProperty("line\nquote\"") VALUE(12,"source"), EMPTY(0,"");
        State(int rank,String value) {}
      }`);
    expect(records[0]?.constants[0]?.declared_json_name).toBe('line\nquote"');
    expect(text(records[0]?.constants[0]?.json_name_source)).toBe(String.raw`"line\nquote\""`);
    expect(records[0]?.constants.map((constant) => constant.argument_sources.map(text))).toEqual([
      ['12', '"source"'],
      ['0', '""'],
    ]);
  });

  it('retains compiler-folded literals and refuses impostors or unresolved annotation values', () => {
    const { records } = extract(`package demo;
      @interface JsonProperty { String value(); }
      enum Fake { @JsonProperty("fake") VALUE }
      enum Actual {
        @com.fasterxml.jackson.annotation.JsonProperty("com" + "puted") COMPUTED,
        @com.fasterxml.jackson.annotation.JsonProperty(required=true) OTHER_ARGUMENT,
        @com.fasterxml.jackson.annotation.JsonProperty("") EMPTY,
        @com.fasterxml.jackson.annotation.JsonProperty(12) NUMERIC,
        @com.fasterxml.jackson.annotation.JsonProperty(EXTERNAL_NAME) UNRESOLVED;
      }`);
    expect(
      records.map((record) => record.constants.map((constant) => constant.declared_json_name)),
    ).toEqual([[null], ['computed', null, null, null, null]]);
    expect(records[0]?.constants[0]?.annotation_sources).toEqual([]);
    expect(
      records[1]?.constants.slice(1).every((constant) => constant.json_name_source === null),
    ).toBe(true);
  });

  it('retains exact JsonValue method sources, nested enum identity and excludes ordinary static fields', () => {
    const { records, text } = extract(`package demo; ${JACKSON}
      class Outer { enum Kind {
        FIRST, SECOND;
        static final String LABEL = "label";
        @JsonValue String wire() { return "custom"; }
        String other() { return "other"; }
      } }
      @interface PretendValue {}
      enum Other { ITEM; @PretendValue String value() {return "fake";} }`);
    expect(records[0]?.type).toBe('demo.Outer.Kind');
    expect(records[0]?.constants.map((constant) => constant.name)).toEqual(['FIRST', 'SECOND']);
    expect(records[0]?.value_method_sources).toHaveLength(1);
    expect(text(records[0]?.value_method_sources[0])).toContain('String wire()');
    expect(records[0]?.constants.every((constant) => constant.declared_json_name === null)).toBe(
      true,
    );
    expect(records[1]?.value_method_sources).toEqual([]);
  });
  it('rejects a same-name JsonValue impostor', () => {
    const { records } = extract(`package demo;
      @interface JsonValue {}
      enum Fake { ITEM; @JsonValue String value() { return "fake"; } }`);
    expect(records[0]?.value_method_sources).toEqual([]);
  });
});
