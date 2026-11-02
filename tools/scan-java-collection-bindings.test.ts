import { describe, expect, it, vi } from 'vitest';

import { collectJavaBindings } from '@/infrastructure/scan/java-call-bindings';
import { collectJavaCollectionBindings } from '@/infrastructure/scan/java-collection-bindings';
import { javaDeclarations } from '@/infrastructure/scan/java-declarations';
import { indexSource } from '@/infrastructure/scan/source-index';

vi.mock(import('server-only'), () => ({}));

function extract(content: string) {
  const index = indexSource({ path: 'Lists.java', language: 'java', content });
  expect(index.diagnostics).toEqual([]);
  const unit = javaDeclarations(index);
  if (!unit) throw new Error('Expected Java declarations');
  const shared = collectJavaBindings([index], [unit]);
  return collectJavaCollectionBindings({ indexes: [index], units: [unit], ...shared });
}

describe.runIf(process.env.GROUNDWORK_NATIVE_PARSERS === '1')('Java immutable string lists', () => {
  it('preserves ordered literal and referenced constant values with shared factory identity', () => {
    const result = extract(`package fixture; import java.util.List;
      class Lists {
        static final String FIRST = "first";
        static final List<String> ITEMS = List.of(FIRST, "second", FIRST);
        static final List<String> EMPTY = List.of();
      }`);
    expect(result.map((binding) => binding.name)).toEqual(['ITEMS', 'EMPTY']);
    expect(result[0]?.elements.map(({ position, value }) => ({ position, value }))).toEqual([
      { position: 0, value: 'first' },
      { position: 1, value: 'second' },
      { position: 2, value: 'first' },
    ]);
    expect(result[0]?.elements[0]?.constant_source).toEqual(
      result[0]?.elements[2]?.constant_source,
    );
    expect(result[0]?.elements[1]?.constant_source).toBeNull();
    expect(result.map((binding) => binding.factory)).toEqual([
      'java.util.List.of',
      'java.util.List.of',
    ]);
    expect(
      result.every(
        (binding) => binding.factory_call_binding_id === `java-call:${binding.value_source}`,
      ),
    ).toBe(true);
    expect(result[1]?.elements).toEqual([]);
    expect(
      extract(
        'class Lists { static final java.util.List<String> ITEMS = java.util.List.of("qualified"); }',
      )[0]?.elements[0]?.value,
    ).toBe('qualified');
  }, 30_000);

  it('omits mutable, non-string, computed and foreign factory initialisers', () => {
    expect(
      extract(`import java.util.List;
      class Lists {
        static String mutable = "mutable";
        static String lookup() { return "value"; }
        static List<String> MUTABLE_FIELD = List.of("one");
        final List<String> INSTANCE = List.of("one");
        static final List<Integer> NUMBERS = List.of(1);
        static final List<String> UNKNOWN = List.of(mutable);
        static final List<String> COMPUTED = List.of("one" + lookup());
        static final List<String> OTHER = Custom.of("one");
      }
      class Custom { static List<String> of(String value) { return null; } }`),
    ).toEqual([]);
    expect(
      extract(`class Lists {
      static final List<String> ITEMS = List.of("foreign");
    }
    class List<T> { static List<String> of(String value) { return null; } }`),
    ).toEqual([]);
    expect(
      extract(`class Lists {
      static final Helper List = new Helper();
      static final java.util.List<String> ITEMS = List.of("shadow");
    }
    class Helper { java.util.List<String> of(String value) { return null; } }`),
    ).toEqual([]);
    expect(
      extract(`class Lists {
      static Object java = new Object();
      static final java.util.List<String> ITEMS = java.util.List.of("shadowed prefix");
    }`),
    ).toEqual([]);
  }, 30_000);
  it('keeps a package-qualified factory unresolved when its root is a lexical parameter', () => {
    const index = indexSource({
      path: 'Prefix.java',
      language: 'java',
      content: `class Prefix {
      Object shadow(Object java) { return java.util.List.of("shadow"); }
      Object normal() { return java.util.List.of("normal"); }
    }`,
    });
    expect(index.diagnostics).toEqual([]);
    const unit = javaDeclarations(index);
    if (!unit) throw new Error('Expected declarations');
    const calls = collectJavaBindings([index], [unit]).calls.filter(
      (call) => call.methodName === 'of',
    );
    expect(calls.map((call) => call.receiverType)).toEqual([null, 'java.util.List']);
    expect(calls.map((call) => call.target)).toEqual([null, null]);
  }, 30_000);
});
