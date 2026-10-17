import type { Core } from '@/application/plan/derive-core';
import type { Delivery } from '@/application/plan/derive-delivery';
import type { Owners } from '@/application/plan/derive-owners';
import type { Register } from '@/application/plan/derive-register';
import { memo, textOf, uniq } from '@/application/plan/derive-values';
import { citationsIn, parentOf, prop, strings, typeOf } from '@/application/plan/ids';
import type { StepNode } from '@/domain/plan/plan-graph';
import type { Plan, Question } from '@/domain/plan/plan.generated';

interface TeamParts {
  readonly owners: Owners;
  readonly register: Register;
  readonly delivery: Delivery;
}

const isOpenDecision = (core: Core, id: string): boolean =>
  typeOf(id) === 'decision' &&
  (textOf(prop(core.planIndex.get(id), 'status')) ?? 'proposed') === 'proposed';

interface Taking {
  readonly core: Core;
  readonly delivery: Delivery;
  readonly fed: (id: string) => void;
  readonly shown: (id: string) => void;
}

/** Sorts what a question points at: decisions it feeds, and the changes (or the work that implements them) it bears on. */
function take(env: Taking, id: string | undefined, settled: boolean): void {
  if (id === undefined) return;
  const type = typeOf(id);
  if (type === 'decision') {
    if (!settled || isOpenDecision(env.core, id)) env.fed(id);
    return;
  }
  if (settled) return;
  if (type === 'change') env.shown(id);
  else if (type === 'workItem') {
    for (const c of env.delivery.wiById.get(id)?.implements ?? []) env.shown(c);
  }
}

/** The entity a citation path such as `changes[2]` points into. */
function citingId(plan: Plan, path: string): string | undefined {
  const m = /^(changes|decisions|work_items)\[(\d+)\]/u.exec(path);
  const lists: Record<string, readonly { readonly id: string }[] | undefined> = {
    changes: plan.changes,
    decisions: plan.decisions,
    work_items: plan.work_items,
  };
  return lists[m?.[1] ?? 'work_items']?.[Number(m?.[2])]?.id;
}

const isText = (x: string | undefined): x is string => typeof x === 'string' && x !== '';

/** Everything a team's open question points at: its answer, what it blocks, what its text cites and what cites it. */
function questionTargets(
  plan: Plan,
  q: Question,
  citedBy: Register['citedBy'],
): (string | undefined)[] {
  return [
    q.answered_by,
    ...(q.blocks ?? []),
    ...citationsIn([q.question, q.answer].filter(isText).join(' ')),
    ...(citedBy.get(q.id) ?? []).map((path) => citingId(plan, path)),
  ];
}

/** The screens (and regions) a set of changes edit. */
function screensEdited(core: Core, shown: ReadonlySet<string>): string[] {
  return core.records
    .filter((r) => r.changeId !== undefined && shown.has(r.changeId))
    .flatMap((r) => [r.target, r.parent, ...r.ids])
    .filter((id): id is string => typeof id === 'string' && id.startsWith('scr:'));
}

/** The screens a set of changes edit, and the steps that show those screens, with their flows. */
function screenScope(core: Core, shown: ReadonlySet<string>): Set<string> {
  const out = new Set<string>();
  const put = (id: string): void => {
    out.add(id);
    const p = parentOf(id);
    if (p !== null && p !== '') out.add(p);
  };
  for (const id of screensEdited(core, shown)) put(id);
  const steps = [core.asIs, core.toBe].flatMap((g) => g.steps);
  for (const st of steps) {
    const scr = st.screen;
    if (scr !== undefined && (out.has(scr) || out.has(parentOf(scr) ?? ''))) put(st.id);
  }
  return out;
}

/**
 * What a team's questions and decisions bear on, so its lens shows them though it owns none of it. Only what is
 * still to decide: its proposed decisions and open questions (what they block, the decision that answers them,
 * what cites them or they cite), and an answered question only for a proposed decision it feeds. Of the changes
 * those bear on: the screens and regions they edit, and the steps that show those screens, with their flows.
 */
function decidesOn(core: Core, parts: TeamParts, teamId: string): Set<string> {
  const { plan } = core;
  const own = new Set(
    (plan.decisions ?? [])
      .filter((d) => d.decider === teamId && isOpenDecision(core, d.id))
      .map((d) => d.id),
  );
  const fed = new Set<string>();
  const shown = new Set<string>();
  const env: Taking = {
    core,
    delivery: parts.delivery,
    fed: (id) => {
      fed.add(id);
    },
    shown: (id) => {
      shown.add(id);
    },
  };
  for (const q of (plan.questions ?? []).filter((x) => x.decider === teamId)) {
    const settled = parts.register.questionState(q) === 'resolved';
    for (const id of questionTargets(plan, q, parts.register.citedBy)) take(env, id, settled);
  }
  for (const c of core.changes) {
    if ((c.decisions ?? []).some((d) => own.has(d) || fed.has(d))) shown.add(c.id);
  }
  return screenScope(core, shown);
}

const flowSteps = (core: Core, id: string): readonly StepNode[] => {
  const n = core.sys(id);
  return n?.$type === 'flow' ? n.steps : [];
};

interface Ownership {
  readonly services: readonly string[];
  readonly owned: ReadonlySet<string>;
}

function ownership(core: Core, owners: Owners, teamId: string): Ownership {
  const services = core.unionIds.filter((id) => {
    const n = core.sys(id);
    return n?.$type === 'service' && n.team === teamId;
  });
  const owned = new Set([
    teamId,
    ...services,
    ...owners.descendants(teamId),
    ...core.unionIds.filter((id) => owners.navigationTeams(id).includes(teamId)),
  ]);
  return { services, owned };
}

/** The flows with a step on something the team owns, and those steps. */
function flowsOf(
  core: Core,
  owners: Owners,
  [teamId, owned]: readonly [string, ReadonlySet<string>],
) {
  const touchesTeam = (s: StepNode): boolean =>
    [s.from, s.to].some((x) => owned.has(x)) ||
    owners.ownerTeam(s.id) === teamId ||
    core.fanout(core.toBe.has(s.id) ? core.toBe : core.asIs, s).services.some((x) => owned.has(x));
  const flows = core.unionIds.filter((id) => flowSteps(core, id).some(touchesTeam));
  const steps = flows.flatMap((f) =>
    flowSteps(core, f)
      .filter(touchesTeam)
      .map((s) => s.id),
  );
  return { flows, steps };
}

/** The team's work items, and the changes, tests, milestones and decisions that go with them. */
function workOf(core: Core, teamsOf: (chgId: string) => unknown[], teamId: string) {
  const mine = core.workItems.filter((w) => w.team === teamId);
  const chg = core.changes
    .filter((c) => teamsOf(c.id).includes(teamId) || mine.some((w) => w.implements.includes(c.id)))
    .map((c) => c.id);
  return {
    wis: mine.map((w) => w.id),
    chg,
    tst: core.tests
      .filter((t) => t.owner === teamId || t.proves.some((c) => chg.includes(c)))
      .map((t) => t.id),
    ms: core.milestones.filter((m) => mine.some((w) => w.milestone === m.id)).map((m) => m.id),
    decs: uniq(chg.flatMap((c) => strings(prop(core.planIndex.get(c), 'decisions')))),
  };
}

/** A team's cut of the plan: what it owns, what it touches, and what it has to decide. */
export interface TeamCut {
  readonly team: string;
  readonly services: readonly string[];
  readonly flows: readonly string[];
  readonly steps: readonly string[];
  readonly changes: readonly string[];
  readonly tests: readonly string[];
  readonly workItems: readonly string[];
  readonly milestones: readonly string[];
  readonly decisions: readonly string[];
  readonly questions: readonly string[];
  readonly risks: readonly string[];
  readonly decides: ReadonlySet<string>;
  readonly ids: ReadonlySet<string>;
  readonly has: (id: string) => boolean;
}

export interface TeamQueries {
  /** Owning teams of every op target of a change (first-appearance order). */
  readonly teamsOf: (chgId: string) => string[];
  readonly teamCut: (teamId: string) => TeamCut;
}

export function createTeams(core: Core, parts: TeamParts): TeamQueries {
  const { plan, records } = core;
  const { navigationTeams, ownerTeam } = parts.owners;

  /** Owning teams of every op target of a change (first-appearance order). */
  const teamsOf = memo((chgId: string): string[] =>
    uniq(
      records
        .filter((r) => r.changeId === chgId)
        .flatMap((r) => {
          const teams = navigationTeams(r.target ?? '');
          if (teams.length > 0) return teams;
          const parent = r.parent === undefined || r.parent === null ? null : ownerTeam(r.parent);
          return [ownerTeam(r.target ?? '') ?? parent];
        }),
    ),
  );

  const decides = memo((teamId: string) => decidesOn(core, parts, teamId));

  const teamCut = memo((teamId: string): TeamCut => {
    const { services, owned } = ownership(core, parts.owners, teamId);
    const { flows, steps } = flowsOf(core, parts.owners, [teamId, owned]);
    const { wis, chg, tst, ms, decs } = workOf(core, teamsOf, teamId);
    const base = new Set([...owned, ...flows, ...steps, ...wis, ...chg, ...tst]);
    const qs = (plan.questions ?? [])
      .filter((q) => q.decider === teamId || (q.blocks ?? []).some((b) => base.has(b)))
      .map((q) => q.id);
    const risks = (plan.risks ?? [])
      .filter((r) => r.owner === teamId || (r.about ?? []).some((b) => base.has(b)))
      .map((r) => r.id);
    const decided = decides(teamId);
    const ids = new Set([...base, ...ms, ...decs, ...qs, ...risks, ...decided]);
    return {
      team: teamId,
      services,
      flows,
      steps,
      changes: chg,
      tests: tst,
      workItems: wis,
      milestones: ms,
      decisions: decs,
      questions: qs,
      risks,
      decides: decided,
      ids,
      has: (id: string): boolean => ids.has(id),
    };
  });

  return { teamsOf, teamCut };
}
