import { contractCompat } from '@/application/plan/compat-contracts';
import {
  type Compat,
  type Hit,
  judge,
  type Judged,
  merge,
  nothing,
} from '@/application/plan/compat-judge';
import type { NetRow } from '@/application/plan/compat-net';
import type { Ctx } from '@/application/plan/compat-people';
import { propRows, type Roles } from '@/application/plan/compat-rules';
import type { Env } from '@/application/plan/compat-schema';

export interface Kit {
  env: Env;
  ofSchema: (id: string, scope?: Roles) => Judged;
  net: (id: string) => NetRow[];
  compat: (id: string) => Compat | null;
}

const noRoles = (record: boolean): Roles => ({
  record,
  graph: false,
  request: [],
  response: [],
  payload: [],
});

const rootCtx = (id: string, requests: string[]): Ctx => ({
  id,
  sch: null,
  requests,
  responses: [],
  messages: [],
  successors: [],
});

const dropped = (id: string, who: Hit['who']): Hit => ({
  target: id,
  verdict: 'breaking',
  rule: 'remove',
  text: 'it is removed',
  who,
});

export const touched = (st: string | null): boolean => st !== null && st !== 'existing';

export const deprecation = (id: string): Compat => ({
  verdict: 'safe',
  reasons: [{ target: id, rule: 'deprecate', text: 'still served', verdict: 'safe' }],
  who: [],
});

export function ofContract(
  { env, ofSchema, net }: Kit,
  id: string,
  kind: 'endpoint' | 'message',
): Compat | null {
  const result = (): Compat => contractCompat(env, ofSchema, { id, kind });
  if (!env.asIs.has(id)) return result();
  if (touched(env.status(id)) || net(id).length > 0) return result();
  const r = env.toBe.has(id) ? result() : null;
  return r !== null && r.reasons.length > 0 ? r : null;
}

export function ofInterface(kit: Kit, id: string): Compat | null {
  const { env } = kit;
  const [a, b] = [env.asIs.get(id), env.toBe.get(id)];
  if (a?.$type !== 'interface') return nothing();
  const eps = [
    ...new Set([...a.endpoints, ...(b?.$type === 'interface' ? b.endpoints : [])].map((e) => e.id)),
  ];
  const parts = eps.map((e) => kit.compat(e)).filter((r): r is Compat => r !== null);
  const ctx = rootCtx(id, eps);
  if (b?.$type === 'interface') {
    const hits = propRows(a, b)
      .filter((p) => ['protocol', 'version', 'service'].includes(p.prop))
      .map((p): Hit => ({
        target: id,
        verdict: 'breaking',
        rule: 'contract-change',
        text: `${p.prop} changes`,
        who: ['caller'],
      }));
    if (hits.length > 0) parts.push(judge(env, hits, ctx));
  } else {
    parts.push(judge(env, [dropped(id, ['caller'])], ctx));
  }
  if (parts.length > 0) return merge(parts);
  return touched(env.status(id)) ? nothing() : null;
}

export function ofStore({ env, ofSchema }: Kit, id: string): Compat | null {
  if (!env.asIs.has(id)) return nothing();
  const records = [
    ...new Set(
      [...env.asIs.schemas, ...env.toBe.schemas].filter((x) => x.store === id).map((x) => x.id),
    ),
  ];
  const parts = records
    .filter((r) => env.toBe.has(r))
    .map((r) => ofSchema(r, noRoles(true)))
    .filter((c) => c.reasons.length > 0);
  if (!env.toBe.has(id)) parts.push(judge(env, [dropped(id, ['reader'])], rootCtx(id, [])));
  if (parts.length > 0) return merge(parts);
  return touched(env.status(id)) ? nothing() : null;
}
