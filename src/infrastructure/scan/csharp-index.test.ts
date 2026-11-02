import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { createIndexCache, parserIdentity } from './source-cache';
import { indexSource } from './source-index';

vi.mock(import('server-only'), () => ({}));

const content = `using Microsoft.AspNetCore.Mvc;
[ApiController, Route("prices")]
public class PriceController : ControllerBase {
 [HttpGet("{id}")]
 public async Task<PriceDto> Get(string id) {
  var amount = 42;
  if (id == null) throw new Exception("missing");
  return await client.Get(id, amount);
 }
}
public record PriceDto(decimal Amount, string Currency);
public class ArrayDto { public string[] Names { get; set; } }`;

describe('Roslyn supplied-byte index', () => {
  it('retains parsed control, call operands, source DTO declarations and attributes', () => {
    const indexed = indexSource({ path: 'Price.cs', language: 'csharp', content });
    expect(indexed.diagnostics).toEqual([]);
    expect(indexed.nodes.every((node) => node.end > node.start)).toBe(true);
    expect(indexed.parser).toMatch(/^roslyn\//u);
    expect(indexed.nodes.some((node) => node.kind === 'RECORD' && node.symbol === 'PriceDto')).toBe(
      true,
    );
    const call = indexed.nodes.find((node) => node.kind === 'METHOD_INVOCATION');
    expect(call?.fields?.arguments?.map(([start, end]) => content.slice(start, end))).toEqual([
      'id',
      'amount',
    ]);
    expect(indexed.nodes.find((node) => node.kind === 'IF')?.fields?.condition).toHaveLength(1);
    expect(indexed.nodes.filter((node) => node.kind === 'ANNOTATION')).toHaveLength(3);
  });

  it('quarantines malformed input and reuses only compatible source and parser inputs', () => {
    const cache = createIndexCache('synthetic-csharp');
    const input = { path: 'Price.cs', language: 'csharp' as const, content };
    expect(cache.index(input).diagnostics).toEqual([]);
    expect(cache.index(input).digest).toBe(cache.index(input).digest);
    expect(cache.stats()).toMatchObject({ parses: 1, hits: 2 });
    expect(
      cache.index({ ...input, content: `${content}\nclass {` }).diagnostics.length,
    ).toBeGreaterThan(0);
    expect(cache.stats().parses).toBe(2);
    expect(parserIdentity(input).split(':')).toHaveLength(7);
  });
  it('invalidates the real adapter identity and exposes unresolved preprocessor selection', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'csharp-adapter-test-'));
    for (const file of ['source-index.cs', 'compiler-bindings.cs', 'compiler-contracts.cs']) {
      copyFileSync(path.join('tools/scan-adapters', file), path.join(directory, file));
    }
    const input = {
      path: 'Fixture.cs',
      content: 'class C { int M() => 1; }',
      language: 'csharp' as const,
      adapterDirectory: directory,
    };
    const cache = createIndexCache('adapter-change');
    const before = parserIdentity(input);
    expect(cache.index(input).diagnostics).toEqual([]);
    cache.index(input);
    writeFileSync(
      path.join(directory, 'source-index.cs'),
      `${readFileSync(path.join(directory, 'source-index.cs'), 'utf8')}\n// Synthetic compatible adapter revision.\n`,
    );
    expect(parserIdentity(input)).not.toBe(before);
    expect(cache.index(input).digest).toBe(cache.index(input).digest);
    expect(cache.stats()).toMatchObject({ parses: 2, hits: 2 });
    expect(
      indexSource({
        path: 'Conditional.cs',
        language: 'csharp',
        content: '#if PROD\nclass Production {}\n#else\nclass Other {}\n#endif',
      }).diagnostics,
    ).toEqual(expect.arrayContaining([expect.stringContaining('conditional compilation')]));
  }, 15_000);
  it('parses C#14 extension blocks with the managed .NET10 parser', () => {
    const indexed = indexSource({
      path: 'Extensions.cs',
      language: 'csharp',
      content: `public static class NumberExtensions { extension(int number) { public int Double() => number * 2; } }`,
    });
    expect(indexed.diagnostics).toEqual([]);
    expect(indexed.nodes.some((node) => node.symbol === 'Double' && node.kind === 'METHOD')).toBe(
      true,
    );
    expect(indexed.nodes.some((node) => node.kind === 'ExtensionBlockDeclaration')).toBe(true);
  });
});
