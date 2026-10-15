import { sameJson } from '@/application/plan/compat-rules';
import { consumersIn } from '@/application/plan/derive-edges';
import { actingService } from '@/application/plan/graph-queries';
import { prop } from '@/application/plan/ids';
import type { OpRecord, SchemaNode, StepNode, SystemGraph } from '@/domain/plan/plan-graph';

export type Kind = 'reader' | 'writer' | 'caller' | 'consumer' | 'operation';

export interface Affected {
  svc: string;
  role: 'reader' | 'writer' | 'caller' | 'consumer';
  via: string;
}

export interface Moved {
  step: string | null;
  change: string | null;
  /** The next version a consumer now listens to. */
  rung?: string;
}

/** What is being judged: the schema (if any), the endpoints and messages it travels in, and their successors. */
export interface Ctx {
  id: string;
  sch: SchemaNode | null;
  requests: string[];
  responses: string[];
  messages: string[];
  successors: string[];
}

export interface PeopleEnv {
  asIs: SystemGraph;
  toBe: SystemGraph;
  records: readonly OpRecord[];
  /** Steps the plan adds or edits. */
  changed: ReadonlyMap<string, StepNode>;
  operationsSelecting: (id: string, mode: string) => string[];
}

const STEP_KEYS = [
  'action',
  'logic',
  'reads',
  'writes',
  'via',
  'from',
  'to',
  'screen',
  'purges',
] as const;

const isService = (g: SystemGraph, id: string): boolean => g.get(id)?.$type === 'service';

/** Step ids that differ between the two graphs (added, or edited in place). */
export function changedSteps(before: SystemGraph, after: SystemGraph): Map<string, StepNode> {
  const out = new Map<string, StepNode>();
  for (const s of after.steps) {
    const b = before.get(s.id);
    if (b?.$type === 'step' && STEP_KEYS.every((k) => sameJson(b[k], s[k]))) continue;
    out.set(s.id, s);
  }
  return out;
}

/** The schema ids an edit touches: the schema, and the one field (or all of them). */
function touched(ctx: Ctx, fieldName: string | undefined): Set<string> {
  const { sch } = ctx;
  if (sch === null) return new Set();
  const own =
    fieldName === undefined
      ? sch.fields.map((f) => `${sch.id}#${f.name}`)
      : [`${sch.id}#${fieldName}`];
  return new Set([sch.id, ...own]);
}

type Put = (svc: string | null | undefined, role: Affected['role'], via: string) => void;

/** What to look for: who is `kind` to this edit (one field, or all of the schema's). */
export interface Query {
  kind: Kind;
  ctx: Ctx;
  field?: string;
}

interface Search {
  g: SystemGraph;
  ctx: Ctx;
  ids: Set<string>;
  put: Put;
}

function callersOf(s: Search, vias: string[], role: 'caller' | 'reader'): void {
  for (const e of vias) {
    for (const step of s.g.steps) {
      if (step.via === e && isService(s.g, step.from)) s.put(step.from, role, step.id);
    }
  }
}

function storePeople(s: Search, kind: 'reader' | 'writer'): void {
  const ref = s.ctx.sch?.store;
  const store = ref === undefined ? undefined : s.g.get(ref);
  if (store?.$type !== 'store') return;
  for (const a of store.access ?? []) {
    if (kind === 'reader' ? a.mode !== 'write' : a.mode !== 'read') s.put(a.svc, kind, store.id);
  }
  if (kind === 'writer') s.put(store.owner, 'writer', store.id);
}

function dataPeople(s: Search, kind: 'reader' | 'writer'): void {
  const key = kind === 'reader' ? 'reads' : 'writes';
  for (const step of s.g.steps) {
    if ((step[key] ?? []).some((r) => s.ids.has(r))) s.put(actingService(s.g, step), kind, step.id);
  }
  storePeople(s, kind);
  // a response is read by whoever calls its endpoint
  if (kind === 'reader') callersOf(s, s.ctx.responses, 'reader');
}

function consumerPeople(s: Search): void {
  for (const m of s.ctx.messages) {
    for (const c of consumersIn(s.g, m)) s.put(c.svc, 'consumer', c.steps[0] ?? m);
  }
}

/** Who an edit touches, found in the system as it is today. */
export function affected(env: PeopleEnv, q: Query): Affected[] {
  const { kind, ctx } = q;
  const seen = new Set<string>();
  const out: Affected[] = [];
  const put: Put = (svc, role, via) => {
    if (svc === null || svc === undefined || svc === '' || seen.has(`${svc}|${role}`)) return;
    seen.add(`${svc}|${role}`);
    out.push({ svc, role, via });
  };
  const g = env.asIs.get(ctx.id) === undefined ? env.toBe : env.asIs;
  const s: Search = { g, ctx, ids: touched(ctx, q.field), put };
  if (kind === 'reader' || kind === 'writer') dataPeople(s, kind);
  if (kind === 'caller') callersOf(s, ctx.requests, 'caller');
  if (kind === 'consumer') consumerPeople(s);
  if (kind === 'operation' && q.field !== undefined && ctx.sch !== null) {
    for (const o of env.operationsSelecting(`${ctx.sch.id}#${q.field}`, 'asIs'))
      put(o, 'reader', o);
  }
  return out;
}

const changeOfStep = (env: PeopleEnv, stepId: string): string | null =>
  env.records.find((r) => r.target === stepId || r.ids.includes(stepId))?.changeId ?? null;

function stepMoving(env: PeopleEnv, who: Affected, q: Pick<Query, 'ctx' | 'field'>): Moved | null {
  const { ctx } = q;
  const ids = touched(ctx, q.field);
  const vias = new Set([...ctx.requests, ...ctx.responses, ...ctx.messages, ...ctx.successors]);
  const goes = (s: StepNode): boolean =>
    (s.reads ?? []).some((r) => ids.has(r)) ||
    (s.writes ?? []).some((r) => ids.has(r)) ||
    vias.has(s.via);
  const step = [...env.changed.values()].find(
    (s) => (actingService(env.toBe, s) === who.svc || s.from === who.svc) && goes(s),
  );
  return step === undefined ? null : { step: step.id, change: changeOfStep(env, step.id) };
}

/** A consumer that now listens to the next version moves with it. */
function successorMoving(env: PeopleEnv, who: Affected, ctx: Ctx): Moved | null {
  const rung = ctx.successors.find((m) => consumersIn(env.toBe, m).some((c) => c.svc === who.svc));
  if (rung === undefined) return null;
  const added = env.records.find(
    (r) =>
      r.kind === 'add' &&
      r.type === 'step' &&
      prop(r.value, 'via') === rung &&
      prop(r.value, 'to') === who.svc,
  );
  return { step: null, rung, change: added?.changeId ?? null };
}

/** The step this plan adds or edits that moves a service: it acts for it and reads, writes or goes through the target. */
export function movedBy(
  env: PeopleEnv,
  who: Affected,
  q: Pick<Query, 'ctx' | 'field'>,
): Moved | null {
  return stepMoving(env, who, q) ?? successorMoving(env, who, q.ctx);
}
