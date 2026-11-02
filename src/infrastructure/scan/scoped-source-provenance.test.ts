import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import type { ScanScope } from './scan-scope';
import { scopedProvenance, scopedProvenances } from './scoped-source-provenance';

vi.mock(import('server-only'), () => ({}));
vi.mock(import('node:fs'), { spy: true });
const readFile = vi.mocked(readFileSync);

function scope(position: number): ScanScope {
  return {
    format: 'scan-scope/v1',
    workspace: 'fixture',
    id: `scope-${String(position)}`,
    repo: 'fixture/repository',
    commit: 'a'.repeat(40),
    ref: 'HEAD',
    files: [{ path: `${String(position)}.ts`, language: 'typescript', environment: 'server' }],
    questions: [
      {
        id: `question-${String(position)}`,
        profile: 'endpoint',
        path: `${String(position)}.ts`,
        symbol: '',
        checks: [{ kind: 'control', text: 'Inspect local control' }],
      },
    ],
  };
}
const options = { authority: 'fixture' };

describe('checkpoint provenance batches', () => {
  it('preserves every per-scope fingerprint, including different language and environment inputs', () => {
    const scopes = [
      scope(0),
      scope(1),
      {
        ...scope(2),
        files: [
          { path: 'second.js', language: 'javascript' as const, environment: 'browser' as const },
        ],
      },
    ];
    expect(scopedProvenances(scopes, options)).toEqual(
      scopes.map((item) => scopedProvenance(item, options)),
    );
  });

  it('reads analysis bytes once per checkpoint rather than once per planned scope', () => {
    const mock = readFile;
    mock.mockClear();
    scopedProvenances([scope(0)], options);
    const singleReads = mock.mock.calls.length;
    mock.mockClear();
    const scopes = Array.from({ length: 100 }, (_, position) => scope(position));
    const fingerprints = scopedProvenances(scopes, options);
    expect(fingerprints).toHaveLength(100);
    expect(mock.mock.calls).toHaveLength(singleReads);
    expect(singleReads).toBeGreaterThan(0);
  });

  it('does not reuse analysis fingerprints across checkpoints when adapter bytes change', () => {
    const scopes = [scope(0), scope(1)];
    const before = scopedProvenances(scopes, options);
    readFile.mockReturnValueOnce('changed adapter source');
    const changed = scopedProvenances(scopes, options);
    expect(changed.map((item) => item.toolchainDigest)).not.toEqual(
      before.map((item) => item.toolchainDigest),
    );
    expect(scopedProvenances(scopes, options)).toEqual(before);
  });

  it('does not read analysis bytes for a repository with no parser scopes', () => {
    readFile.mockClear();
    expect(scopedProvenances([], options)).toEqual([]);
    expect(readFile).not.toHaveBeenCalled();
  });
});
