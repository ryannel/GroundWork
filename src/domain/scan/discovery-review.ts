import type {
  DiscoveryPublicationAssessment,
  DiscoveryPublicationInput,
  DiscoveryReviewIdentity,
  DiscoveryReviewReceipt,
  DiscoveryReviewScope,
} from './discovery-review-types';

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    new Set(left).size === left.length &&
    new Set(right).size === right.length &&
    left.length === right.length &&
    left.every((item) => right.includes(item))
  );
}
function sameScope(left: DiscoveryReviewScope, right: DiscoveryReviewScope): boolean {
  return (
    sameSet(left.candidate_ids, right.candidate_ids) &&
    sameSet(left.component_ids, right.component_ids) &&
    sameSet(left.action_ids, right.action_ids)
  );
}
function identityErrors(
  expected: DiscoveryReviewIdentity,
  review: DiscoveryReviewReceipt,
): readonly string[] {
  const actual = review.identity;
  const keys = [
    'repo',
    'commit',
    'inventory_sha256',
    'interpretation_sha256',
    'discovery_sha256',
    'assessment_rules_sha256',
    'instruction_sha256',
  ] as const;
  const errors = keys
    .filter((key) => expected[key] !== actual[key])
    .map((key) => `Independent review ${key} does not match current inputs.`);
  if (!sameScope(expected.scope, actual.scope) || !sameScope(expected.scope, review.examined)) {
    errors.push('Independent review must examine the exact frozen discovery denominator.');
  }
  const authorsMatch =
    sameSet(expected.author_ids, actual.author_ids) &&
    sameSet(expected.author_run_ids, actual.author_run_ids);
  if (!authorsMatch) {
    errors.push('Independent review author identities do not match current inputs.');
  }
  return errors;
}
function authorIdentityErrors(expected: DiscoveryReviewIdentity): readonly string[] {
  return [
    ...(expected.author_ids.length === 0
      ? ['Independent review requires known author identities.']
      : []),
    ...(expected.author_run_ids.length === 0
      ? ['Independent review requires known author run identities.']
      : []),
  ];
}
function independenceErrors(input: DiscoveryPublicationInput): readonly string[] {
  const { expected, review, verifiedReviewer } = input;
  if (!review) return [];
  const errors: string[] = [];
  const selfReview =
    expected.author_ids.includes(review.reviewer_id) ||
    expected.author_run_ids.includes(review.reviewer_run_id);
  if (selfReview) errors.push('The discovery author cannot independently review their own work.');
  errors.push(...authorIdentityErrors(expected));
  const authors = review.independence;
  const declared =
    sameSet(expected.author_ids, authors.independent_of_author_ids) &&
    sameSet(expected.author_run_ids, authors.independent_of_author_run_ids);
  if (!declared) {
    errors.push('Independent review must declare separation from every author and run.');
  }
  if (authors.state === 'unknown') errors.push('Reviewer independence remains unknown.');
  const verified =
    verifiedReviewer?.reviewer_id === review.reviewer_id &&
    verifiedReviewer.reviewer_run_id === review.reviewer_run_id;
  if (authors.state === 'orchestration_verified' && !verified) {
    errors.push('Orchestration-verified independence needs a separate trusted reviewer binding.');
  }
  return errors;
}
function reviewErrors(input: DiscoveryPublicationInput): readonly string[] {
  const { review } = input;
  if (!review) return ['Independent meaning review is required before discovery publication.'];
  return [
    ...identityErrors(input.expected, review),
    ...independenceErrors(input),
    ...(review.verdict === 'accepted'
      ? []
      : ['Independent meaning review has not accepted discovery.']),
    ...review.findings
      .filter((finding) => finding.blocking && !finding.resolved)
      .map((finding) => `Independent review ${finding.id}: ${finding.detail}`),
  ];
}
/** Declared independence is provenance, not a cryptographic identity attestation. */
export function assessDiscoveryPublication(
  input: DiscoveryPublicationInput,
): DiscoveryPublicationAssessment {
  const errors = reviewErrors(input);
  const coverageComplete = input.investigationCoverage.status === 'complete';
  const blockers = [
    ...input.investigationCoverage.blockers,
    ...(coverageComplete ? [] : ['Discovery investigation coverage remains incomplete.']),
    ...errors,
  ];
  const missingReview = input.review === undefined;
  const status = blockers.length === 0 ? 'complete' : 'blocked';
  return {
    status: missingReview && coverageComplete ? 'review_required' : status,
    blockers,
    independence: errors.length > 0 ? 'unknown' : (input.review?.independence.state ?? 'unknown'),
  };
}
