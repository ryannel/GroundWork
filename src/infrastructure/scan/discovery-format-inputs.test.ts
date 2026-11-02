import { describe, expect, it, vi } from 'vitest';

import { parseDiscoveryInventory } from './discovery-format';

vi.mock(import('server-only'), () => ({}));

function inventory(): unknown {
  return {
    repo: 'example/repo',
    commit: 'a'.repeat(40),
    analysis_version: 'analysis:1',
    snapshot_sha256: 'b'.repeat(64),
    sha256: 'c'.repeat(64),
    candidates: [
      {
        id: 'candidate:one',
        kind: 'boundary',
        root: 'apps/test-drive',
        evidence: [
          {
            kind: 'context_snapshot',
            context_id: 'context:manifest',
            path: 'apps/test-drive/package.json',
            commit: 'a'.repeat(40),
            sha256: 'd'.repeat(64),
            lines: [1, 4],
            basis: 'boundary',
          },
        ],
      },
    ],
  };
}

describe('independent inventory parsing', () => {
  it('accepts a closed canonical inventory with source-declared classification', () => {
    expect(parseDiscoveryInventory(inventory()).candidates[0]?.root).toBe('apps/test-drive');
  });
  it('rejects untyped extra keys, invalid identities and unsafe roots', () => {
    const valid = parseDiscoveryInventory(inventory());
    expect(() => parseDiscoveryInventory({ ...valid, ready: true })).toThrow(/ready/u);
    expect(() => parseDiscoveryInventory({ ...valid, sha256: '' })).toThrow(/sha256/u);
    expect(() => parseDiscoveryInventory({ ...valid, commit: 'main' })).toThrow(/commit/u);
    expect(() =>
      parseDiscoveryInventory({
        ...valid,
        candidates: [{ ...valid.candidates[0], kind: 'deployed' }],
      }),
    ).toThrow(/kind/u);
    expect(() =>
      parseDiscoveryInventory({
        ...valid,
        candidates: [{ ...valid.candidates[0], root: '../outside' }],
      }),
    ).toThrow(/root/u);
    expect(() =>
      parseDiscoveryInventory({
        ...valid,
        candidates: [{ ...valid.candidates[0], root: '/outside' }],
      }),
    ).toThrow(/root/u);
    expect(
      parseDiscoveryInventory({ ...valid, candidates: [{ ...valid.candidates[0], evidence: [] }] })
        .candidates[0]?.evidence,
    ).toEqual([]);
  });
});
