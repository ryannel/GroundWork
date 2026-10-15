import type { Model } from '@/application/plan/derive';
import type { GraphMode, Mode } from '@/application/plan/derive-core';
import type { EndpointNode, InterfaceNode } from '@/domain/plan/plan-graph';

// What an endpoint's row is made of: its signatures, its parameters, who calls it, and what its interface shares.

export interface Sig {
  readonly verbs: readonly string[];
  readonly path: string;
}

const UPPER = /^[A-Z]+$/;
const GRAPHQL = new Set(['query', 'mutation', 'subscription']);

function parsePart(part: string): Sig {
  const t = part.trim();
  const gap = t.search(/\s/);
  if (gap < 0) return { verbs: [], path: t };
  const word = t.slice(0, gap);
  const path = t.slice(gap).trim();
  const verbs = word.split('|');
  if (verbs.every((v) => UPPER.test(v)) || GRAPHQL.has(word)) {
    return { verbs: GRAPHQL.has(word) ? [word] : verbs, path };
  }
  return { verbs: [], path: t };
}

/** "GET|PUT /a/{id}; PUT /b" is two signatures; a GraphQL "query product(sku)" keeps its word as the verb. */
export function parseSig(sig?: string): Sig[] {
  return (sig ?? '')
    .split(/;\s*/)
    .map(parsePart)
    .filter((s) => s.path !== '');
}

export interface PathPart {
  readonly text: string;
  readonly param: boolean;
  /** Where in the path it starts: unique among its parts. */
  readonly key: string;
}

/** A path cut into plain text and {params}, and the query it carries (dimmed). */
export function pathParts(path: string): {
  readonly parts: PathPart[];
  readonly query: PathPart[];
} {
  const [head = '', ...rest] = path.split('?');
  const query = rest.join('?');
  return { parts: cutParams(head, 'p'), query: query === '' ? [] : cutParams(`?${query}`, 'q') };
}

function cutParams(s: string, tag: string): PathPart[] {
  const parts: PathPart[] = [];
  let at = 0;
  while (at < s.length) {
    const open = s.indexOf('{', at);
    const close = open === -1 ? -1 : s.indexOf('}', open);
    if (close < 0) {
      parts.push({ text: s.slice(at), param: false, key: `${tag}${String(at)}` });
      break;
    }
    if (open > at)
      parts.push({ text: s.slice(at, open), param: false, key: `${tag}${String(at)}` });
    parts.push({ text: s.slice(open, close + 1), param: true, key: `${tag}${String(open)}` });
    at = close + 1;
  }
  return parts;
}

const NAME = /^[\w.-]+/;

function addUnique(into: string[], name: string | undefined): void {
  if (name !== undefined && name !== '' && !into.includes(name)) into.push(name);
}

/** The parameters a signature names: the `{id}`s of the path and the names after the `?`. */
export function pathParams(sig: string | undefined): { path: string[]; query: string[] } {
  const path: string[] = [];
  const query: string[] = [];
  for (const s of parseSig(sig)) {
    const [p = '', q = ''] = s.path.split('?');
    for (const part of cutParams(p, 'p')) if (part.param) addUnique(path, part.text.slice(1, -1));
    for (const item of q.split('&')) addUnique(query, NAME.exec(item.replace('{', ''))?.[0]);
  }
  return { path, query };
}

/** The first path of a signature, ready to paste; empty for a GraphQL operation. */
export function copyablePath(ep: Pick<EndpointNode, 'sig'>): string {
  const first = parseSig(ep.sig)[0];
  const verb = first?.verbs[0];
  return first !== undefined && verb !== undefined && /^[A-Z]/.test(verb) ? first.path : '';
}

const graphOf = (model: Model, mode: Mode) => (mode === 'asIs' ? model.asIs : model.toBe);
const interfaceIn = (model: Model, mode: GraphMode, id: string): InterfaceNode | undefined =>
  graphOf(model, mode).interfaces.find((i) => i.id === id);

/** Puts each endpoint the plan removes back after the one that stood before it. */
function withRemoved(list: EndpointNode[], before: readonly EndpointNode[]): EndpointNode[] {
  const out = [...list];
  for (const [i, e] of before.entries()) {
    if (out.some((x) => x.id === e.id)) continue;
    const prev = before
      .slice(0, i)
      .toReversed()
      .find((x) => out.some((y) => y.id === x.id));
    const at = prev === undefined ? -1 : out.findIndex((y) => y.id === prev.id);
    out.splice(at + 1, 0, e);
  }
  return out;
}

/** The endpoints of an interface in a mode; in diff, the ones the plan removes stay where they stood. */
export function interfaceEndpoints(
  model: Model,
  ifcId: string,
  mode: Mode = 'diff',
): EndpointNode[] {
  const was = interfaceIn(model, 'asIs', ifcId)?.endpoints;
  const now = interfaceIn(model, 'toBe', ifcId)?.endpoints;
  if (mode === 'asIs') return was ?? now ?? [];
  if (mode === 'toBe' || now === undefined) return now ?? was ?? [];
  return withRemoved(now, was ?? []);
}

/** In diff, an endpoint the plan no longer has. */
export const isRemoved = (model: Model, ep: Pick<EndpointNode, 'id'>, mode: Mode): boolean =>
  mode === 'diff' && !model.toBe.has(ep.id);

export interface CallerGroup {
  readonly svc: string;
  readonly steps: readonly string[];
}

/** Callers grouped by calling service, with the steps that call. */
export function callersOf(model: Model, epId: string, mode: Mode): CallerGroup[] {
  const by = new Map<string, string[]>();
  for (const c of model.callers(epId, mode === 'asIs' ? 'asIs' : 'toBe')) {
    if (c.from === '') continue;
    by.set(c.from, [...(by.get(c.from) ?? []), c.step]);
  }
  return [...by].map(([svc, steps]) => ({ svc, steps }));
}

export interface Param {
  readonly name: string;
  readonly type: string | null;
}

/** Parameters typed from a same-named field of the endpoint's request or response, else untyped. */
export function typedParams(
  model: Model,
  ep: EndpointNode,
  asked: { readonly names: readonly string[]; readonly mode: Mode },
): Param[] {
  const g = graphOf(model, asked.mode);
  const fields = [ep.request, ep.response].flatMap((sid) => {
    const node = sid === undefined ? undefined : g.schemas.find((s) => s.id === sid);
    return node?.fields ?? [];
  });
  return asked.names.map((name) => {
    const type = fields.find((f) => f.name === name)?.type;
    return { name, type: type === undefined ? null : type.replace(/\?$/, '') };
  });
}

export interface Shared {
  readonly auth?: string;
  readonly idempotent?: boolean;
}

/** Facts every endpoint of an interface shares (auth, idempotency): said once in the head, left out of the rows. */
export function sharedFacts(eps: readonly EndpointNode[]): Shared {
  const [first] = eps;
  if (first === undefined) return {};
  const auth =
    first.auth !== undefined && eps.every((e) => e.auth === first.auth) ? first.auth : undefined;
  const idem =
    first.idempotent !== undefined && eps.every((e) => e.idempotent === first.idempotent)
      ? first.idempotent
      : undefined;
  return {
    ...(auth === undefined ? {} : { auth }),
    ...(idem === undefined ? {} : { idempotent: idem }),
  };
}

export const idemWord = (v: boolean): string => (v ? 'idempotent' : 'not idempotent');
