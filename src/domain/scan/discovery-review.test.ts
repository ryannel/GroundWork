import { describe, expect, it } from 'vitest';

import { assessDiscoveryPublication } from './discovery-review';
import type {
  DiscoveryPublicationInput,
  DiscoveryReviewIdentity,
  DiscoveryReviewReceipt,
} from './discovery-review-types';

function fixture(): DiscoveryPublicationInput & { readonly review: DiscoveryReviewReceipt } {
  const expected: DiscoveryReviewIdentity = {
    repo: 'example/mixed',
    commit: 'a'.repeat(40),
    inventory_sha256: 'b'.repeat(64),
    interpretation_sha256: 'c'.repeat(64),
    discovery_sha256: 'd'.repeat(64),
    assessment_rules_sha256: 'e'.repeat(64),
    instruction_sha256: 'f'.repeat(64),
    author_ids: ['author:one'],
    author_run_ids: ['run:one'],
    scope: {
      candidate_ids: ['candidate:web', 'candidate:worker'],
      component_ids: ['component:web', 'component:worker'],
      action_ids: ['action:hold', 'action:notice'],
    },
  };
  return {
    expected,
    investigationCoverage: { status: 'complete', blockers: [], knowledgeGaps: [] },
    review: {
      format: 'scan-discovery-review/v1',
      identity: expected,
      reviewer_id: 'reviewer:two',
      reviewer_run_id: 'run:two',
      independence: {
        state: 'declared',
        independent_of_author_ids: expected.author_ids,
        independent_of_author_run_ids: expected.author_run_ids,
      },
      examined: expected.scope,
      verdict: 'accepted',
      findings: [],
    },
  };
}

describe('discovery publication review', () => {
  it('requires meaning review after mechanical reconciliation', () => {
    const { expected, investigationCoverage } = fixture();
    expect(assessDiscoveryPublication({ expected, investigationCoverage }).status).toBe(
      'review_required',
    );
  });
  it('publishes matching independently declared review while keeping its assurance visible', () => {
    expect(assessDiscoveryPublication(fixture())).toEqual({
      status: 'complete',
      independence: 'declared',
      blockers: [],
    });
  });
  it.each([
    'repo',
    'commit',
    'inventory_sha256',
    'interpretation_sha256',
    'discovery_sha256',
    'assessment_rules_sha256',
    'instruction_sha256',
  ] as const)('rejects review after %s changes', (key) => {
    const input = fixture();
    const expected = { ...input.expected, [key]: 'changed' };
    expect(assessDiscoveryPublication({ ...input, expected }).status).toBe('blocked');
  });
  it.each(['candidate_ids', 'component_ids', 'action_ids'] as const)(
    'does not accept omission from the %s denominator',
    (key) => {
      const input = fixture();
      const examined = { ...input.review.examined, [key]: [] };
      const review = { ...input.review, examined };
      expect(assessDiscoveryPublication({ ...input, review }).status).toBe('blocked');
    },
  );
  it.each([
    { reviewer_id: 'author:one' },
    { reviewer_run_id: 'run:one' },
    { identity: { ...fixture().expected, author_ids: [] } },
    { independence: { ...fixture().review.independence, independent_of_author_run_ids: [] } },
  ])('rejects self review and incomplete author separation', (change) => {
    const input = fixture();
    const review = { ...input.review, ...change };
    expect(assessDiscoveryPublication({ ...input, review }).status).toBe('blocked');
  });
  it('cannot establish independence from unknown authors even with known author runs', () => {
    const input = fixture();
    const expected = { ...input.expected, author_ids: [] };
    const review = {
      ...input.review,
      identity: expected,
      independence: { ...input.review.independence, independent_of_author_ids: [] },
    };
    const assessment = assessDiscoveryPublication({ ...input, expected, review });
    expect(assessment.status).toBe('blocked');
    expect(assessment.blockers).toContain('Independent review requires known author identities.');
  });
  it('does not promote unknown independence or an unattested orchestration assertion', () => {
    const input = fixture();
    for (const state of ['unknown', 'orchestration_verified'] as const) {
      const review = { ...input.review, independence: { ...input.review.independence, state } };
      expect(assessDiscoveryPublication({ ...input, review }).status).toBe('blocked');
    }
  });
  it('requires a trusted reviewer binding for orchestration verification', () => {
    const input = fixture();
    const review = {
      ...input.review,
      independence: { ...input.review.independence, state: 'orchestration_verified' as const },
    };
    const verifiedReviewer = {
      reviewer_id: review.reviewer_id,
      reviewer_run_id: review.reviewer_run_id,
    };
    expect(assessDiscoveryPublication({ ...input, review, verifiedReviewer }).independence).toBe(
      'orchestration_verified',
    );
  });
  it('keeps honestly partial investigation unpublishable after accepted review', () => {
    const input = fixture();
    const investigationCoverage = { ...input.investigationCoverage, status: 'blocked' as const };
    expect(assessDiscoveryPublication({ ...input, investigationCoverage }).status).toBe('blocked');
  });
  it.each(['partial', 'rejected'] as const)('retains %s review without promoting it', (verdict) => {
    const input = fixture();
    expect(
      assessDiscoveryPublication({ ...input, review: { ...input.review, verdict } }).status,
    ).toBe('blocked');
  });
  it('requires unresolved blocking findings to be resolved', () => {
    const input = fixture();
    const finding = {
      id: 'gap:transport',
      blocking: true,
      resolved: false,
      detail: 'Missing handoff',
    };
    const review = { ...input.review, findings: [finding] };
    expect(assessDiscoveryPublication({ ...input, review }).status).toBe('blocked');
    expect(
      assessDiscoveryPublication({
        ...input,
        review: { ...review, findings: [{ ...finding, resolved: true }] },
      }).status,
    ).toBe('complete');
  });
});
