import type { ReactNode } from 'react';

import type { Model } from '@/application/plan/derive';
import type { StepAction } from '@/features/plan/viz/flow-diagram/flow-hit';

/** What every row of one sequence drawing shares. */
export interface SeqEnv {
  readonly model: Model;
  /** Columns on the lane strip, the person's included. */
  readonly cols: number;
  /** What picking a step does. */
  readonly action: StepAction;
  /** Extra words after a step's action, by step id. */
  readonly notes: Readonly<Record<string, ReactNode>>;
  readonly markerTitle: string;
}
