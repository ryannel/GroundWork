import type { ScanDocument } from '@/domain/scan/scan.generated';

import { archiveQuestionProof } from './scan-archive-review';
import { archiveReviewMutations } from './scan-archive-review-mutations';
import { messageReviewSuite } from './scan-message-review-suite';
import { orderQuestionProof } from './scan-order-review';
import { orderReviewMutations } from './scan-order-review-mutations';

type Previous = ReturnType<typeof messageReviewSuite>;

export function archivalReviewSuite(document: ScanDocument): {
  readonly questions: Previous['questions'] & {
    readonly q19: ReturnType<typeof orderQuestionProof>;
    readonly q20: ReturnType<typeof archiveQuestionProof>;
  };
  readonly mutations: Previous['mutations'] & {
    readonly orders: ReturnType<typeof orderReviewMutations>;
    readonly archival: ReturnType<typeof archiveReviewMutations>;
  };
} {
  const previous = messageReviewSuite(document);
  return {
    questions: {
      ...previous.questions,
      q19: orderQuestionProof(document),
      q20: archiveQuestionProof(document),
    },
    mutations: {
      ...previous.mutations,
      orders: orderReviewMutations(document),
      archival: archiveReviewMutations(document),
    },
  };
}
