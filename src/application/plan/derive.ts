import { type Composed, compose, type DeriveOptions } from '@/application/plan/derive-compose';
import type { Core } from '@/application/plan/derive-core';
import type { CoverageQueries } from '@/application/plan/derive-coverage';
import type { Delivery } from '@/application/plan/derive-delivery';
import type { DiffQueries } from '@/application/plan/derive-diff';
import { createDomain, type DomainQueries } from '@/application/plan/derive-domain';
import type { EdgeQueries } from '@/application/plan/derive-edges';
import { createGlossary, type GlossaryQueries } from '@/application/plan/derive-glossary';
import type { HandlerQueries } from '@/application/plan/derive-handlers';
import { createHealth, type HealthQueries } from '@/application/plan/derive-health';
import type { Owners } from '@/application/plan/derive-owners';
import type { Register } from '@/application/plan/derive-register';
import { createScreens, type ScreenQueries } from '@/application/plan/derive-screens';
import type { StoryQueries } from '@/application/plan/derive-story';
import type { TeamQueries } from '@/application/plan/derive-teams';
import { memo } from '@/application/plan/derive-values';
import type { FederationMembers } from '@/application/plan/federation-members';
import { typeOf } from '@/application/plan/ids';
import { createLayout, type Layout } from '@/application/plan/layout';
import { setRefLabel } from '@/application/plan/ref-label';
import { type Findings, validatePlan } from '@/application/plan/validate-plan';
import type { Plan } from '@/domain/plan/plan.generated';

export type { DeriveOptions } from '@/application/plan/derive-compose';

/** Everything computed from a plan, never authored. */
export interface Model
  extends
    Pick<Core, 'asIs' | 'toBe' | 'records' | 'get' | 'label' | 'status' | 'graphOf'>,
    Pick<Owners, 'rollup' | 'ownerService' | 'ownerTeam'>,
    DiffQueries,
    Pick<
      EdgeQueries,
      'edges' | 'storeGrid' | 'callers' | 'publishPoints' | 'consumePoints' | 'consumersEffective'
    >,
    HandlerQueries,
    Pick<CoverageQueries, 'touchedBy' | 'coverage' | 'spans'>,
    TeamQueries,
    Pick<
      Delivery,
      | 'criticalPath'
      | 'topoOrder'
      | 'waves'
      | 'milestoneViolations'
      | 'blockersOf'
      | 'overdue'
      | 'statusOf'
      | 'milestoneProgress'
    >,
    Pick<Delivery, 'today'>,
    Pick<StoryQueries, 'inverse' | 'storyRefs'>,
    Pick<
      Register,
      'weightOf' | 'decisionRegister' | 'registerGroup' | 'questionState' | 'answersOf' | 'bearsOn'
    >,
    HealthQueries,
    Pick<GlossaryQueries, 'glossaryTerms'>,
    DomainQueries,
    FederationMembers,
    ScreenQueries {
  readonly plan: Plan;
  readonly typeOf: typeof typeOf;
  readonly validation: () => Findings;
  readonly layout: () => Layout;
}

/** The plan's validation and the health counts that rest on it. */
function checksOf(
  plan: Plan,
  options: DeriveOptions,
  c: Composed,
): HealthQueries & Pick<Model, 'validation'> {
  const { fanout, core, register, delivery, coverage } = c;
  const validation = memo((): Findings => options.validation ?? validatePlan(plan, { fanout }));
  const health = createHealth(core, {
    register,
    delivery,
    coverage: coverage.coverage,
    validation,
  });
  return { ...health, validation };
}

/**
 * Everything computed from a plan, never authored. Both graphs are built once; the queries are memoised, so a
 * view may call them freely on every render.
 */
export function derive(plan: Plan, options: DeriveOptions = {}): Model {
  const c = compose(plan, options);
  const { core, owners, edges, coverage, register, delivery, story } = c;
  const domain = createDomain(core, owners, edges);
  const glossary = createGlossary(core, domain.domain);
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
    ...c.diff,
    edges: edges.edges,
    storeGrid: edges.storeGrid,
    callers: edges.callers,
    publishPoints: edges.publishPoints,
    consumePoints: edges.consumePoints,
    consumersEffective: edges.consumersEffective,
    ...c.handlers,
    touchedBy: coverage.touchedBy,
    coverage: coverage.coverage,
    spans: coverage.spans,
    ...c.teams,
    criticalPath: delivery.criticalPath,
    topoOrder: delivery.topoOrder,
    waves: delivery.waves,
    milestoneViolations: delivery.milestoneViolations,
    blockersOf: delivery.blockersOf,
    overdue: delivery.overdue,
    statusOf: delivery.statusOf,
    milestoneProgress: delivery.milestoneProgress,
    today: delivery.today,
    inverse: story.inverse,
    storyRefs: story.storyRefs,
    weightOf: register.weightOf,
    decisionRegister: register.decisionRegister,
    registerGroup: register.registerGroup,
    questionState: register.questionState,
    answersOf: register.answersOf,
    bearsOn: register.bearsOn,
    ...checksOf(plan, options, c),
    glossaryTerms: glossary.glossaryTerms,
    ...domain,
    ...c.federation,
    ...createScreens(core, owners),
    ...createLayout(core),
  };
}
