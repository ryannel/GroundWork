import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import { validateScanDocument } from '@/domain/scan/check-scan';

import { extractLocalFacts } from './local-facts';
import { indexSource } from './source-index';

vi.mock(import('server-only'), () => ({}));
const context = { host: 'fixture', repo: 'example/fixture', commit: 'a'.repeat(40) };
function facts(content: string) {
  return extractLocalFacts(
    indexSource({ language: 'python', path: 'fixture.py', content }),
    context,
  );
}
function targets(content: string): number {
  return (
    facts(content).semantic?.filter(
      (record) => record.kind === 'semantic_edge' && record.relation === 'call_target',
    ).length ?? 0
  );
}
describe('polyglot direct source call targets', () => {
  it('retains unsupported Rust pattern relationships as syntax with explicit gaps', () => {
    const index = indexSource({
      language: 'rust',
      path: 'patterns.rs',
      content:
        'fn f() { let (base_url, api_key) = pair(); let Some(directive) = find() else { return; }; request.get::<_, String>("key"); match value { Some(data) if compression => consume(data), _ => {} }; checkpoint({ |request| request }); plugin.decode_fn = |token| token; }',
    });
    expect(index.diagnostics).toEqual([]);
    const extracted = extractLocalFacts(index, context);
    const document = {
      ...scanFixture(),
      sources: [...new Map(extracted.sources.map((source) => [source.id, source])).values()],
      summaries: [...extracted.summaries],
      gaps: [...extracted.gaps],
      semantic: [...(extracted.semantic ?? [])],
      hosts: [
        {
          kind: 'host' as const,
          id: context.host,
          component: 'fixture',
          environment: 'server' as const,
          support: [extracted.sources[0]!.id] as [string],
        },
      ],
    };
    expect(validateScanDocument(document)).toEqual([]);
    expect(
      extracted.gaps.some((gap) => gap.description.includes('Native source field assigned_value')),
    ).toBe(true);
    expect(
      extracted.gaps.some((gap) => gap.description.includes('Native source field callee')),
    ).toBe(true);
    expect(
      extracted.semantic?.some(
        (record) =>
          record.kind === 'semantic_edge' &&
          record.relation === 'argument' &&
          document.semantic.some(
            (node) =>
              node.kind === 'semantic_node' && node.id === record.to && node.nodeKind === 'block',
          ),
      ),
    ).toBe(true);
  });
  it('retains an empty pinned Python module without inventing a nonempty semantic atom', () => {
    const extracted = facts('');
    expect(extracted.semantic).toEqual([]);
    expect(extracted.sources.length).toBeGreaterThan(0);
    const document = {
      ...scanFixture(),
      sources: [...new Map(extracted.sources.map((source) => [source.id, source])).values()],
      summaries: [...extracted.summaries],
      gaps: [...extracted.gaps],
      semantic: [...(extracted.semantic ?? [])],
      hosts: [
        {
          kind: 'host' as const,
          id: context.host,
          component: 'fixture',
          environment: 'server' as const,
          support: [extracted.sources[0]!.id] as [string],
        },
      ],
    };
    expect(validateScanDocument(document)).toEqual([]);
  });
  it('binds unambiguous module-local functions and rejects rebinding, decorators and parameter shadowing', () => {
    const source = 'def helper(value):\n    return value\ndef entry():\n    return helper(2)\n';
    expect(targets(source)).toBe(1);
    expect(targets(`${source}\nhelper = other\n`)).toBe(0);
    expect(targets(source.replace('def helper', '@wrapper\ndef helper'))).toBe(0);
    expect(targets(source.replace('def entry():', 'def entry(helper):'))).toBe(0);
  });
  it('preserves parsed Python constants independently of spelling and quarantines unsafe numeric precision', () => {
    const result = facts(
      'def value():\n    return {"flag": True, "empty": None, "title": \'label\', "large": 99999999999999999999999999}\n',
    );
    const literals = result.semantic?.filter(
      (record) => record.kind === 'semantic_node' && record.nodeKind === 'literal',
    );
    expect(literals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: true }),
        expect.objectContaining({ value: null }),
        expect.objectContaining({ value: 'label' }),
      ]),
    );
    expect(
      literals?.some(
        (record) => record.kind === 'semantic_node' && typeof record.value === 'number',
      ),
    ).toBe(false);
  });
  it('retains closure callback topology and scalar reaching values without inventing closure assigned values', () => {
    const index = indexSource({
      language: 'rust',
      path: 'closure.rs',
      content:
        'fn main() { let handler = |value: i32| { value }; let count = 1; consume(handler, count); }',
    });
    const extracted = extractLocalFacts(index, { ...context, host: 'host:fixture' });
    const semantic = extracted.semantic ?? [];
    expect(
      semantic.some((record) => record.kind === 'semantic_edge' && record.relation === 'callback'),
    ).toBe(true);
    expect(
      semantic.some(
        (record) => record.kind === 'semantic_edge' && record.relation === 'reaching_value',
      ),
    ).toBe(true);
    const document = {
      ...scanFixture(),
      sources: [...new Map(extracted.sources.map((source) => [source.id, source])).values()],
      summaries: [...extracted.summaries],
      gaps: [...extracted.gaps],
      semantic: [...semantic],
      hosts: [
        {
          kind: 'host' as const,
          id: 'host:fixture',
          component: 'fixture',
          environment: 'server' as const,
          support: [extracted.sources[0]?.id ?? 'missing'] as [string],
        },
      ],
    };
    expect(validateScanDocument(document)).toEqual([]);
  });
  it.each([
    {
      language: 'python',
      path: 'operator.py',
      content: 'def add(value):\n    return (value + # source comment\n            2)\n',
    },
    {
      language: 'rust',
      path: 'operator.rs',
      content: 'fn add(value:i32)->i32 { return value /* source comment */ + 2; }',
    },
  ] as const)('uses parsed $language operators beside comments', (input) => {
    const index = indexSource(input);
    expect(index.diagnostics).toEqual([]);
    const extracted = extractLocalFacts(index, context);
    expect(extracted.semantic).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'semantic_node', nodeKind: 'binary', operator: '+' }),
      ]),
    );
    expect(
      extracted.semantic?.some(
        (record) => record.kind === 'semantic_edge' && record.relation === 'returns',
      ),
    ).toBe(true);
  });
});
