import { describe, expect, it } from 'vitest';

import {
  assessRescanAcceptance,
  rescanAcceptanceGates,
  type RescanAcceptanceEvidence,
} from './rescan-acceptance';
import { rescanTreeSummary } from './rescan-preflight';

const repository = { repo: 'example/app', commit: 'a'.repeat(40) };
function evidence(): readonly RescanAcceptanceEvidence[] {
  return rescanAcceptanceGates.map((gate) => ({
    ...repository,
    gate,
    status: 'accepted',
    artifact: 'receipt.json',
    verifiedDigest: 'b'.repeat(64),
    independentReview: 'review.json',
    limitation: 'Dynamic runtime delivery is unresolved and explicitly anchored.',
  }));
}
describe('corpus rescan acceptance', () => {
  it('requires every gate at every repository pin while allowing explicit runtime uncertainty', () => {
    expect(
      assessRescanAcceptance({ repositories: [repository], evidence: evidence() }).status,
    ).toBe('accepted_for_declared_pinned_scope');
    expect(
      assessRescanAcceptance({
        repositories: [repository, { repo: 'example/other', commit: repository.commit }],
        evidence: evidence(),
      }).status,
    ).toBe('blocked');
  });
  it.each(['pending', 'unsupported', 'failed'] as const)(
    'rejects %s even with a successful generic workflow',
    (status) => {
      const changed = evidence().map((item, index) => (index === 1 ? { ...item, status } : item));
      expect(assessRescanAcceptance({ repositories: [repository], evidence: changed }).status).toBe(
        'blocked',
      );
    },
  );
  it.each(['commit', 'artifact', 'verifiedDigest', 'independentReview'] as const)(
    'rejects missing or stale %s',
    (field) => {
      const changed = evidence().map((item, index) =>
        index === 0 ? { ...item, [field]: '' } : item,
      );
      expect(assessRescanAcceptance({ repositories: [repository], evidence: changed }).status).toBe(
        'blocked',
      );
    },
  );
  it('rejects duplicate gates, empty/duplicate rosters and foreign evidence', () => {
    expect(
      assessRescanAcceptance({
        repositories: [repository],
        evidence: [...evidence(), ...evidence()],
      }).status,
    ).toBe('blocked');
    expect(assessRescanAcceptance({ repositories: [], evidence: [] }).status).toBe('blocked');
    expect(
      assessRescanAcceptance({ repositories: [repository, repository], evidence: evidence() })
        .status,
    ).toBe('blocked');
    expect(
      assessRescanAcceptance({
        repositories: [repository],
        evidence: evidence().map((item) => ({ ...item, repo: 'example/foreign' })),
      }).status,
    ).toBe('blocked');
  });
});
describe('metadata language denominator', () => {
  it('retains unsupported languages, tests, generated files, unknown suffixes and nonregular entries', () => {
    const files = [
      'app.cs',
      'tests/test.py',
      'generated/client.rs',
      'x.vue',
      'pom.xml',
      'package.json',
      'other.weird',
    ].map((filename) => ({ path: filename, kind: 'blob', mode: '100644' }));
    const result = rescanTreeSummary([...files, { path: 'link.ts', kind: 'blob', mode: '120000' }]);
    expect(result.trackedFiles).toBe(8);
    expect(result.nonRegularFiles).toBe(1);
    expect(result.languages.map((item) => item.language)).toEqual([
      'csharp',
      'python',
      'rust',
      'vue',
    ]);
    expect(result.languages.map((item) => item.semantics)).toEqual([
      'not_assessed',
      'not_assessed',
      'not_assessed',
      'not_assessed',
    ]);
    expect(result.otherSuffixes).toEqual({ xml: 1, json: 1, weird: 1 });
    expect(result.frameworkIndicators).toEqual([
      { path: 'pom.xml', indicator: 'maven' },
      { path: 'package.json', indicator: 'node-package' },
    ]);
  });
});
