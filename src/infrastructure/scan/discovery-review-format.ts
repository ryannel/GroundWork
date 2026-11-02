import 'server-only';

import { z } from 'zod';

import type { DiscoveryReviewReceipt } from '@/domain/scan/discovery-review-types';

const ids = z.array(z.string().min(1)).refine((value) => new Set(value).size === value.length, {
  message: 'Review identities must be unique.',
});
const digest = z.string().regex(/^[a-f0-9]{64}$/u);
const scope = z.object({ candidate_ids: ids, component_ids: ids, action_ids: ids }).strict();
const identity = z
  .object({
    repo: z.string().min(1),
    commit: z.string().regex(/^[a-f0-9]{40}$/u),
    inventory_sha256: digest,
    interpretation_sha256: digest,
    discovery_sha256: digest,
    assessment_rules_sha256: digest,
    instruction_sha256: digest,
    author_ids: ids,
    author_run_ids: ids,
    scope,
  })
  .strict();
const receipt = z
  .object({
    format: z.literal('scan-discovery-review/v1'),
    identity,
    reviewer_id: z.string().min(1),
    reviewer_run_id: z.string().min(1),
    independence: z
      .object({
        state: z.enum(['unknown', 'declared', 'orchestration_verified']),
        independent_of_author_ids: ids,
        independent_of_author_run_ids: ids,
      })
      .strict(),
    examined: scope,
    verdict: z.enum(['accepted', 'partial', 'rejected']),
    findings: z.array(
      z
        .object({
          id: z.string().min(1),
          blocking: z.boolean(),
          resolved: z.boolean(),
          detail: z.string().min(1),
        })
        .strict(),
    ),
  })
  .strict();

export function parseDiscoveryReview(value: unknown): DiscoveryReviewReceipt {
  return receipt.parse(value);
}
