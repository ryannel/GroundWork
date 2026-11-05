import type { Report } from '@/application/plan/check-context';
import { isRecord, prop, qualifiedOf, strings, typeOf } from '@/application/plan/ids';
import { fingerprintOf } from '@/application/plan/plan-base';
import { overlapsOf, overlapWords, stackOf, touchesOf } from '@/application/plan/plan-stack';
import type { EntityType } from '@/domain/plan/plan-ids';
import type { Neighbour, Neighbours } from '@/domain/plan/plan-neighbours';
import type { Plan } from '@/domain/plan/plan.generated';

// A plan reads the other plans and the programmes of its workspace only by id: the plans it builds on, the
// programme it joins, and the ids it cites as `<plan or programme>/<id>`. Composing a plan onto the plans it builds
// on is worked out elsewhere (stack-base.ts); here a plan learns whether that composition is ambiguous, and which
// plans beside it change what it changes.

const PREFIXED = /^[a-z]+:[a-z0-9]/u;

/**
 * The ids a plan or programme as written defines, wherever they sit in it, the plans it builds on, what its changes
 * touch and a hash of it. Whether it has landed is known only from its folder, so it reads as not landed.
 */
export function neighbourOf(raw: unknown): Neighbour {
  const ids = new Map<string, string | null>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!isRecord(value)) return;
    const { id, status } = value;
    if (typeof id === 'string' && PREFIXED.test(id) && !ids.has(id)) {
      ids.set(id, typeof status === 'string' ? status : null);
    }
    for (const child of Object.values(value)) visit(child);
  };
  visit(raw);
  return {
    ids,
    buildsOn: strings(prop(raw, 'builds_on')),
    touches: touchesOf(raw),
    hash: fingerprintOf(raw),
    landed: false,
  };
}

const scopeOf = (neighbours: Neighbours, scope: string): Neighbour | undefined =>
  neighbours.plans.get(scope) ?? neighbours.programmes.get(scope);

/**
 * What is wrong with a qualified id (`care-se/dec:x`): a type the place does not take, a plan or programme
 * the workspace does not have, or an id it does not define. Null when it resolves, when it is not qualified, or
 * when the plan is read without its neighbours.
 */
export function qualifiedProblem(
  neighbours: Neighbours | null,
  id: string,
  expect: readonly EntityType[] | null,
): string | null {
  const qualified = qualifiedOf(id);
  if (qualified === null) return null;
  const type = typeOf(qualified.id);
  if (expect !== null && (type === null || !expect.includes(type))) {
    return `${id} is a ${type ?? 'unknown type'}; expected ${expect.join(' or ')} — point at one of those`;
  }
  if (neighbours === null) return null;
  const scope = scopeOf(neighbours, qualified.scope);
  if (scope === undefined) {
    return `${id} names ${qualified.scope}, which is no plan or programme in this workspace; fix the folder name`;
  }
  return scope.ids.has(qualified.id)
    ? null
    : `${id} does not exist in ${qualified.scope}; fix the id, or define it there`;
}

/** The status of a question or decision, here or (qualified) in a neighbour; undefined when it cannot be told. */
function statusOf(
  plan: Plan,
  neighbours: Neighbours | null,
  id: string,
): string | null | undefined {
  const qualified = qualifiedOf(id);
  if (qualified === null) {
    const local = [...(plan.questions ?? []), ...(plan.decisions ?? [])].find((e) => e.id === id);
    return local?.status ?? null;
  }
  if (neighbours === null) return undefined;
  return scopeOf(neighbours, qualified.scope)?.ids.get(qualified.id) ?? null;
}

const isOpenQuestion = (status: string | null | undefined, id: string): boolean =>
  typeOf(qualifiedOf(id)?.id ?? id) === 'question' && (status === undefined || status === 'open');

/**
 * A change may wait for its shape: no ops yet, only while it says what it requires and an open question holds it
 * back. It gains ops once the shape is agreed.
 */
export function checkChangeOps(plan: Plan, neighbours: Neighbours | null, rep: Report): void {
  for (const [i, change] of (plan.changes ?? []).entries()) {
    if ((change.ops ?? []).length > 0) continue;
    if ((change.requires ?? []).length === 0) {
      rep.error(
        ['changes', i],
        `${change.id} has no ops; say what it requires (requires), or add the ops that make it`,
      );
    } else if (
      !(change.blocked_by ?? []).some((id) => isOpenQuestion(statusOf(plan, neighbours, id), id))
    ) {
      rep.error(
        ['changes', i, 'blocked_by'],
        `${change.id} has no ops and no open question holds it back; add the ops, or name the open question in blocked_by`,
      );
    }
  }
}

/** The plans `start` reaches through builds_on, depth first, and the path to the first that leads back to it. */
function cycleThrough(
  neighbours: Neighbours,
  start: string,
  first: readonly string[],
): readonly string[] | null {
  const seen = new Set<string>();
  const walk = (slug: string, path: readonly string[]): readonly string[] | null => {
    if (slug === start) return path;
    if (seen.has(slug)) return null;
    seen.add(slug);
    for (const next of neighbours.plans.get(slug)?.buildsOn ?? []) {
      const found = walk(next, [...path, next]);
      if (found !== null) return found;
    }
    return null;
  };
  for (const slug of first) {
    const found = walk(slug, [start, slug]);
    if (found !== null) return found;
  }
  return null;
}

function checkBuildsOn(plan: Plan, neighbours: Neighbours, rep: Report): void {
  const own = plan.builds_on ?? [];
  for (const [i, slug] of own.entries()) {
    if (slug === neighbours.slug) {
      rep.error(
        ['builds_on', i],
        `the plan builds on itself; name the plans it reads on top of today`,
      );
    } else if (!neighbours.plans.has(slug)) {
      rep.error(['builds_on', i], `${slug} is no plan in this workspace; fix the plan id`);
    }
  }
  const cycle = cycleThrough(
    neighbours,
    neighbours.slug,
    own.filter((slug) => slug !== neighbours.slug),
  );
  if (cycle !== null) {
    rep.error(
      ['builds_on'],
      `builds_on runs in a circle (${cycle.join(' → ')}); one of these plans must stop building on the next`,
    );
  }
}

function checkProgrammeLinks(plan: Plan, neighbours: Neighbours, rep: Report): void {
  const programme = plan.meta.programme;
  if (programme !== undefined && !neighbours.programmes.has(programme)) {
    rep.error(
      ['meta', 'programme'],
      `${programme} is no programme in this workspace; add programmes/${programme}/programme.yaml or fix the id`,
    );
  }
  for (const [i, milestone] of (plan.milestones ?? []).entries()) {
    const scope = milestone.serves === undefined ? null : qualifiedOf(milestone.serves)?.scope;
    if (scope === null || scope === undefined || scope === programme) continue;
    rep.error(
      ['milestones', i, 'serves'],
      `${milestone.serves ?? ''} is a milestone of ${scope}, but the plan joins ${programme ?? 'no programme'}; serve its own programme's milestones (meta.programme)`,
    );
  }
}

/** The plans of the workspace with this plan as it is being read, which may be a revision or an edit. */
function withPlan(plan: Plan, neighbours: Neighbours): Neighbours['plans'] {
  const own = neighbours.plans.get(neighbours.slug);
  const plans = new Map(neighbours.plans);
  plans.set(neighbours.slug, {
    ids: own?.ids ?? new Map(),
    hash: own?.hash ?? '',
    landed: own?.landed ?? false,
    buildsOn: plan.builds_on ?? [],
    touches: touchesOf(plan),
  });
  return plans;
}

/**
 * Two plans it builds on (directly or further down) that neither build on the other and change the same thing
 * leave its base ambiguous: an error. Any plan beside it that changes what it changes, with neither building on
 * the other, is an overlap: a warning, which the other plan gets too.
 */
function checkStack(plan: Plan, neighbours: Neighbours, rep: Report): void {
  const plans = withPlan(plan, neighbours);
  const { slug } = neighbours;
  const stack = stackOf(slug, plan.builds_on ?? [], plans);
  for (const join of stack.order === null ? [] : overlapsOf(plans, new Set(stack.order))) {
    const [a, b] = join.plans;
    rep.error(
      ['builds_on'],
      `builds on ${a} and ${b}, which neither builds on the other, and both touch ${join.target} (${join.kind}: ${join.changes.join(' and ')}); what this plan reads would depend on which went first. Make one build on the other, or build on one plan that holds the change`,
    );
  }
  if (plans.get(slug)?.landed === true) return;
  const changes = plan.changes ?? [];
  for (const overlap of overlapsOf(plans).filter((each) => each.plans.includes(slug))) {
    const mine = overlap.changes.find((id) => id.startsWith(`${slug}/`)) ?? '';
    const at = changes.findIndex((change) => `${slug}/${change.id}` === mine);
    rep.warn(at === -1 ? ['changes'] : ['changes', at], overlapWords(overlap, slug));
  }
}

/**
 * The plan's place among its neighbours: what it builds on exists, never itself or in a circle, and reads
 * unambiguously; its programme exists; the plans beside it that change the same things.
 */
export function checkNeighbours(plan: Plan, neighbours: Neighbours | null, rep: Report): void {
  if (neighbours === null) return;
  checkBuildsOn(plan, neighbours, rep);
  checkStack(plan, neighbours, rep);
  checkProgrammeLinks(plan, neighbours, rep);
}
