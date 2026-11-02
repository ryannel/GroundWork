import type { ScanDocument } from '@/domain/scan/scan.generated';

import { bindingReviewMutations } from './scan-bindings-mutations';
import { eventQuestionProofs } from './scan-event-review';
import { eventReviewMutations } from './scan-event-review-mutations';
import { messageQuestionProofs } from './scan-message-review';
import { messageReviewMutations } from './scan-message-review-mutations';
import { profileQuestionMutations } from './scan-profile-question-mutations';
import { profileQuestionProofs } from './scan-profile-review';
import { profileReviewMutations } from './scan-profile-review-mutations';

export function messageReviewSuite(document: ScanDocument): {
  readonly questions: ReturnType<typeof profileQuestionProofs> &
    ReturnType<typeof eventQuestionProofs> &
    ReturnType<typeof messageQuestionProofs>;
  readonly mutations: {
    readonly existing: ReturnType<typeof bindingReviewMutations>;
    readonly clients: ReturnType<typeof profileReviewMutations>;
    readonly questions: ReturnType<typeof profileQuestionMutations>;
    readonly events: ReturnType<typeof eventReviewMutations>;
    readonly messages: ReturnType<typeof messageReviewMutations>;
  };
} {
  const questions = {
    ...profileQuestionProofs(document),
    ...eventQuestionProofs(document),
    ...messageQuestionProofs(document),
  };
  const mutations = {
    existing: bindingReviewMutations(document),
    clients: profileReviewMutations(document),
    questions: profileQuestionMutations(document),
    events: eventReviewMutations(document),
    messages: messageReviewMutations(document),
  };
  return { questions, mutations };
}
