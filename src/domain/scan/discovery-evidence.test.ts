import { describe, expect, it } from 'vitest';

import { candidateOwns, claimTouchesCandidate } from './discovery-evidence';
import type { DiscoveryCandidate } from './discovery-types';
import type { DiscoveryEvidence } from './discovery.generated';

const anchor: DiscoveryEvidence = {
  kind: 'context_snapshot',
  context_id: 'context:source',
  path: 'apps/example/controller.ts',
  commit: 'a'.repeat(40),
  sha256: 'b'.repeat(64),
  lines: [1, 100],
};
const candidate: DiscoveryCandidate = {
  id: 'candidate:entry',
  kind: 'entry',
  root: 'apps/example',
  evidence: [{ ...anchor, basis: 'entry' }],
};

describe('bounded discovery evidence ownership', () => {
  it('allows actual inspected subranges inside a pinned source body', () => {
    expect(candidateOwns(candidate, { ...anchor, lines: [20, 30] })).toBe(true);
    expect(candidateOwns(candidate, { ...anchor, lines: [100, 101] })).toBe(false);
    expect(candidateOwns(candidate, { ...anchor, sha256: 'c'.repeat(64) })).toBe(false);
    expect(candidateOwns(candidate, { ...anchor, path: 'apps/other/controller.ts' })).toBe(false);
    expect(candidateOwns(candidate, { ...anchor, commit: 'c'.repeat(40) })).toBe(false);
  });
  it('binds claims to local source contexts and examined line ranges', () => {
    expect(
      claimTouchesCandidate(
        [
          {
            kind: 'context_snapshot',
            context_id: anchor.context_id,
            locator: anchor.path,
            lines: [10, 20],
          },
        ],
        candidate,
      ),
    ).toBe(true);
    expect(
      claimTouchesCandidate(
        [
          {
            kind: 'context_snapshot',
            context_id: 'context:other',
            locator: anchor.path,
            lines: [10, 20],
          },
        ],
        candidate,
      ),
    ).toBe(false);
    expect(
      claimTouchesCandidate(
        [
          {
            kind: 'context_snapshot',
            context_id: anchor.context_id,
            locator: anchor.path,
            lines: [101, 110],
          },
        ],
        candidate,
      ),
    ).toBe(false);
  });
});
