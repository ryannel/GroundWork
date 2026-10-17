import {
  type Compat,
  type Hit,
  judge,
  merge,
  nothing,
  type Person,
} from '@/application/plan/compat-judge';
import { affected, type Ctx, movedBy } from '@/application/plan/compat-people';
import { propRows, type Roles } from '@/application/plan/compat-rules';
import { type Env, successorsOf } from '@/application/plan/compat-schema';
import { textOf } from '@/application/plan/derive-values';
import { prop } from '@/application/plan/ids';

export type ContractKind = 'endpoint' | 'message';

export interface Target {
  readonly id: string;
  readonly kind: ContractKind;
}
type Judge = (id: string, scope?: Roles) => Compat;

const NOBODY = 'nobody is on the old version';

const ctxFor = (env: Env, id: string, kind: ContractKind): Ctx => ({
  id,
  sch: null,
  requests: kind === 'endpoint' ? [id] : [],
  responses: [],
  messages: kind === 'message' ? [id] : [],
  successors: successorsOf(env, [id]),
});

const who = (kind: ContractKind): 'caller' | 'consumer' =>
  kind === 'endpoint' ? 'caller' : 'consumer';

/** A versioned pair (one replaces the other): whoever is on the old version has to move. */
function pairResult(env: Env, id: string, kind: ContractKind): Compat | null {
  const v = env.versions(id);
  const old = v.replacedBy === null || v.replacedBy === undefined ? v.supersedes : id;
  if (old === null || old === undefined) return null;
  const ctx = ctxFor(env, old, kind);
  const role = who(kind) === 'consumer' ? 'consumer' : 'caller';
  const people: Person[] = affected(env, { kind: role, ctx }).map((w) => ({
    ...w,
    target: id,
    movedBy: movedBy(env, w, { ctx }),
  }));
  const reason = (text: string, verdict: 'safe' | 'migration') => [
    { target: id, rule: 'version-pair', text, verdict },
  ];
  if (people.length === 0) return { verdict: 'safe', reasons: reason(NOBODY, 'safe'), who: [] };
  const left = people.filter((p) => p.movedBy === null).length;
  const noun = people.length === 1 ? role : `${role}s`;
  const tail = left > 0 ? `; ${String(left)} not yet moved` : '; all move in this plan';
  const text = `${String(people.length)} ${noun} on the old version${tail}`;
  return { verdict: 'migration', reasons: reason(text, 'migration'), who: people };
}

/** The contract's own props that break whoever relies on it. */
function ownHits({ id, kind }: Target, before: object, after: object): Hit[] {
  const hit = (rule: string, text: string): Hit => ({
    target: id,
    verdict: 'breaking',
    rule,
    text,
    who: [who(kind)],
  });
  return propRows(before, after).flatMap((p) => {
    if (kind === 'endpoint' && ['sig', 'request', 'response', 'auth'].includes(p.prop)) {
      return [hit('contract-change', `${p.prop === 'sig' ? 'the signature' : p.prop} changes`)];
    }
    if (kind === 'message' && p.prop === 'key') {
      return [hit('message-key', 'the key changes; ordering changes')];
    }
    return kind === 'message' && ['payload', 'topic'].includes(p.prop)
      ? [hit('contract-change', `${p.prop} changes`)]
      : [];
  });
}

/** The shape it carries: a payload, a request or a response is part of the contract. */
function carried(id: string, kind: ContractKind, after: object): [string | undefined, Roles][] {
  const roles = (r: Partial<Roles>): Roles => ({
    record: false,
    graph: false,
    request: [],
    response: [],
    payload: [],
    ...r,
  });
  if (kind === 'message') return [[textOf(prop(after, 'payload')), roles({ payload: [id] })]];
  return [
    [textOf(prop(after, 'request')), roles({ request: [id] })],
    [textOf(prop(after, 'response')), roles({ response: [id] })],
  ];
}

function removal(env: Env, { id, kind }: Target): Compat {
  const gone: Hit = {
    target: id,
    verdict: 'breaking',
    rule: 'remove',
    text: 'it is removed',
    who: [who(kind)],
  };
  return judge(env, [gone], ctxFor(env, id, kind));
}

const deprecation = (id: string): Compat => ({
  verdict: 'safe',
  reasons: [{ target: id, rule: 'deprecate', text: 'still served', verdict: 'safe' }],
  who: [],
});

export function contractCompat(env: Env, schema: Judge, at: Target): Compat {
  const { id, kind } = at;
  const [a, b] = [env.asIs.get(id), env.toBe.get(id)];
  const pair = pairResult(env, id, kind);
  if (a === undefined) return merge([nothing(), pair ?? nothing()]);
  if (b === undefined) return removal(env, at);
  const parts: Compat[] = env.status(id) === 'deprecated' ? [deprecation(id)] : [];
  const own = ownHits(at, a, b);
  if (own.length > 0) parts.push(judge(env, own, ctxFor(env, id, kind)));
  for (const [sid, scope] of carried(id, kind, b)) {
    if (sid !== undefined && env.asIs.has(sid) && env.toBe.has(sid)) parts.push(schema(sid, scope));
  }
  if (pair !== null) parts.push(pair);
  return merge(parts.length > 0 ? parts : [nothing()]);
}
