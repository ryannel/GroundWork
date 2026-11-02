import { createHash } from 'node:crypto';

import type {
  DiscoveryPublicationAssessment,
  DiscoveryReviewIdentity,
} from '@/domain/scan/discovery-review-types';
import type { DiscoveryAssessment, DiscoveryInput } from '@/domain/scan/discovery-types';
import type { ScanDiscovery } from '@/domain/scan/discovery.generated';

interface ReviewFiles {
  readonly interpretation: string;
  readonly discovery: string;
  readonly assessmentRulesSha256: string;
  readonly interpretationInstructionsSha256: string;
}

/** Caller-verified inputs determine review identity, never identities asserted in a review receipt. */
export function discoveryReviewIdentity(
  input: DiscoveryInput,
  document: ScanDiscovery,
  files: ReviewFiles,
): DiscoveryReviewIdentity {
  const runs = input.interpretation.runs;
  const knownAuthors = runs.length > 0 && runs.every((run) => (run.author_ids?.length ?? 0) > 0);
  return {
    repo: input.inventory.repo,
    commit: input.inventory.commit,
    inventory_sha256: input.inventory.sha256,
    interpretation_sha256: createHash('sha256').update(files.interpretation).digest('hex'),
    discovery_sha256: createHash('sha256').update(files.discovery).digest('hex'),
    assessment_rules_sha256: files.assessmentRulesSha256,
    instruction_sha256: files.interpretationInstructionsSha256,
    author_ids: knownAuthors ? [...new Set(runs.flatMap((run) => run.author_ids ?? []))] : [],
    author_run_ids: runs.map((run) => run.id),
    scope: {
      candidate_ids: input.inventory.candidates.map((candidate) => candidate.id),
      component_ids: document.components.map((component) => component.id),
      action_ids: input.interpretation.claims
        .filter((claim) => claim.kind === 'action')
        .map((claim) => claim.id),
    },
  };
}

export function discoveryReviewOptions(args: readonly string[]): {
  readonly requireComplete: boolean;
  readonly review?: string;
} {
  let requireComplete = false;
  let review: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--require-complete' && !requireComplete) {
      requireComplete = true;
    } else if (
      arg === '--review' &&
      review === undefined &&
      args[index + 1]?.startsWith('--') === false
    ) {
      review = args[index + 1];
      index += 1;
    } else {
      throw new Error(
        'Expected [--review <receipt.json>] [--require-complete], each at most once.',
      );
    }
  }
  return { requireComplete, ...(review === undefined ? {} : { review }) };
}

export function discoveryValidationReceipt(
  input: DiscoveryInput,
  document: ScanDiscovery,
  result: {
    readonly investigationCoverage: DiscoveryAssessment;
    readonly assessment: DiscoveryPublicationAssessment;
    readonly reviewIdentity: DiscoveryReviewIdentity;
  },
): Readonly<Record<string, unknown>> {
  const { investigationCoverage, assessment, reviewIdentity } = result;
  return {
    format: 'scan-discovery-validation/v1',
    repo: input.inventory.repo,
    commit: input.inventory.commit,
    inventorySha256: input.inventory.sha256,
    snapshotSha256: input.inventory.snapshot_sha256,
    assessmentRulesSha256: reviewIdentity.assessment_rules_sha256,
    interpretationInstructionsSha256: reviewIdentity.instruction_sha256,
    ...assessment,
    investigationCoverage,
    knowledgeGaps: investigationCoverage.knowledgeGaps,
    reviewIdentity,
    counts: {
      candidates: input.inventory.candidates.length,
      components: document.components.length,
      entries: input.inventory.candidates.filter((candidate) => candidate.kind === 'entry').length,
      behaviours: document.behaviours.length,
      inferredClaims: input.interpretation.claims.length,
    },
    semanticAcceptance: 'not_established',
    deployedCurrency: 'unknown',
  };
}
