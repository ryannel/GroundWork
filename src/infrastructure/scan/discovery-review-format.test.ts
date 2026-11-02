import { describe, expect, it, vi } from 'vitest';

import { parseDiscoveryReview } from './discovery-review-format';

vi.mock(import('server-only'), () => ({}));

function receipt(): unknown {
  const scope = { candidate_ids: ['candidate:one'], component_ids: [], action_ids: [] };
  return {
    format: 'scan-discovery-review/v1',
    identity: {
      repo: 'example/mixed',
      commit: 'a'.repeat(40),
      inventory_sha256: 'b'.repeat(64),
      interpretation_sha256: 'c'.repeat(64),
      discovery_sha256: 'd'.repeat(64),
      assessment_rules_sha256: 'e'.repeat(64),
      instruction_sha256: 'f'.repeat(64),
      author_ids: [],
      author_run_ids: ['run:one'],
      scope,
    },
    reviewer_id: 'reviewer:two',
    reviewer_run_id: 'run:two',
    independence: {
      state: 'unknown',
      independent_of_author_ids: [],
      independent_of_author_run_ids: ['run:one'],
    },
    examined: scope,
    verdict: 'partial',
    findings: [],
  };
}

describe('closed independent meaning review receipt', () => {
  it('retains honest partial and unknown-independence receipts', () => {
    expect(parseDiscoveryReview(receipt()).verdict).toBe('partial');
  });
  it('rejects unrecognised fields rather than silently dropping them', () => {
    const parsed = parseDiscoveryReview(receipt());
    expect(() => parseDiscoveryReview({ ...parsed, approved: true })).toThrow(/unrecognized_keys/u);
    expect(() =>
      parseDiscoveryReview({ ...parsed, identity: { ...parsed.identity, source: 'different' } }),
    ).toThrow(/unrecognized_keys/u);
  });
  it('requires all exact-input digests', () => {
    const parsed = parseDiscoveryReview(receipt());
    expect(() =>
      parseDiscoveryReview({
        ...parsed,
        identity: { ...parsed.identity, discovery_sha256: null },
      }),
    ).toThrow(/invalid_type/u);
  });
  it('rejects duplicate denominators and malformed hashes', () => {
    const parsed = parseDiscoveryReview(receipt());
    expect(() =>
      parseDiscoveryReview({
        ...parsed,
        examined: { ...parsed.examined, action_ids: ['one', 'one'] },
      }),
    ).toThrow(/custom/u);
    expect(() =>
      parseDiscoveryReview({ ...parsed, identity: { ...parsed.identity, commit: 'main' } }),
    ).toThrow(/invalid_format/u);
  });
});
