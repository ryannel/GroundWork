import { describe, expect, it, vi } from 'vitest';

import { extractLocalFacts } from './local-facts';
import { parserIdentity } from './source-cache';
import { indexSource } from './source-index';

vi.mock(import('server-only'), () => ({}));

const context = { host: 'fixture', repo: 'example/fixture', commit: 'a'.repeat(40) };
const python = `# 😀 offset sentinel
async def choose(value: int):
    candidate = value + 1
    if candidate > 2:
        return await send(candidate)
    return 0
`;
const rust = `// 😀 offset sentinel
async fn choose(value: i32) -> i32 {
    let candidate = value + 1;
    if candidate > 2 { return send(candidate).await; }
    return 0;
}
`;

describe('Python and Rust parse-only source adapters', () => {
  it.each([
    { language: 'python', path: 'fixture.py', content: python },
    { language: 'rust', path: 'fixture.rs', content: rust },
  ] as const)(
    'preserves $language compiler/tree-sitter structure and UTF-16 source spans',
    (input) => {
      const index = indexSource(input);
      expect(index.diagnostics).toEqual([]);
      expect(index.nodes.length).toBeGreaterThan(12);
      for (const node of index.nodes) {
        expect(input.content.slice(node.start, node.end)).toBe(node.text);
      }
      expect(index.nodes.find((node) => node.kind === 'METHOD')?.fields?.parameters).toHaveLength(
        1,
      );
      expect(
        index.nodes.find((node) => ['IF', 'CONDITIONAL_EXPRESSION'].includes(node.kind))?.fields
          ?.condition,
      ).toHaveLength(1);
      const call = index.nodes.find((node) => node.kind === 'METHOD_INVOCATION');
      expect(call?.fields?.callee).toHaveLength(1);
      expect(call?.fields?.arguments).toHaveLength(1);
      const facts = extractLocalFacts(index, context);
      expect(
        facts.semantic?.some(
          (record) => record.kind === 'semantic_edge' && record.relation === 'condition',
        ),
      ).toBe(true);
      expect(
        facts.semantic?.some(
          (record) => record.kind === 'semantic_edge' && record.relation === 'argument',
        ),
      ).toBe(true);
      expect(facts.summaries.length).toBeGreaterThan(0);
      expect(parserIdentity(input)).toContain(input.language);
    },
  );
  it.each([
    { language: 'python', path: 'broken.py', content: 'def f(:\n pass' },
    { language: 'rust', path: 'broken.rs', content: 'fn f( { let value = ;' },
  ] as const)('quarantines $language recovery instead of emitting semantic proof', (input) => {
    const index = indexSource(input);
    expect(index.diagnostics.length).toBeGreaterThan(0);
    const facts = extractLocalFacts(index, context);
    expect(facts.semantic).toEqual([]);
    expect(facts.summaries).toEqual([]);
    expect(facts.gaps[0]?.reason).toBe('unsupported');
  });
  it('does not execute Python module side effects or resolve imports', () => {
    const index = indexSource({
      language: 'python',
      path: 'unsafe.py',
      content: 'import unavailable_target_module\nraise RuntimeError("must never execute")\n',
    });
    expect(index.diagnostics).toEqual([]);
    expect(index.nodes.some((node) => node.kind === 'THROW')).toBe(true);
  });
});
