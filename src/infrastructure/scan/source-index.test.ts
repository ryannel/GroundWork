import { describe, expect, it, vi } from 'vitest';

import { extractLocalFacts } from './local-facts';
import { indexSource } from './source-index';
import { createSourcePipeline } from './source-pipeline';

vi.mock(import('server-only'), () => ({}));

const CONTEXT = { host: 'host:fixture', repo: 'fixture/repo', commit: 'a'.repeat(40) };

function factsOf(content: string) {
  const index = indexSource({ path: 'fixture.tsx', content, language: 'typescript' });
  return extractLocalFacts(index, CONTEXT);
}

describe('compiler source indexing', () => {
  it('resolves direct local symbols but refuses reassigned and shadowed bindings', () => {
    const direct = factsOf(
      'function child(value: string) { return value; } function parent(){ return child("x"); }',
    );
    const resolved = direct.summaries
      .flatMap((summary) => summary.operations)
      .find((operation) => operation.kind === 'call');
    expect(resolved?.target.state).toBe('supported');
    expect(resolved?.callee).toBe('child');
    const reassigned = factsOf('function child() {} child = other; function parent(){ child(); }');
    const shadowed = factsOf('function child() {} function parent(child: Function){ child(); }');
    for (const facts of [reassigned, shadowed]) {
      const call = facts.summaries
        .flatMap((summary) => summary.operations)
        .find((operation) => operation.kind === 'call');
      expect(call?.target.state).toBe('unresolved');
    }
  });

  it('retains formal arguments, call actuals, awaits and return expressions', () => {
    const facts = factsOf(
      'async function save(input: string) { return await persist(input, {mode: "safe"}); }',
    );
    expect(facts.summaries[0]?.context.arguments).toEqual(['input: string']);
    const operations = facts.summaries.flatMap((summary) => summary.operations);
    expect(operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'call',
          callee: 'persist',
          arguments: ['input', '{mode: "safe"}'],
          waiting: 'awaited',
        }),
        expect.objectContaining({ kind: 'await', task: 'persist(input, {mode: "safe"})' }),
        expect.objectContaining({
          kind: 'return',
          value: { kind: 'value', values: ['await persist(input, {mode: "safe"})'] },
        }),
      ]),
    );
  });

  it('preserves exact awaited and thrown expressions beyond the syntax preview limit', () => {
    const literal = 'x'.repeat(700);
    const awaited = `send("${literal}")`;
    const thrown = `new Error("${literal}")`;
    const facts = factsOf(`async function action(){ await ${awaited}; throw ${thrown}; }`);
    const operations = facts.summaries.flatMap((summary) => summary.operations);
    const wait = operations.find((operation) => operation.kind === 'await');
    const failure = operations.find((operation) => operation.kind === 'throw');
    expect(wait?.task).toBe(awaited);
    expect(failure?.value).toBe(thrown);
    expect(wait?.task.length).toBeGreaterThan(512);
    expect(failure?.value.length).toBeGreaterThan(512);
  });

  it('preserves both source guard branches and operation references', () => {
    const facts = factsOf(
      'function f(allowed: boolean) { if (allowed) { accept(); } else { deny(); } }',
    );
    const operations = facts.summaries[0]?.operations ?? [];
    const branch = operations.find((operation) => operation.kind === 'control');
    expect(branch?.predicate).toEqual({ expression: 'allowed', polarity: true, inputs: [] });
    expect(branch?.consequent).toHaveLength(1);
    expect(branch?.otherwise).toHaveLength(1);
    expect(new Set(branch?.consequent)).not.toEqual(new Set(branch?.otherwise));
  });

  it('keeps lexical controls separate from semantic user actions', () => {
    const before = factsOf('const view = <button onClick={save}>Save</button>;');
    const after = factsOf('const view = <button>Save</button>;');
    expect(before.candidates.flatMap((candidate) => candidate.observations)).toEqual([
      expect.objectContaining({ kind: 'lexical_control', authority: 'syntax_candidate' }),
    ]);
    expect(after.candidates.flatMap((candidate) => candidate.observations)).toEqual([]);
  });

  it('does not invent durable effects from a save method or a string', () => {
    const facts = factsOf('function f() { const fake = "repo.save(x)"; repository.save(fake); }');
    expect(facts.candidates.filter((candidate) => candidate.kind === 'call')).toHaveLength(1);
    expect(facts.summaries.every((summary) => summary.effects.state === 'unresolved')).toBe(true);
    expect(
      facts.summaries[0]?.operations.find((operation) => operation.kind === 'call')?.target.state,
    ).toBe('unresolved');
  });

  it('preserves computed callee spelling independently from an unresolved target', () => {
    const facts = factsOf('function invoke(key: string) { handlers[key](input); }');
    const call = facts.summaries[0]?.operations.find((operation) => operation.kind === 'call');
    expect(call?.callee).toBe('handlers[key]');
    expect(call?.target.state).toBe('unresolved');
  });

  it('distinguishes absent compiler fields from explicit void and zero arguments', () => {
    const index = indexSource({
      path: 'f.ts',
      content: 'function action() { invoke(); return; }',
      language: 'typescript',
    });
    const damaged = {
      ...index,
      nodes: index.nodes.map((node) =>
        node.kind === 'ReturnStatement' || node.kind === 'CallExpression'
          ? { ...node, fields: {} }
          : node,
      ),
    };
    const before = extractLocalFacts(index, CONTEXT);
    const after = extractLocalFacts(damaged, CONTEXT);
    expect(before.summaries[0]?.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'return', value: { kind: 'void' } }),
        expect.objectContaining({ kind: 'call', arguments: [] }),
      ]),
    );
    const missingReturn = after.summaries[0]?.operations.find(
      (operation) => operation.kind === 'return',
    );
    expect(missingReturn?.value.kind).toBe('unresolved');
    expect(after.summaries[0]?.operations.some((operation) => operation.kind === 'opaque')).toBe(
      true,
    );
    expect(after.gaps.some((gap) => gap.reason === 'missing_evidence')).toBe(true);
  });

  it('retains a syntax denominator when a call is unsupported', () => {
    const facts = factsOf('function f() { for(const item of items) opaque[item](); }');
    expect(facts.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'loop', disposition: 'frontier' }),
        expect.objectContaining({ kind: 'call', disposition: 'syntax_supported' }),
      ]),
    );
    expect(facts.gaps.some((gap) => gap.description.includes('dispatch target'))).toBe(true);
  });

  it('keeps the independent syntax denominator when framework recognition is disabled', () => {
    const index = indexSource({
      path: 'f.tsx',
      content: 'const view = <button onClick={save}>Save</button>',
      language: 'typescript',
    });
    const before = extractLocalFacts(index, CONTEXT);
    const after = extractLocalFacts(index, { ...CONTEXT, disabledRecognisers: ['framework'] });
    expect(after.candidates.map((candidate) => candidate.id)).toEqual(
      before.candidates.map((candidate) => candidate.id),
    );
    expect(before.candidates.flatMap((candidate) => candidate.observations)).toHaveLength(1);
    expect(after.candidates.flatMap((candidate) => candidate.observations)).toHaveLength(0);
    expect(
      after.candidates.find((candidate) => candidate.kind === 'lexical_control')?.disposition,
    ).toBe('frontier');
  });

  it('reuses syntax but invalidates summaries when rules or context change', () => {
    const pipeline = createSourcePipeline('workspace:fixture/profile:test');
    const input = {
      path: 'f.ts',
      content: 'function f() { return 1; }',
      language: 'typescript' as const,
    };
    pipeline.run(input, CONTEXT);
    pipeline.run(input, CONTEXT);
    pipeline.run(input, { ...CONTEXT, ruleVersion: 'changed' });
    pipeline.run({ ...input, content: 'function f() { return 2; }' }, CONTEXT);
    expect(pipeline.stats()).toEqual(
      expect.objectContaining({ reads: 4, parses: 2, hits: 2, extractions: 3, summaryHits: 1 }),
    );
  });

  it('stores source text once and clips syntax preview payloads', () => {
    const content = `function f() { return "${'x'.repeat(2000)}"; }`;
    const index = indexSource({ path: 'f.ts', content, language: 'typescript' });
    expect(index.content).toBe(content);
    expect(index.nodes.every((node) => node.text.length <= 512)).toBe(true);
  });

  it('turns a missing compiler into explicit diagnostics, not an empty successful parse', () => {
    const index = indexSource({
      path: 'f.java',
      content: 'class A {}',
      language: 'java',
      java: '/nonexistent/compiler',
    });
    expect(index.parser).toBe('java/unavailable');
    expect(index.diagnostics).not.toEqual([]);
  });
});
