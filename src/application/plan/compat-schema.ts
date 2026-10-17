import { type Hit, judge, type Judged, nothing } from '@/application/plan/compat-judge';
import type { Ctx, Kind, PeopleEnv } from '@/application/plan/compat-people';
import {
  fieldRule,
  propRows,
  type Roles,
  type RoleRule,
  worse,
} from '@/application/plan/compat-rules';
import type { SchemaNode, SystemGraph } from '@/domain/plan/plan-graph';

export type Versions = (id: string) => {
  readonly supersedes?: string | null;
  readonly replacedBy?: string | null;
};

export interface Env extends PeopleEnv {
  readonly status: (id: string) => string | null;
  readonly versions: Versions;
}

/** The ids that supersede these, in the plan or by an op. */
export function successorsOf(env: Env, ids: readonly string[]): string[] {
  const later = [...env.toBe.messages, ...env.toBe.endpoints];
  return ids
    .flatMap((x) => [
      env.versions(x).replacedBy,
      ...later.filter((e) => e.supersedes === x).map((e) => e.id),
    ])
    .filter((x): x is string => x !== null && x !== undefined && x !== '');
}

function ctxOf(
  env: Env,
  target: { readonly id: string; readonly sch: SchemaNode | null },
  roles: Partial<Roles>,
): Ctx {
  const [requests, responses, messages] = [
    roles.request ?? [],
    roles.response ?? [],
    roles.payload ?? [],
  ];
  const successors = successorsOf(env, [...requests, ...responses, ...messages]);
  return { ...target, requests, responses, messages, successors };
}

/** What a schema is, across both graphs: a record, a body of endpoints, a payload of messages. */
function systemRoles(env: Env, sch: SchemaNode): Roles {
  const graphs: SystemGraph[] = [env.asIs, env.toBe];
  const endpoints = graphs.flatMap((g) => g.endpoints);
  const messages = graphs.flatMap((g) => g.messages);
  return {
    record: sch.kind === 'record' || sch.store !== undefined,
    request: endpoints.filter((e) => e.request === sch.id).map((e) => e.id),
    response: endpoints.filter((e) => e.response === sch.id).map((e) => e.id),
    payload: messages.filter((m) => m.payload === sch.id).map((m) => m.id),
    graph: sch.kind === 'graph-type',
  };
}

function whoOfRoles(roles: Roles): Kind[] {
  const unsent = roles.request.length === 0 && roles.payload.length === 0;
  const reads = roles.record || roles.response.length > 0 || roles.graph || unsent;
  return [
    ...(roles.request.length > 0 ? (['caller'] as const) : []),
    ...(roles.payload.length > 0 ? (['consumer'] as const) : []),
    ...(reads ? (['reader'] as const) : []),
  ];
}

/** One hit per rule and field, whoever it touches (a removed field breaks callers and readers alike). */
function hitsOf(id: string, name: string, rules: readonly RoleRule[]): Hit[] {
  const byRule = new Map<string, Hit>();
  for (const r of rules) {
    const key = `${r.rule}|${r.text}`;
    const prior = byRule.get(key);
    byRule.set(
      key,
      prior === undefined
        ? {
            target: `${id}#${name}`,
            field: name,
            verdict: r.verdict,
            rule: r.rule,
            text: r.text,
            who: [r.who],
          }
        : { ...prior, who: [...prior.who, r.who], verdict: worse(prior.verdict, r.verdict) },
    );
  }
  return [...byRule.values()];
}

function fieldHits(a: SchemaNode, b: SchemaNode, roles: Roles): Hit[] {
  const fields = new Map<
    string,
    [SchemaNode['fields'][number] | undefined, SchemaNode['fields'][number] | undefined]
  >();
  for (const f of a.fields) fields.set(f.name, [f, undefined]);
  for (const f of b.fields) fields.set(f.name, [fields.get(f.name)?.[0], f]);
  return [...fields].flatMap(([name, [was, now]]) =>
    was !== undefined && now !== undefined && propRows(was, now).length === 0
      ? []
      : hitsOf(a.id, name, fieldRule(roles, was, now).rules),
  );
}

/**
 * The verdict of a schema's fields under the roles it plays. `scope` limits the roles (an endpoint answers for the
 * body it takes or gives, a store for the rows it keeps, a message for its payload); omitted = every role.
 */
export function createSchemaCompat(env: Env): (id: string, scope?: Roles) => Judged {
  const cache = new Map<string, Judged>();
  const compute = (id: string, scope: Roles | undefined): Judged => {
    const [a, b] = [env.asIs.get(id), env.toBe.get(id)];
    if (a?.$type !== 'schema') return { ...nothing(), targets: new Map() }; // a new schema is safe: the fields come with it
    const roles = scope ?? systemRoles(env, b?.$type === 'schema' ? b : a);
    const ctx = ctxOf(env, { id, sch: a }, roles);
    if (b?.$type !== 'schema') {
      const gone: Hit = {
        target: id,
        verdict: 'breaking',
        rule: 'remove',
        text: 'it is removed',
        who: whoOfRoles(roles),
      };
      return judge(env, [gone], ctx);
    }
    return judge(env, fieldHits(a, b, roles), ctx);
  };
  return (id, scope) => {
    const key = `${id}:${scope === undefined ? '' : JSON.stringify(scope)}`;
    const hit = cache.get(key) ?? compute(id, scope);
    cache.set(key, hit);
    return hit;
  };
}
