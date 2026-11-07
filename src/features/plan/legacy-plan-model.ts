// Retained for the format-1 views pending retirement. Native browser surfaces never import this reader.
import { derive } from '@/application/plan/derive';
import type { LegacyPlacements } from '@/application/plan/derive-placement';
import type { Inherited } from '@/application/plan/stack-base';
import type { PlanStanding } from '@/application/plan/work-standing';
import type { IssueStatus } from '@/domain/plan/plan-status';
import type { Plan } from '@/domain/plan/plan.generated';

import { modelRequestOf } from './model-request';

interface LegacyPayload {
  readonly plan: Plan;
  readonly placements?: LegacyPlacements;
  readonly status?: IssueStatus | null;
  readonly inherited?: Inherited | null;
  readonly standing?: PlanStanding | null;
}
function isLegacyPayload(value: unknown): value is LegacyPayload {
  return typeof value === 'object' && value !== null && 'plan' in value && !('before' in value);
}
export const pendingLegacyModel = modelRequestOf((value) => {
  if (!isLegacyPayload(value)) return null;
  return derive(value.plan, {
    placements: value.placements ?? {},
    status: value.status ?? {},
    today: new Date(),
    inherited: value.inherited ?? undefined,
    standing: value.standing ?? undefined,
  });
});
