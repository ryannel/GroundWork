import {
  createContext,
  createReport,
  type CheckContext,
  type Issue,
  type Report,
} from '@/application/plan/check-context';
import { checkDecisions } from '@/application/plan/check-decisions';
import { checkDelivery } from '@/application/plan/check-delivery';
import { checkFederation } from '@/application/plan/check-federation';
import { checkHandlers } from '@/application/plan/check-handlers';
import { checkMessageKeys } from '@/application/plan/check-messages';
import {
  checkFields,
  checkMapLines,
  checkRecords,
  checkSystems,
} from '@/application/plan/check-records';
import { checkLedger, checkRefs, checkUniqueIds } from '@/application/plan/check-refs';
import { checkNavigation, checkScreens } from '@/application/plan/check-screens';
import { checkShapes, type ShapeCheck } from '@/application/plan/check-shape';
import { checkSteps } from '@/application/plan/check-steps';
import { checkText } from '@/application/plan/check-text';
import { federatedFanout } from '@/application/plan/federation-fanout';
import { revisionChecks } from '@/application/plan/revision-checks';
import type { Fanout } from '@/domain/plan/plan-graph';
import type { Plan } from '@/domain/plan/plan.generated';

export interface Findings {
  readonly errors: readonly Issue[];
  readonly warnings: readonly Issue[];
}

function dedupeIssues(list: readonly Issue[]): Issue[] {
  const seen = new Set<string>();
  return list.filter((x) => {
    const key = `${x.path}\u0000${x.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const GRAPH_CHECKS: ((ctx: CheckContext, rep: Report) => void)[] = [
  checkUniqueIds,
  checkLedger,
  checkRefs,
  checkRecords,
  checkFields,
  checkMessageKeys,
  revisionChecks,
  checkSystems,
  checkMapLines,
  checkSteps,
  checkFederation,
  checkScreens,
  checkNavigation,
  checkHandlers,
];

export interface ValidateOptions {
  /** Federation fan-out (graph queries); defaults to the federated fan-out. */
  readonly fanout?: Fanout | undefined;
  /** Schema check for entities a modify op changed; without it that recheck is skipped. */
  readonly shape?: ShapeCheck;
}

/** The cross-reference checks of a schema-valid plan. Schema errors come first, from the store. */
export function validatePlan(plan: Plan, options: ValidateOptions = {}): Findings {
  const rep = createReport(plan.meta.status === 'draft');
  const ctx = createContext(plan, options.fanout ?? federatedFanout);
  for (const check of GRAPH_CHECKS) check(ctx, rep);
  if (options.shape !== undefined) checkShapes(ctx, rep, options.shape);
  checkDelivery(plan, rep);
  checkDecisions(plan, rep);
  checkText(plan, rep);
  return { errors: dedupeIssues(rep.errors), warnings: dedupeIssues(rep.warnings) };
}
