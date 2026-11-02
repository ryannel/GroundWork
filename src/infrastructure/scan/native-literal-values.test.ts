import { describe, expect, it, vi } from 'vitest';

import { extractLocalFacts } from './local-facts';
import { indexSource } from './source-index';
import type { SourceInput } from './source-index-types';

vi.mock(import('server-only'), () => ({}));
const fixtures: readonly SourceInput[] = [
  {
    language: 'java',
    path: 'Literals.java',
    content:
      'class Literals { Object[] values() { return new Object[]{false, true, "false", "true", null}; } }',
  },
  {
    language: 'csharp',
    path: 'Literals.cs',
    content:
      'class Literals { object[] Values() { return new object[]{false, true, "false", "true", null}; } }',
  },
  {
    language: 'python',
    path: 'literals.py',
    content: 'def values():\n    return [False, True, "false", "true", None]\n',
  },
  {
    language: 'rust',
    path: 'literals.rs',
    content: 'fn values() { consume(false, true, "false", "true"); }',
  },
  {
    language: 'typescript',
    path: 'literals.ts',
    content: 'function values() { return [false, true, "false", "true", null]; }',
  },
];
function literals(input: SourceInput) {
  const index = indexSource(input);
  expect(index.diagnostics).toEqual([]);
  const facts = extractLocalFacts(index, {
    host: 'fixture',
    repo: 'fixture/literals',
    commit: 'a'.repeat(40),
  });
  return (
    facts.semantic?.filter(
      (record) => record.kind === 'semantic_node' && record.nodeKind === 'literal',
    ) ?? []
  );
}
describe('native literal type preservation', () => {
  it.each(fixtures)('keeps $language booleans distinct from equally spelled strings', (input) => {
    expect(literals(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: false }),
        expect.objectContaining({ value: true }),
        expect.objectContaining({ value: 'false' }),
        expect.objectContaining({ value: 'true' }),
      ]),
    );
  });
  it('does not turn Go predeclared identifier syntax into proven unshadowed boolean constants', () => {
    const values = literals({
      language: 'go',
      path: 'literals.go',
      content: 'package fixture\nfunc values() { consume(true, false, "true", "false") }',
    });
    expect(values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'true' }),
        expect.objectContaining({ value: 'false' }),
      ]),
    );
    expect(
      values.some((record) => record.kind === 'semantic_node' && typeof record.value === 'boolean'),
    ).toBe(false);
  }, 30_000);
});
