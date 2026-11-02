import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import { extractLocalFacts } from '@/infrastructure/scan/local-facts';
import { scanValidator } from '@/infrastructure/scan/scan-format';
import { validateSourceIndex } from '@/infrastructure/scan/scoped-source-cache';
import { indexSource } from '@/infrastructure/scan/source-index';
import type { SourceIndex } from '@/infrastructure/scan/source-index-types';

vi.mock(import('server-only'), () => ({}));

describe('semantic extraction contract', () => {
  it('validates lexical JSX callbacks, property values and branch conditions through the public boundary', async () => {
    const parse = await scanValidator();
    const index = indexSource({
      path: 'widget.tsx',
      language: 'typescript',
      content:
        'function Widget({finish}: Props){ const choose = async (place: Place) => { const reply = await fetch("/lookup"); if (!reply.ok) throw Error(); finish({north: place.north}); }; return <Picker onChosen={choose} disabled={false}/>; }',
    });
    expect(validateSourceIndex(index)).toEqual(index);
    const document = documentOf(index);
    expect(parse(document)).toEqual(document);
  });

  it.skipIf(process.env.GROUNDWORK_NATIVE_PARSERS !== '1').each([
    { path: 'source.go', fixture: 'source.go.txt', language: 'go' as const },
    { path: 'Source.java', fixture: 'Source.java.txt', language: 'java' as const },
  ])(
    'validates native $language graph through the public boundary',
    async (input) => {
      const parse = await scanValidator();
      const content = readFileSync(
        new URL(`../test/fixtures/scan/${input.fixture}`, import.meta.url),
        'utf8',
      );
      const index = indexSource({
        path: input.path,
        language: input.language,
        content,
        ...(process.env.GROUNDWORK_TEST_JAVA === undefined
          ? {}
          : { java: process.env.GROUNDWORK_TEST_JAVA }),
      });
      expect(index.diagnostics).toEqual([]);
      expect(parse(documentOf(index))).toEqual(documentOf(index));
    },
    60_000,
  );
});

function documentOf(index: SourceIndex) {
  const facts = extractLocalFacts(index, {
    repo: 'fixture/repo',
    commit: 'pinned',
    host: 'host:server',
    blob: 'blob',
  });
  const document = scanFixture();
  document.sources = [...new Map(facts.sources.map((source) => [source.id, source])).values()];
  document.hosts[0]!.support = [document.sources[0]!.id];
  document.summaries = [...facts.summaries];
  document.gaps = [...facts.gaps];
  document.semantic = [...(facts.semantic ?? [])];
  return document;
}
