import type { ScanDocument } from '@/domain/scan/scan.generated';

import { messageQuestionProofs } from './scan-message-review';
import { MESSAGE_CONSTRUCTOR_MUTATIONS } from './scan-message-review-constructor';
import { MESSAGE_CONSUMER_MUTATIONS } from './scan-message-review-consumer-mutations';
import { MESSAGE_MUTATIONS } from './scan-message-review-scenarios';

/** Only changed graphs with fully passing whole-question baselines count as rejected. */
export function messageReviewMutations(document: ScanDocument): readonly {
  readonly name: string;
  readonly question: 'q17' | 'q18';
  readonly applied: boolean;
  readonly baselinePassed: boolean;
  readonly rejected: boolean;
}[] {
  const baseline = messageQuestionProofs(document);
  return [
    ...MESSAGE_MUTATIONS,
    ...MESSAGE_CONSTRUCTOR_MUTATIONS,
    ...MESSAGE_CONSUMER_MUTATIONS,
  ].map((mutation) => {
    const changed = structuredClone(document);
    mutation.change(changed);
    const applied = JSON.stringify(changed) !== JSON.stringify(document);
    const baselinePassed = baseline[mutation.question].supported;
    return {
      name: mutation.name,
      question: mutation.question,
      applied,
      baselinePassed,
      rejected:
        applied && baselinePassed && !messageQuestionProofs(changed)[mutation.question].supported,
    };
  });
}
