import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { extractLocalFacts } from '@/infrastructure/scan/local-facts';
import { indexSource } from '@/infrastructure/scan/source-index';

vi.mock(import('server-only'), () => ({}));

const CONTEXT = { host: 'host:fixture', repo: 'fixture/repo', commit: 'a'.repeat(40) };
const NATIVE = process.env.GROUNDWORK_NATIVE_PARSERS === '1';

function fixture(name: string) {
  return readFileSync(new URL(`../test/fixtures/scan/${name}`, import.meta.url), 'utf8');
}

describe.skipIf(!NATIVE)('offline native compiler fixtures', () => {
  it('retains Go error tuples, void, detachment and Unicode source spans', () => {
    const content = fixture('source.go.txt');
    const index = indexSource({ path: 'source.go', content, language: 'go' });
    expect(index.diagnostics).toEqual([]);
    expect(index.attribution).toBe('parse_only');
    const facts = extractLocalFacts(index, CONTEXT);
    const operations = facts.summaries.flatMap((summary) => summary.operations);
    expect(operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'return',
          value: { kind: 'tuple', values: ['input', 'nil'] },
        }),
        expect.objectContaining({
          kind: 'return',
          value: { kind: 'tuple', values: ['""', 'problem'] },
        }),
        expect.objectContaining({ kind: 'return', value: { kind: 'void' } }),
        expect.objectContaining({
          kind: 'call',
          callee: 'publish',
          arguments: ['input'],
          waiting: 'detached',
        }),
        expect.objectContaining({
          kind: 'return',
          value: { kind: 'tuple', values: ['value', 'nil'] },
        }),
      ]),
    );
    expect(facts.summaries[0]?.context.arguments).toEqual(['input string']);
    expect(facts.summaries.every((summary) => summary.effects.state === 'unresolved')).toBe(true);
  }, 60_000);

  it('reconciles a removed Spring route and retains async scheduling uncertainty', () => {
    const java = process.env.GROUNDWORK_TEST_JAVA ?? 'java';
    const content = fixture('Source.java.txt');
    const input = { path: 'Source.java', content, language: 'java' as const, java };
    const index = indexSource(input);
    expect(index.diagnostics).toEqual([]);
    const facts = extractLocalFacts(index, CONTEXT);
    const observations = facts.candidates.flatMap((candidate) => candidate.observations);
    expect(observations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'http_registration', authority: 'syntax_candidate' }),
        expect.objectContaining({ kind: 'async_boundary', authority: 'syntax_candidate' }),
      ]),
    );
    expect(facts.summaries[0]?.context.arguments).toEqual(['String input']);
    expect(facts.summaries.some((summary) => summary.context.arguments.includes('value'))).toBe(
      true,
    );
    expect(facts.summaries[0]?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'control',
          predicate: { expression: 'input == null', polarity: true, inputs: [] },
        }),
      ]),
    );
    expect(facts.summaries.flatMap((summary) => summary.operations)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'throw', value: 'new IllegalArgumentException()' }),
        expect.objectContaining({ kind: 'call', callee: 'repository.save', arguments: ['input'] }),
        expect.objectContaining({ kind: 'call', callee: 'CompletableFuture.runAsync' }),
      ]),
    );
    expect(facts.summaries.every((summary) => summary.effects.state === 'unresolved')).toBe(true);
    const removed = extractLocalFacts(
      indexSource({ ...input, content: content.replace('@PostMapping("/items")', '') }),
      CONTEXT,
    );
    expect(
      removed.candidates
        .flatMap((candidate) => candidate.observations)
        .some((item) => item.kind === 'http_registration'),
    ).toBe(false);
    const unsupported = indexSource({ ...input, content: 'class Bad { void method( }' });
    expect(unsupported.diagnostics.length).toBeGreaterThan(0);
  }, 60_000);
});
