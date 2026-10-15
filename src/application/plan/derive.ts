import { createCore } from '@/application/plan/derive-core';
import { createCoverage } from '@/application/plan/derive-coverage';
import { createDelivery } from '@/application/plan/derive-delivery';
import { createDiff } from '@/application/plan/derive-diff';
import { createDomain } from '@/application/plan/derive-domain';
import { createEdges } from '@/application/plan/derive-edges';
import { createGlossary } from '@/application/plan/derive-glossary';
import { createHealth } from '@/application/plan/derive-health';
import { createLadder } from '@/application/plan/derive-ladder';
import { createOwners } from '@/application/plan/derive-owners';
import { createRegister } from '@/application/plan/derive-register';
import { createScreens } from '@/application/plan/derive-screens';
import { createStory } from '@/application/plan/derive-story';
import { createTeams } from '@/application/plan/derive-teams';
import { memo } from '@/application/plan/derive-values';
import { createWords } from '@/application/plan/derive-words';
import { federatedFanout } from '@/application/plan/federation-fanout';
import { createFederationMembers } from '@/application/plan/federation-members';
import { typeOf } from '@/application/plan/ids';
import { createLayout } from '@/application/plan/layout';
import { setRefLabel } from '@/application/plan/ref-label';
import { type Findings, validatePlan } from '@/application/plan/validate-plan';
import type { Fanout } from '@/domain/plan/plan-graph';
import type { IssueStatus } from '@/domain/plan/plan-status';
import type { Plan } from '@/domain/plan/plan.generated';

export interface DeriveOptions {
  /** GitHub issue state of each work item, from status.json. */
  status?: IssueStatus | undefined;
  /** Findings the caller already has; without them the model validates the plan itself. */
  validation?: Findings | undefined;
  /** What a step reaches once its via is expanded; defaults to the federated fan-out of its graphs. */
  fanout?: Fanout | undefined;
}

function compose(plan: Plan, options: DeriveOptions) {
  const fanout = options.fanout ?? federatedFanout;
  const core = createCore(plan, fanout);
  const owners = createOwners(core);
  const words = createWords(core);
  const { diff, opSummary, versions } = createDiff(core, words);
  const edges = createEdges(core);
  const coverage = createCoverage(core);
  const register = createRegister(core);
  const delivery = createDelivery(core, register, options.status ?? {});
  const teams = createTeams(core, { owners, register, delivery });
  const story = createStory(core, { owners, register, delivery });
  const ladder = createLadder(core, { owners, delivery, versions, opSummary });
  const federation = createFederationMembers(core, {
    owners,
    delivery,
    versions,
    opSummary,
    diff,
    ladder,
  });
  const domain = createDomain(core, owners, edges);
  const glossary = createGlossary(core, domain.domain);
  const screens = createScreens(core, owners);
  const validation = memo((): Findings => options.validation ?? validatePlan(plan, { fanout }));
  const health = createHealth(core, {
    register,
    delivery,
    coverage: coverage.coverage,
    validation,
  });
  return {
    core,
    owners,
    edges,
    coverage,
    register,
    delivery,
    teams,
    story,
    federation,
    domain,
    glossary,
    screens,
    health,
    validation,
    diff,
    opSummary,
    versions,
  };
}

/**
 * Everything computed from a plan, never authored. Both graphs are built once; the queries are memoised, so a
 * view may call them freely on every render.
 */
export function derive(plan: Plan, options: DeriveOptions = {}) {
  const c = compose(plan, options);
  const { core, owners, edges, coverage, register, delivery, teams, story, domain, screens } = c;
  setRefLabel((id) => (core.get(id) === undefined ? null : core.label(id)));
  return {
    plan,
    asIs: core.asIs,
    toBe: core.toBe,
    records: core.records,
    get: core.get,
    label: core.label,
    typeOf,
    status: core.status,
    graphOf: core.graphOf,
    rollup: owners.rollup,
    ownerService: owners.ownerService,
    ownerTeam: owners.ownerTeam,
    diff: c.diff,
    opSummary: c.opSummary,
    versions: c.versions,
    edges: edges.edges,
    storeGrid: edges.storeGrid,
    callers: edges.callers,
    publishPoints: edges.publishPoints,
    consumePoints: edges.consumePoints,
    consumersEffective: edges.consumersEffective,
    touchedBy: coverage.touchedBy,
    coverage: coverage.coverage,
    spans: coverage.spans,
    teamsOf: teams.teamsOf,
    teamCut: teams.teamCut,
    criticalPath: delivery.criticalPath,
    topoOrder: delivery.topoOrder,
    waves: delivery.waves,
    milestoneViolations: delivery.milestoneViolations,
    blockersOf: delivery.blockersOf,
    overdue: delivery.overdue,
    statusOf: delivery.statusOf,
    milestoneProgress: delivery.milestoneProgress,
    inverse: story.inverse,
    storyRefs: story.storyRefs,
    weightOf: register.weightOf,
    decisionRegister: register.decisionRegister,
    registerGroup: register.registerGroup,
    questionState: register.questionState,
    answersOf: register.answersOf,
    bearsOn: register.bearsOn,
    health: c.health.health,
    orphans: c.health.orphans,
    validation: c.validation,
    glossaryTerms: c.glossary.glossaryTerms,
    domain: domain.domain,
    domainLinks: domain.domainLinks,
    ...c.federation,
    ...screens,
    ...createLayout(core),
  };
}

export type Model = ReturnType<typeof derive>;
