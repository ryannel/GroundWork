import { describe, expect, it, vi } from 'vitest';

import { extractLocalFacts } from './local-facts';
import type { ScanScope, ScopeFile } from './scan-scope';
import { scopedDocument } from './scoped-document';
import type { ScopedSources } from './scoped-source-store';
import { sourceDigest } from './source-index';
import type { SourceIndex } from './source-index-types';

vi.mock(import('server-only'), () => ({}));

const CONTEXT = {
  host: `host:${sourceDigest('fixture/repo:unknown').slice(0, 16)}`,
  repo: 'fixture/repo',
  commit: 'a'.repeat(40),
  blob: 'b'.repeat(40),
};
const CONTENT = 'class A { Object f() { return recovered; } }\n';

function recoveredIndex(diagnostics: readonly string[]): SourceIndex {
  return {
    path: 'A.java',
    language: 'java',
    digest: sourceDigest(CONTENT),
    content: CONTENT,
    parser: 'fixture/parse-only',
    attribution: 'parse_only',
    options: '',
    diagnostics,
    nodes: [
      {
        kind: 'COMPILATION_UNIT',
        text: CONTENT,
        start: 0,
        end: CONTENT.length,
        lines: [1, 1],
        parent: null,
      },
      {
        kind: 'METHOD',
        text: 'Object f() { return recovered; }',
        symbol: 'f',
        start: 10,
        end: 42,
        lines: [1, 1],
        parent: 0,
      },
      {
        kind: 'RETURN',
        text: 'return recovered;',
        start: 23,
        end: 40,
        lines: [1, 1],
        parent: 1,
      },
    ],
  };
}

function shard(id: string, index: SourceIndex) {
  const file: ScopeFile = { path: index.path, language: index.language, environment: 'unknown' };
  const scope: ScanScope = {
    format: 'scan-scope/v1',
    workspace: 'fixture',
    id,
    repo: CONTEXT.repo,
    commit: CONTEXT.commit,
    ref: 'HEAD',
    files: [file],
    questions: [],
  };
  const input: ScopedSources = {
    sources: [{ file, index, facts: extractLocalFacts(index, CONTEXT), blob: CONTEXT.blob }],
    stats: {
      blobReads: 1,
      parsedFiles: 1,
      indexHits: 0,
      reusedFiles: 0,
      sourceBytes: CONTENT.length,
    },
    baseline: {
      repo: CONTEXT.repo,
      commit: CONTEXT.commit,
      tree: 'c'.repeat(40),
      ref: 'HEAD',
      environmentDigest: 'environment',
      ruleDigest: 'rules',
      toolchainDigest: 'toolchain',
      configDigest: 'config',
    },
  };
  return scopedDocument(scope, input);
}

describe('diagnostic source quarantine', () => {
  it('withholds recovered declarations and returns while retaining a pinned full-file gap', () => {
    const index = recoveredIndex(['Record pattern is unsupported by this parser.']);
    const before = structuredClone(index);
    const facts = extractLocalFacts(index, CONTEXT);
    expect(facts.semantic).toEqual([]);
    expect(facts.summaries).toEqual([]);
    expect(facts.candidates).toEqual([]);
    expect(facts.sources).toHaveLength(1);
    expect(facts.sources[0]).toMatchObject({
      repo: CONTEXT.repo,
      commit: CONTEXT.commit,
      blob: CONTEXT.blob,
      path: index.path,
      lines: [1, 2],
    });
    expect(facts.gaps).toMatchObject([{ source: facts.sources[0]?.id, reason: 'unsupported' }]);
    expect(facts.gaps[0]?.description).toContain('Parser diagnostics quarantine this file');
    expect(index).toEqual(before);
    const clean = extractLocalFacts(recoveredIndex([]), CONTEXT);
    expect(clean.semantic?.some((record) => record.kind === 'semantic_node')).toBe(true);
    expect(clean.summaries.length).toBeGreaterThan(0);
  });

  it('retains a source and gap even when parser recovery has no syntax nodes', () => {
    const facts = extractLocalFacts({ ...recoveredIndex(['No tree']), nodes: [] }, CONTEXT);
    expect(facts.sources[0]?.lines).toEqual([1, 2]);
    expect(facts.gaps[0]?.source).toBe(facts.sources[0]?.id);
    expect(facts.semantic).toEqual([]);
  });

  it('keeps the same placeholder host identity consistent across different shards', () => {
    const first = shard('repository-0001', recoveredIndex(['Unsupported pattern']));
    const second = shard('repository-0002', recoveredIndex(['Unsupported pattern']));
    expect(first.hosts).toHaveLength(1);
    expect(first.hosts).toEqual(second.hosts);
    expect(first.hosts[0]?.id).toBe(CONTEXT.host);
    expect(first.sources[0]?.host).toBe(first.hosts[0]?.id);
    expect(first.semantic).toEqual([]);
    expect(first.summaries).toEqual([]);
  });
});
