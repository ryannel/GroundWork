import {
  blame,
  ledgerBefore,
  opRef,
  touched,
  type CheckContext,
  type Report,
} from '@/application/plan/check-context';
import {
  citationsIn,
  formatPath,
  refsOf,
  typeOf,
  walkStrings,
  type EntityRef,
} from '@/application/plan/ids';
import type { OpRecord, PlanNode } from '@/domain/plan/plan-graph';
import type { EntityType } from '@/domain/plan/plan-ids';

const DANGLING =
  'fix the id, or define it (in the base arrays if it runs today, as an add op if the plan introduces it)';

const typeOk = (id: string, expect: readonly EntityType[] | null): boolean => {
  const t = typeOf(id);
  return expect === null || (t !== null && expect.includes(t));
};

const wrongType = (r: EntityRef): string =>
  `${r.id} is a ${typeOf(r.id) ?? 'unknown type'}; expected ${(r.expect ?? []).join(' or ')} — point at one of those`;

/** Check 1: ids are unique, and a step's id carries its flow's prefix. */
export function checkUniqueIds(ctx: CheckContext, rep: Report): void {
  for (const dup of ctx.asIs.duplicates) {
    const first = ctx.asIs.get(dup.id);
    rep.error(
      dup.$path,
      `duplicate id ${dup.id} (first defined at ${formatPath(first?.$path ?? [])}); rename one and update its references`,
    );
  }
  for (const d of ctx.planDupes) {
    rep.error(
      d.path,
      `duplicate id ${d.id} (first defined at ${formatPath(d.first)}); rename one and update its references`,
    );
  }
  for (const step of ctx.asIs.steps) {
    const flow = step.$parent ?? '';
    if (!step.id.startsWith(`${flow}#`)) {
      rep.error(
        [...step.$path, 'id'],
        `step id must start with ${flow}# (rename it, or move the step into the flow its id names)`,
      );
    }
  }
}

/** What every ref check needs: the plan's context and where to report. */
interface Scope {
  readonly ctx: CheckContext;
  readonly rep: Report;
}

/** Report an add that collides; true when this is the first add of its id (so the caller notes it). */
function checkAddCollision(s: Scope, rec: OpRecord, seen: ReadonlyMap<string, string>): boolean {
  const id = rec.target ?? '';
  const first = seen.get(id);
  const asIs = s.ctx.asIs.get(id);
  if (asIs !== undefined) {
    s.rep.error(
      [...rec.path, 'value'],
      `add id ${id} collides with an as-is id (${formatPath(asIs.$path)}); use modify with only the changed props instead`,
    );
    return false;
  }
  if (first === undefined) return true;
  s.rep.error(
    [...rec.path, 'value'],
    `add id ${id} collides with an earlier add (${first}); keep one add and merge the values`,
  );
  return false;
}

/** Check one add; true when it is the first add of its id. */
function checkAdd(s: Scope, rec: OpRecord, seen: ReadonlyMap<string, string>): boolean {
  const first = checkAddCollision(s, rec, seen);
  const parent = rec.parent ?? null;
  const parentAdd = parent === null ? undefined : s.ctx.addedBy.get(parent);
  if (parent !== null && !s.ctx.asIs.has(parent) && parentAdd !== undefined) {
    s.rep.warn(
      [...rec.path, 'into'],
      `${parent} is itself added by ${opRef(parentAdd)}; prefer putting this ${rec.type ?? 'entity'} in that add`,
    );
  }
  return first;
}

function checkTargetExists(s: Scope, rec: OpRecord, id: string): void {
  const kind = rec.kind ?? 'remove';
  if (s.ctx.asIs.has(id)) return;
  const add = s.ctx.addedBy.get(id);
  if (add !== undefined && !ledgerBefore(add, rec)) {
    s.rep.error(
      [...rec.path, kind],
      `${id} is added later in the changes list, by ${opRef(add)}; move this ${kind} after that add (or into the add's value)`,
    );
  } else if (add === undefined) {
    s.rep.error(
      [...rec.path, kind],
      `${id} does not exist; fix the id (op targets must exist today or be added earlier in the changes list; for something new use an add op)`,
    );
  }
}

function checkTarget(s: Scope, rec: OpRecord): void {
  const id = rec.target ?? '';
  checkTargetExists(s, rec, id);
  const by = rec.replacedBy ?? null;
  if (rec.kind !== 'deprecate' || by === null) return;
  if (!s.ctx.known(by)) {
    s.rep.error([...rec.path, 'replaced_by'], `${by} does not exist; ${DANGLING}`);
  } else if (typeOf(by) !== typeOf(id)) {
    s.rep.warn(
      [...rec.path, 'replaced_by'],
      `${by} is a ${String(typeOf(by))} but ${id} is a ${String(typeOf(id))}; replace it with the same kind of thing`,
    );
  }
}

/** The problems and warnings the ledger found while applying an op (shape, collision and missing are reported elsewhere). */
function reportLedgerNotes(rep: Report, rec: OpRecord): void {
  for (const p of rec.problems) {
    if (p.code === 'shape' || p.code === 'collision' || p.code === 'missing') continue;
    rep.error([...rec.path, ...p.at], p.message);
  }
  for (const w of rec.warnings) rep.warn([...rec.path, ...w.at], w.message);
}

/** Check 3: what the ledger's ops target, and the problems the ledger itself found. */
export function checkLedger(ctx: CheckContext, rep: Report): void {
  const seenAdds = new Map<string, string>();
  const s: Scope = { ctx, rep };
  for (const rec of ctx.applied.records) {
    reportLedgerNotes(rep, rec);
    if (rec.target === null) continue;
    if (rec.kind === 'add') {
      if (checkAdd(s, rec, seenAdds)) seenAdds.set(rec.target, opRef(rec));
    } else if (rec.kind !== null) checkTarget(s, rec);
  }
}

function checkAsIsRef(s: Scope, node: PlanNode, r: EntityRef): void {
  const segs = [...node.$path, ...r.path];
  const added = s.ctx.addedBy.get(r.id);
  if (!typeOk(r.id, r.expect)) s.rep.error(segs, wrongType(r));
  else if (s.ctx.asIs.has(r.id)) {
    // an as-is reference to an as-is id is fine
  } else if (added === undefined) s.rep.error(segs, `${r.id} does not exist; ${DANGLING}`);
  else {
    s.rep.error(
      segs,
      `${r.id} is added by ${opRef(added)}; base arrays describe today only — reference it from an op (e.g. modify … set: { via: ${r.id} }) or from the added entity`,
    );
  }
}

function checkAsIsRefs(s: Scope): void {
  for (const node of s.ctx.asIs.byId.values()) {
    for (const r of refsOf(node.$type, node)) checkAsIsRef(s, node, r);
  }
}

function checkToBeRef(s: Scope, node: PlanNode, r: EntityRef): void {
  const { ctx, rep } = s;
  if (ctx.toBe.has(r.id) && typeOk(r.id, r.expect)) return;
  if (!touched(ctx, node.id) && (!ctx.asIs.has(r.id) || !typeOk(r.id, r.expect))) return;
  const segs = blame(ctx, node.id, { prop: r.prop, rel: r.path });
  const removed = ctx.removedBy.get(r.id);
  if (!typeOk(r.id, r.expect)) rep.error(segs, wrongType(r));
  else if (r.prop === 'supersedes' && ctx.known(r.id)) {
    // a decision may supersede one that is known outside this plan
  } else if (removed === undefined) rep.error(segs, `${r.id} does not exist; ${DANGLING}`);
  else {
    rep.error(
      segs,
      `${node.id} refers to ${r.id}, which ${opRef(removed)} removes; migrate this reference first (modify it), or deprecate instead of remove`,
    );
  }
}

function checkToBeRefs(s: Scope): void {
  for (const node of s.ctx.toBe.byId.values()) {
    for (const r of refsOf(node.$type, node)) checkToBeRef(s, node, r);
  }
}

function checkPlanRefs({ ctx, rep }: Scope): void {
  for (const pe of ctx.planEntities.values()) {
    for (const r of refsOf(pe.type, pe.entity)) {
      const segs = [...pe.path, ...r.path];
      if (!typeOk(r.id, r.expect)) rep.error(segs, wrongType(r));
      else if (!ctx.known(r.id)) rep.error(segs, `${r.id} does not exist; ${DANGLING}`);
    }
  }
}

function checkCommitmentRefs({ ctx, rep }: Scope): void {
  for (const [i, c] of (ctx.plan.commitment ?? []).entries()) {
    for (const r of refsOf('commitment', c)) {
      if (!ctx.known(r.id)) {
        rep.error(['commitment', i, ...r.path], `${r.id} does not exist; ${DANGLING}`);
      }
    }
  }
}

function checkCitations({ ctx, rep }: Scope): void {
  walkStrings(ctx.plan, (text, segs) => {
    for (const id of citationsIn(text)) {
      if (!ctx.known(id)) {
        rep.error(segs, `cites [[${id}]], which does not exist; fix the id or remove the citation`);
      }
    }
  });
}

/** Check 2: every reference points at something that exists, of the right type. */
export function checkRefs(ctx: CheckContext, rep: Report): void {
  const s: Scope = { ctx, rep };
  checkAsIsRefs(s);
  checkToBeRefs(s);
  checkPlanRefs(s);
  checkCommitmentRefs(s);
  checkCitations(s);
}
