import { type Compat, merge, nothing } from '@/application/plan/compat-judge';
import {
  deprecation,
  type Kit,
  ofContract,
  ofInterface,
  ofStore,
  touched,
} from '@/application/plan/compat-kinds';
import { netDiff, type NetRow } from '@/application/plan/compat-net';
import { changedSteps } from '@/application/plan/compat-people';
import { propRows } from '@/application/plan/compat-rules';
import { createSchemaCompat, type Env } from '@/application/plan/compat-schema';
import { memo } from '@/application/plan/derive-values';

export type { Compat } from '@/application/plan/compat-judge';
export type { NetRow } from '@/application/plan/compat-net';

/** The two graphs, and whatever else the caller knows (the plan's records, statuses and versions). */
export type CompatInput = Pick<Env, 'asIs' | 'toBe'> & Partial<Omit<Env, 'asIs' | 'toBe'>>;

function ofSchemaId({ env, ofSchema, net }: Kit, id: string): Compat | null {
  if (!env.asIs.has(id)) return nothing();
  const r = ofSchema(id);
  const dep = env.status(id) === 'deprecated' ? deprecation(id) : null;
  if (r.reasons.length === 0 && dep === null && net(id).length === 0 && env.toBe.has(id))
    return null;
  return merge(dep === null ? [r] : [r, dep]);
}

function ofField(kit: Kit, id: string): Compat | null {
  const { env, ofSchema } = kit;
  const sid = id.split('#')[0] ?? id;
  if (!env.asIs.has(sid) || !env.toBe.has(sid)) return kit.compat(sid);
  const r = ofSchema(sid);
  const mine = r.reasons.filter((x) => x.target === id);
  if (mine.length > 0) {
    return {
      verdict: r.targets.get(id) ?? 'safe',
      reasons: mine,
      who: r.who.filter((w) => w.target === id),
    };
  }
  const [a, b] = [env.asIs.get(id), env.toBe.get(id)];
  if (a !== undefined && b !== undefined && propRows(a, b).length === 0) return null;
  return touched(env.status(id)) ? nothing() : null;
}

/**
 * What a change does to the people who rely on what it touches: the verdict, the reasons, and who is affected.
 * `null` means the plan does not touch it; `nothing()` means it is new or only moved.
 */
export function createCompat(input: CompatInput): {
  compat: (id: string) => Compat | null;
  netDiff: (id: string) => NetRow[];
} {
  const env: Env = {
    records: [],
    status: () => null,
    versions: () => ({}),
    operationsSelecting: () => [],
    changed: changedSteps(input.asIs, input.toBe),
    ...input,
  };
  const net = memo((id: string) => netDiff(env.asIs, env.toBe, id));
  const kit: Kit = { env, ofSchema: createSchemaCompat(env), net, compat: (id) => compat(id) };
  const compat = memo((id: string): Compat | null => {
    const type = (env.asIs.get(id) ?? env.toBe.get(id))?.$type;
    switch (type) {
      case 'schema': {
        return ofSchemaId(kit, id);
      }
      case 'field': {
        return ofField(kit, id);
      }
      case 'endpoint':
      case 'message': {
        return ofContract(kit, id, type);
      }
      case 'interface': {
        return ofInterface(kit, id);
      }
      case 'store': {
        return ofStore(kit, id);
      }
      default: {
        return null;
      }
    }
  });
  return { compat, netDiff: net };
}
