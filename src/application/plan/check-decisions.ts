import type { Report } from '@/application/plan/check-context';
import type { Decision, Plan, Question, Risk } from '@/domain/plan/plan.generated';

interface Scope {
  readonly rep: Report;
  readonly byId: ReadonlyMap<string, Decision>;
  readonly recorded: ReadonlySet<string>;
  readonly gate: (segs: (string | number)[], message: string) => void;
}

function checkAccepted(s: Scope, x: Decision, at: readonly (string | number)[]): void {
  if (x.status !== 'accepted') return;
  if (x.decider === undefined) {
    s.rep.warn(
      at,
      `${x.id} is accepted but names no decider; set decider to the team accountable for it`,
    );
  }
  if (x.reversibility === 'one-way' && (x.options ?? []).length === 0) {
    s.rep.warn(
      at,
      `${x.id} is one-way but records no options considered; add options with why_not`,
    );
  }
}

function checkProposed(s: Scope, x: Decision, at: readonly (string | number)[]): void {
  if (x.status !== 'proposed' || !s.recorded.has(x.id)) return;
  if (x.decider === undefined || x.decide_by === undefined) {
    s.rep.warn(
      at,
      `${x.id} is proposed and a change rests on it, but it has no ${x.decider === undefined ? 'decider' : 'decide_by'}; a gate needs an owner and a date`,
    );
  }
  s.gate(
    [...at, 'status'],
    `${x.id} is still proposed and a change rests on it; accept it before the plan is approved`,
  );
}

function checkSupersedes(s: Scope, x: Decision, at: readonly (string | number)[]): void {
  for (const [j, sid] of (x.supersedes ?? []).entries()) {
    const old = s.byId.get(sid);
    if (sid === x.id) s.rep.error([...at, 'supersedes', j], `${x.id} cannot supersede itself`);
    else if (old !== undefined && old.status !== 'superseded') {
      s.rep.warn(
        [...at, 'supersedes', j],
        `${x.id} supersedes ${sid}, which is still ${old.status}; mark ${sid} superseded`,
      );
    }
  }
}

function checkDecision(s: Scope, x: Decision, i: number): void {
  const at = ['decisions', i];
  checkAccepted(s, x, at);
  checkProposed(s, x, at);
  if (x.status === 'deferred' && x.decide_by === undefined) {
    s.rep.warn(at, `${x.id} is deferred with no decide_by; set the date to revisit it`);
  }
  checkSupersedes(s, x, at);
}

function questionIsOpen(q: Question, by: Decision | undefined): boolean {
  if (by !== undefined && by.status !== 'rejected' && by.status !== 'superseded') {
    return by.status !== 'accepted';
  }
  return q.status !== 'resolved';
}

function checkAnswered(s: Scope, q: Question, at: readonly (string | number)[]): void {
  const by = q.answered_by === undefined ? undefined : s.byId.get(q.answered_by);
  if (q.status === 'resolved' && by !== undefined && by.status !== 'accepted') {
    s.rep.warn(
      [...at, 'status'],
      `${q.id} is resolved by ${by.id}, which is still ${by.status}; keep the question open until the decision is accepted`,
    );
  }
  if (q.status === 'resolved' && q.answer === undefined && q.answered_by === undefined) {
    s.rep.warn(at, `${q.id} is resolved with no answer; add answer or answered_by`);
  }
  if (q.status !== 'resolved' && by?.status === 'accepted') {
    s.rep.warn(
      [...at, 'status'],
      `${q.id} is answered by ${by.id}, which is accepted; mark the question resolved`,
    );
  }
}

function checkQuestion(s: Scope, q: Question, i: number): void {
  const by = q.answered_by === undefined ? undefined : s.byId.get(q.answered_by);
  const at = ['questions', i];
  checkAnswered(s, q, at);
  const blocks = q.blocks ?? [];
  if (!questionIsOpen(q, by) || blocks.length === 0) return;
  if (by === undefined && (q.decider === undefined || q.decide_by === undefined)) {
    s.rep.warn(
      at,
      `${q.id} blocks work but has no ${q.decider === undefined ? 'decider' : 'decide_by'}; a gate needs an owner and a date`,
    );
  }
  s.gate(
    [...at, 'status'],
    `${q.id} is open and blocks ${blocks.join(', ')}; answer it before the plan is approved`,
  );
}

function checkRisk(s: Scope, r: Risk, i: number): void {
  const by = r.accepted_by === undefined ? undefined : s.byId.get(r.accepted_by);
  if (r.roam === 'accepted' && r.accepted_by === undefined) {
    s.rep.warn(
      ['risks', i],
      `${r.id} is accepted but no decision accepts it; set accepted_by to the decision that takes on this trade-off`,
    );
  }
  if (by !== undefined && by.status !== 'accepted') {
    s.rep.warn(
      ['risks', i, 'accepted_by'],
      `${r.id} is accepted by ${by.id}, which is still ${by.status}`,
    );
  }
  if (r.accepted_by !== undefined && r.roam !== 'accepted') {
    s.rep.warn(
      ['risks', i, 'accepted_by'],
      `${r.id} names accepted_by but its roam is ${r.roam ?? 'unset'}; set roam: accepted or drop accepted_by`,
    );
  }
}

function checkEmptyDecisionLists(plan: Plan, rep: Report): void {
  for (const [i, c] of (plan.changes ?? []).entries()) {
    if (c.decisions?.length === 0) {
      rep.warn(
        ['changes', i, 'decisions'],
        `${c.id} lists no decisions; name the decision it rests on, or drop the empty list`,
      );
    }
  }
}

/** Check 12: decisions, questions and risks tell one honest story, and every gate has an owner. */
export function checkDecisions(plan: Plan, rep: Report): void {
  const approved = plan.meta.status === 'approved' || plan.meta.status === 'committed';
  if (plan.meta.status === 'committed') {
    rep.warn(
      ['meta', 'status'],
      'meta.status "committed" is now called "approved"; set meta.status: approved',
    );
  }
  checkEmptyDecisionLists(plan, rep);
  const decisions = plan.decisions ?? [];
  const s: Scope = {
    rep,
    byId: new Map(decisions.map((x) => [x.id, x])),
    recorded: new Set((plan.changes ?? []).flatMap((c) => c.decisions ?? [])),
    gate: (segs, message) => {
      if (approved) rep.error(segs, message);
    },
  };
  for (const [i, x] of decisions.entries()) checkDecision(s, x, i);
  for (const [i, q] of (plan.questions ?? []).entries()) checkQuestion(s, q, i);
  for (const [i, r] of (plan.risks ?? []).entries()) checkRisk(s, r, i);
}
