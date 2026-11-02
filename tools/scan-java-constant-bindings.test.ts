import { describe, expect, it, vi } from 'vitest';

import { collectJavaConstantBindings } from '@/infrastructure/scan/java-constant-bindings';
import { declarationSource } from '@/infrastructure/scan/java-declaration-parts';
import { javaDeclarations } from '@/infrastructure/scan/java-declarations';
import { indexSource } from '@/infrastructure/scan/source-index';

vi.mock(import('server-only'), () => ({}));
const NATIVE = process.env.GROUNDWORK_NATIVE_PARSERS === '1';

describe.skipIf(!NATIVE)('native Java literal constant bindings', () => {
  it('preserves compiler values and evidence while omitting expressions and mutable or local fields', () => {
    const index = indexSource({
      path: 'Constants.java',
      language: 'java',
      content: String.raw`package fixture;
      class Constants {
        static final String ENDPOINT = "/userinfo";
        static final String ESCAPED = "line\nnext";
        static final int HEX = 0x2a;
        static final double FRACTION = 1.25;
        static final boolean ENABLED = true;
        static final boolean DISABLED = false;
        static final char CHARACTER = '\n';
        static final String ABSENT = null;
        static final String COMBINED = ENDPOINT + "/more";
        static final String LOOKUP = lookup();
        static final long UNSAFE = 9007199254740993L;
        static String MUTABLE = "mutable";
        final String INSTANCE = "instance";
        static String lookup() { final String LOCAL = "local"; return LOCAL; }
      }`,
    });
    expect(index.diagnostics).toEqual([]);
    const unit = javaDeclarations(index);
    if (!unit) throw new Error('Expected declarations');
    const bindings = collectJavaConstantBindings([index], [unit]);
    expect(bindings.map(({ name, value, type }) => ({ name, value, type }))).toEqual([
      { name: 'ENDPOINT', value: '/userinfo', type: 'java.lang.String' },
      { name: 'ESCAPED', value: 'line\nnext', type: 'java.lang.String' },
      { name: 'HEX', value: 42, type: 'int' },
      { name: 'FRACTION', value: 1.25, type: 'double' },
      { name: 'ENABLED', value: true, type: 'boolean' },
      { name: 'DISABLED', value: false, type: 'boolean' },
      { name: 'CHARACTER', value: '\n', type: 'char' },
      { name: 'ABSENT', value: null, type: 'java.lang.String' },
    ]);
    const sources = new Map(index.nodes.map((node) => [declarationSource(index, node), node]));
    expect(bindings.every((binding) => sources.get(binding.source)?.kind === 'VARIABLE')).toBe(
      true,
    );
    expect(
      bindings.every(
        (binding) => sources.get(binding.value_source)?.kind.endsWith('_LITERAL') === true,
      ),
    ).toBe(true);
    expect(bindings.every((binding) => binding.owner_type === 'fixture.Constants')).toBe(true);
    expect(
      collectJavaConstantBindings([{ ...index, diagnostics: ['parse error'] }], [unit]),
    ).toEqual([]);
  }, 30_000);

  it('retains a typed method reference qualifier and name without inventing a call target', () => {
    const index = indexSource({
      path: 'Reference.java',
      language: 'java',
      content: `class Reference {
      Object factory = JwtDecoders::fromIssuerLocation;
    }`,
    });
    expect(index.diagnostics).toEqual([]);
    const reference = index.nodes.find((node) => node.kind === 'MEMBER_REFERENCE');
    expect(reference?.symbol).toBe('fromIssuerLocation');
    expect(reference?.fields?.receiver).toHaveLength(1);
  }, 30_000);
});
