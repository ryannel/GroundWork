import { type Core, createCore } from '@/application/plan/derive-core';
import { type CoverageQueries, createCoverage } from '@/application/plan/derive-coverage';
import { createDelivery, type Delivery } from '@/application/plan/derive-delivery';
import { createDiff, type DiffQueries } from '@/application/plan/derive-diff';
import { createEdges, type EdgeQueries } from '@/application/plan/derive-edges';
import { createHandlers, type HandlerQueries } from '@/application/plan/derive-handlers';
import { createLadder } from '@/application/plan/derive-ladder';
import { createOwners, type Owners } from '@/application/plan/derive-owners';
import { createRegister, type Register } from '@/application/plan/derive-register';
import { createStory, type StoryQueries } from '@/application/plan/derive-story';
import { createTeams, type TeamQueries } from '@/application/plan/derive-teams';
import { createWords } from '@/application/plan/derive-words';
import { federatedFanout } from '@/application/plan/federation-fanout';
import {
  createFederationMembers,
  type FederationMembers,
} from '@/application/plan/federation-members';
import type { Findings } from '@/application/plan/validate-plan';
import type { Fanout } from '@/domain/plan/plan-graph';
import type { IssueStatus } from '@/domain/plan/plan-status';
import type { Plan } from '@/domain/plan/plan.generated';

export interface DeriveOptions {
  /** GitHub issue state of each work item, from status.json. */
  readonly status?: IssueStatus | undefined;
  /** Findings the caller already has; without them the model validates the plan itself. */
  readonly validation?: Findings | undefined;
  /** What a step reaches once its via is expanded; defaults to the federated fan-out of its graphs. */
  readonly fanout?: Fanout | undefined;
  /** The day questions fall overdue against; the caller reads the clock. Without it no question is overdue. */
  readonly today?: Date | string | undefined;
}

/** The parts of the model that the rest are built from: the graphs, owners, diff, edges and delivery. */
export interface Composed {
  readonly fanout: Fanout;
  readonly core: Core;
  readonly owners: Owners;
  readonly diff: DiffQueries;
  readonly edges: EdgeQueries;
  readonly handlers: HandlerQueries;
  readonly coverage: CoverageQueries;
  readonly register: Register;
  readonly delivery: Delivery;
  readonly teams: TeamQueries;
  readonly story: StoryQueries;
  readonly federation: FederationMembers;
}

export function compose(plan: Plan, options: DeriveOptions): Composed {
  const fanout = options.fanout ?? federatedFanout;
  const core = createCore(plan, fanout);
  const owners = createOwners(core);
  const diff = createDiff(core, createWords(core));
  const { opSummary, versions } = diff;
  const register = createRegister(core);
  const delivery = createDelivery(core, register, {
    status: options.status ?? {},
    today: options.today,
  });
  const ladder = createLadder(core, { owners, delivery, versions, opSummary });
  return {
    fanout,
    core,
    owners,
    diff,
    edges: createEdges(core),
    handlers: createHandlers(core),
    coverage: createCoverage(core),
    register,
    delivery,
    teams: createTeams(core, { owners, register, delivery }),
    story: createStory(core, { owners, register, delivery }),
    federation: createFederationMembers(core, {
      owners,
      delivery,
      versions,
      opSummary,
      diff: diff.diff,
      ladder,
    }),
  };
}
