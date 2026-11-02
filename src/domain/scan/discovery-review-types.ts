import type { DiscoveryAssessment } from './discovery-types';

export interface DiscoveryReviewScope {
  readonly candidate_ids: readonly string[];
  readonly component_ids: readonly string[];
  readonly action_ids: readonly string[];
}
export interface DiscoveryReviewIdentity {
  readonly repo: string;
  readonly commit: string;
  readonly inventory_sha256: string;
  readonly interpretation_sha256: string;
  readonly discovery_sha256: string;
  readonly assessment_rules_sha256: string;
  readonly instruction_sha256: string;
  readonly author_ids: readonly string[];
  readonly author_run_ids: readonly string[];
  readonly scope: DiscoveryReviewScope;
}
export interface DiscoveryReviewReceipt {
  readonly format: 'scan-discovery-review/v1';
  readonly identity: DiscoveryReviewIdentity;
  readonly reviewer_id: string;
  readonly reviewer_run_id: string;
  readonly independence: {
    readonly state: 'unknown' | 'declared' | 'orchestration_verified';
    readonly independent_of_author_ids: readonly string[];
    readonly independent_of_author_run_ids: readonly string[];
  };
  readonly examined: DiscoveryReviewScope;
  readonly verdict: 'accepted' | 'partial' | 'rejected';
  readonly findings: readonly {
    readonly id: string;
    readonly blocking: boolean;
    readonly resolved: boolean;
    readonly detail: string;
  }[];
}
export interface DiscoveryPublicationInput {
  readonly investigationCoverage: DiscoveryAssessment;
  readonly expected: DiscoveryReviewIdentity;
  readonly review?: DiscoveryReviewReceipt;
  /** Supplied by trusted orchestration, never derived from the receipt's assertion. */
  readonly verifiedReviewer?: {
    readonly reviewer_id: string;
    readonly reviewer_run_id: string;
  };
}
export interface DiscoveryPublicationAssessment {
  readonly status: 'review_required' | 'blocked' | 'complete';
  readonly blockers: readonly string[];
  readonly independence: 'unknown' | 'declared' | 'orchestration_verified';
}
