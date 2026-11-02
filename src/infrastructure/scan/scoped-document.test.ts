import { describe, expect, it, vi } from 'vitest';

import { extractLocalFacts } from './local-facts';
import type { ScanScope } from './scan-scope';
import { scopedDocument } from './scoped-document';
import type { ScopedSources } from './scoped-source-store';
import { indexSource } from './source-index';

vi.mock(import('server-only'), () => ({}));

describe('question receipts versus local syntax', () => {
  it('retains calls, returns and awaits without certifying broad question completeness', () => {
    const file = { path: 'handler.ts', language: 'typescript', environment: 'server' } as const;
    const index = indexSource({
      ...file,
      content:
        'export async function handler() { const value = await fetch("/api"); return value; }',
    });
    const context = {
      repo: 'fixture/repo',
      commit: 'a'.repeat(40),
      host: 'host:fixture',
      blob: 'b'.repeat(40),
    };
    const facts = extractLocalFacts(index, context);
    const scope: ScanScope = {
      format: 'scan-scope/v1',
      workspace: 'fixture',
      id: 'fixture',
      repo: context.repo,
      commit: context.commit,
      ref: 'HEAD',
      files: [file],
      questions: [
        {
          id: 'handler',
          profile: 'endpoint',
          path: file.path,
          symbol: 'handler',
          checks: [{ kind: 'call', text: 'fetch' }],
        },
      ],
    };
    const input: ScopedSources = {
      sources: [{ file, index, facts, blob: context.blob }],
      stats: {
        blobReads: 1,
        parsedFiles: 1,
        indexHits: 0,
        reusedFiles: 0,
        sourceBytes: index.content.length,
      },
      baseline: {
        repo: context.repo,
        commit: context.commit,
        tree: 'c'.repeat(40),
        ref: 'HEAD',
        environmentDigest: 'environment',
        ruleDigest: 'rules',
        toolchainDigest: 'toolchain',
        configDigest: 'config',
      },
    };
    const document = scopedDocument(scope, input);
    expect(
      document.summaries.flatMap((summary) =>
        summary.operations.map((operation) => operation.kind),
      ),
    ).toEqual(expect.arrayContaining(['call', 'await', 'return']));
    expect(document.receipts).toHaveLength(1);
    expect(
      document.receipts[0]?.answers.every((entry) => entry.answer.state === 'unresolved'),
    ).toBe(true);
    expect(document.receipts[0]?.answers).toHaveLength(document.obligations.length);
    const gapIds = document.gaps.map((entry) => entry.id);
    for (const obligation of document.obligations) {
      expect(gapIds).toContain(`gap:question:handler:${obligation.concern}`);
    }
  });
});
