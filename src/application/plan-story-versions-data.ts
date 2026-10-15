import type { DeliveryState } from '@/application/plan/delivery';
import type { Revision } from '@/application/plan/revision-types';

/** What the Versions chapter reads besides the model: the revisions on disk, and where delivery stands. */
export interface VersionsData {
  readonly revision: Revision;
  readonly delivery: DeliveryState;
}
