import { describe, expect, it, vi } from 'vitest';

import type { ValueBinding } from '@/infrastructure/scan/java-call-binding-types';
import { collectJavaBindings } from '@/infrastructure/scan/java-call-bindings';
import { declarationSource } from '@/infrastructure/scan/java-declaration-parts';
import { javaDeclarations } from '@/infrastructure/scan/java-declarations';
import { distinctJavaValues } from '@/infrastructure/scan/java-value-identity';
import { indexSource } from '@/infrastructure/scan/source-index';

vi.mock(import('server-only'), () => ({}));

const binding: ValueBinding = {
  kind: 'java_value_binding',
  id: 'java-value:fixture',
  relation: 'assignment',
  from: 'source:input',
  to: 'source:target',
  call: null,
  guards: [],
};

describe('Java value identity', () => {
  it('collapses only identical repeated source facts and preserves different identities', () => {
    expect(distinctJavaValues([binding, { ...binding }, { ...binding, id: 'other' }])).toEqual([
      binding,
      { ...binding, id: 'other' },
    ]);
  });

  it.each([
    { guards: ['source:branch'] },
    { relation: 'initializer' as const },
    { from: 'source:other' },
    { to: 'source:other' },
    { call: 'source:call' },
  ])('rejects conflicting payloads under the same source identity: %j', (difference) => {
    expect(() => distinctJavaValues([binding, { ...binding, ...difference }])).toThrow(
      'Conflicting Java value binding identity: java-value:fixture',
    );
  });
});

describe.runIf(process.env.GROUNDWORK_NATIVE_PARSERS === '1')('Java annotation values', () => {
  it('excludes annotation arguments copied into record compact constructors without losing assignments', () => {
    const index = indexSource({
      path: 'src/main/java/Example.java',
      language: 'java',
      content: `@interface Schema { String description(); }
        record Example(@Schema(description="input") int value) {
          Example { if (value < 0) value = 0; }
          int adjust(int input) { input = value; input = value; return input; }
        }
        class ConstantUse {
          static final String DESCRIPTION="input";
          @Schema(description=DESCRIPTION) int field;
        }`,
    });
    expect(index.diagnostics).toEqual([]);
    const unit = javaDeclarations(index);
    if (!unit) throw new Error('Expected native Java declarations');
    expect(
      unit.types.find((type) => type.name === 'Example')?.fields[0]?.annotations,
    ).toMatchObject([{ name: 'Schema', arguments: { description: '"input"' } }]);
    const values = collectJavaBindings([index], [unit]).values;
    const assignments = values.filter((value) => value.relation === 'assignment');
    const sources = new Map(index.nodes.map((node) => [declarationSource(index, node), node.text]));
    expect(assignments).toHaveLength(3);
    expect(new Set(assignments.map((value) => value.id)).size).toBe(3);
    expect(assignments.filter((value) => value.guards.length > 0)).toHaveLength(1);
    expect(
      values.some(
        (value) => value.relation === 'reference' && sources.get(value.to) === 'DESCRIPTION',
      ),
    ).toBe(true);
    expect(
      assignments
        .map((value) => sources.get(value.from))
        .toSorted((left, right) => (left ?? '').localeCompare(right ?? '')),
    ).toEqual(['0', 'value', 'value']);
  });
});
