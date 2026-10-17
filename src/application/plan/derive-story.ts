import type { Core } from '@/application/plan/derive-core';
import type { Delivery } from '@/application/plan/derive-delivery';
import type { Owners } from '@/application/plan/derive-owners';
import type { Register } from '@/application/plan/derive-register';
import { memo, uniq } from '@/application/plan/derive-values';
import { parentOf, prop, strings, typeOf } from '@/application/plan/ids';
import type { OpRecord } from '@/domain/plan/plan-graph';
import { CHAPTERS, type Chapter } from '@/domain/plan/plan-vocab';
import type { WorkItem } from '@/domain/plan/plan.generated';

const CHANGED_INSIDE = new Set([
  'schema',
  'interface',
  'flow',
  'store',
  'service',
  'screen',
  'graph',
  'subgraph',
]);

interface StoryParts {
  readonly owners: Owners;
  readonly register: Register;
  readonly delivery: Delivery;
}

const FIXED_CHAPTER: Partial<Record<string, Chapter>> = {
  scenario: 'why',
  concept: 'today',
  stage: 'today',
  change: 'changes',
  decision: 'changes',
  test: 'prove',
  workItem: 'build',
  milestone: 'build',
  question: 'commit',
  risk: 'commit',
};

/** The steps of both graphs that reach an id, through the id itself or any part of it (or anything the step fans out to). */
function stepsReaching(core: Core, id: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const g of [core.asIs, core.toBe]) {
    for (const s of g.steps) {
      if (seen.has(s.id)) continue;
      const refs = [
        s.from,
        s.to,
        s.via,
        s.screen,
        ...(s.reads ?? []),
        ...(s.writes ?? []),
        ...(s.purges ?? []),
        ...core.fanout(g, s).refs,
      ];
      if (refs.includes(id) || refs.some((r) => r !== undefined && parentOf(r) === id)) {
        out.push(s.id);
        seen.add(s.id);
      }
    }
  }
  return out;
}

const touches = (r: OpRecord, id: string): boolean =>
  r.target === id || r.ids.includes(id) || r.parent === id || parentOf(r.target ?? '') === id;

interface Env {
  readonly core: Core;
  readonly wiById: Delivery['wiById'];
  readonly owners: Owners;
  readonly stepsUsing: (id: string) => string[];
  readonly changedInside: (id: string) => boolean;
}

/** A flow reads as new, or runs (and changes when it or anything in it did). */
function flowChapters(st: string | null, inside: boolean): Chapter[] {
  if (st === 'added') return ['new'];
  return st !== 'existing' || inside ? ['runs', 'changes'] : ['runs'];
}

/** A system is drawn on the map; chapter 5 revisits it when one of its parts changes. */
function systemChapters({ core, owners }: Env, id: string): Chapter[] {
  const moved = core.unionIds.some((x) => {
    const n = core.sys(x);
    return (
      n?.$type === 'service' &&
      n.system === id &&
      (core.status(x) !== 'existing' || owners.rollup(x).total > 0)
    );
  });
  return moved ? ['today', 'changes'] : ['today'];
}

function otherChapters(env: Env, id: string, st: string | null): Chapter[] {
  const { core, stepsUsing, changedInside } = env;
  if (core.sys(id) === undefined) return [];
  if (st === 'added') return ['new'];
  const keys: Chapter[] = ['today'];
  if (stepsUsing(id).some((s) => core.asIs.has(s))) keys.push('runs');
  if (st !== 'existing' || changedInside(id)) keys.push('changes');
  return keys;
}

function chaptersOf(env: Env, id: string): Chapter[] {
  const type = typeOf(id);
  const st = env.core.status(id);
  const fixed = type === null ? undefined : FIXED_CHAPTER[type];
  if (fixed !== undefined) return [fixed];
  if (type === 'flow') return flowChapters(st, env.changedInside(id));
  if (type === 'step') {
    const home = env.core.status(parentOf(id)) === 'added' ? 'new' : 'runs';
    return st !== 'existing' && st !== 'added' ? [home, 'changes'] : [home];
  }
  return type === 'system' ? systemChapters(env, id) : otherChapters(env, id, st);
}

/** Work items touching an entity: for a work item, those that depend on it. */
function workItemsFor(core: Core, id: string, touching: readonly string[]): string[] {
  const dependsOn = (w: WorkItem): boolean => (w.depends_on ?? []).includes(id);
  if (typeOf(id) === 'workItem') return core.workItems.filter(dependsOn).map((w) => w.id);
  return core.workItems
    .filter(
      (w) =>
        w.implements.some((c) => touching.includes(c)) ||
        (w.verified_by ?? []).includes(id) ||
        w.milestone === id ||
        dependsOn(w),
    )
    .map((w) => w.id);
}

function testsFor(core: Core, id: string, touching: readonly string[]): string[] {
  const node = core.sys(id);
  const flowSteps = node?.$type === 'flow' ? node.steps.map((s) => s.id) : [];
  return core.tests
    .filter(
      (x) =>
        x.proves.some((c) => touching.includes(c)) ||
        (x.walks ?? []).includes(id) ||
        (x.walks ?? []).some((w) => flowSteps.includes(w)),
    )
    .map((x) => x.id);
}

/** The changes that explain an entity: what a decision belongs to, what a work item implements, what a test proves. */
function changesFor(env: Pick<Env, 'core' | 'wiById'>, id: string, touching: readonly string[]) {
  const { core, wiById } = env;
  const t = typeOf(id);
  if (t === 'decision') {
    return core.changes.filter((c) => (c.decisions ?? []).includes(id)).map((c) => c.id);
  }
  if (t === 'workItem') return wiById.get(id)?.implements ?? [];
  if (t === 'test') return strings(prop(core.planIndex.get(id), 'proves'));
  return touching.filter((c) => c !== id);
}

/** Everything that points at an entity; a schema also names the endpoints and messages that carry it. */
export interface Inverse {
  readonly questions: readonly string[];
  readonly decisions: readonly string[];
  readonly risks: readonly string[];
  readonly workItems: readonly string[];
  readonly tests: readonly string[];
  readonly flows: readonly string[];
  readonly steps: readonly string[];
  readonly changes: readonly string[];
  readonly scenarios: readonly string[];
  readonly citedBy: readonly string[];
  readonly story: readonly Chapter[];
  readonly endpoints?: readonly string[];
  readonly messages?: readonly string[];
}

export interface StoryQueries {
  readonly stepsUsing: (id: string) => string[];
  readonly changesTouching: (id: string) => string[];
  readonly storyRefs: (id: string) => Chapter[];
  readonly inverse: (id: string) => Inverse;
}

/** A DTO or payload is carried by endpoints (request / response) and events (payload): the way back up from a schema. */
function carriedBy({ asIs, toBe }: Core, id: string) {
  return {
    endpoints: uniq(
      [...toBe.endpoints, ...asIs.endpoints]
        .filter((e) => e.request === id || e.response === id)
        .map((e) => e.id),
    ),
    messages: uniq(
      [...toBe.messages, ...asIs.messages].filter((x) => x.payload === id).map((x) => x.id),
    ),
  };
}

/** Where an entity shows up: the steps using it, the changes touching it, the story chapters, and all that points at it. */
export function createStory(core: Core, parts: StoryParts): StoryQueries {
  const { plan, planIndex, records } = core;
  const { rollup } = parts.owners;
  const { citedBy } = parts.register;

  const stepsUsing = memo((id: string): string[] => stepsReaching(core, id));
  const changesTouching = memo((id: string): string[] =>
    uniq(records.filter((r) => touches(r, id)).map((r) => r.changeId)),
  );
  const changedInside = (id: string): boolean => {
    const n = core.sys(id);
    return n !== undefined && CHANGED_INSIDE.has(n.$type) && rollup(id).total > 0;
  };
  const env: Env = {
    core,
    wiById: parts.delivery.wiById,
    owners: parts.owners,
    stepsUsing,
    changedInside,
  };
  const storyRefs = memo((id: string): Chapter[] =>
    CHAPTERS.filter((k) => chaptersOf(env, id).includes(k)),
  );

  /** Everything that points at an entity. */
  const inverse = memo((id: string): Inverse => {
    const t = typeOf(id);
    const touching = t === 'change' ? [id] : changesTouching(id);
    const steps = t === 'flow' ? [] : stepsUsing(id);
    const out: Inverse = {
      questions: (plan.questions ?? [])
        .filter((q) => (q.blocks ?? []).some((b) => b === id || touching.includes(b)))
        .map((q) => q.id),
      decisions:
        t === 'decision'
          ? []
          : uniq(touching.flatMap((c) => strings(prop(planIndex.get(c), 'decisions')))),
      risks: (plan.risks ?? []).filter((r) => (r.about ?? []).includes(id)).map((r) => r.id),
      workItems: workItemsFor(core, id, touching),
      tests: testsFor(core, id, touching),
      flows: uniq(steps.map(parentOf)),
      steps,
      changes: changesFor(env, id, touching),
      scenarios: (plan.problem.scenarios ?? [])
        .filter((s) => (s.flows ?? []).includes(id))
        .map((s) => s.id),
      citedBy: citedBy.get(id) ?? [],
      story: storyRefs(id),
    };
    return t === 'schema' ? { ...out, ...carriedBy(core, id) } : out;
  });

  return { stepsUsing, changesTouching, storyRefs, inverse };
}
