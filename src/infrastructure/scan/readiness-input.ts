import 'server-only';

import { z } from 'zod';

const file = z.string().min(1);
const input = z
  .object({
    format: z.literal('scan-readiness-input/v1'),
    repositoryReport: file,
    benchmarkReport: file,
    questionReview: file,
    frozenQuestionReview: file,
    catalogue: file,
    queries: z.array(file).min(2),
    workflowTests: file,
    regressionReceipt: file,
    nativeReplay: file,
    interpretation: file,
    interpretationInputs: file,
  })
  .strict();
export type RepositoryReadinessFiles = z.infer<typeof input>;

export function parseReadinessFiles(value: unknown): RepositoryReadinessFiles {
  return input.parse(value);
}
