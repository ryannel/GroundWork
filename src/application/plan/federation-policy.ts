import { uniq } from '@/application/plan/derive-values';
import {
  fieldLabel,
  fieldNode,
  memoPerGraph,
  operationNode,
  sgName,
  storeNode,
  subgraphNode,
} from '@/application/plan/federation-index';
import { queryPlan } from '@/application/plan/federation-plan';
import type { Fetch } from '@/application/plan/federation-plan-types';
import { selectionTree, type TreeNode } from '@/application/plan/federation-tree';
import type { FieldNode, OperationNode, SystemGraph } from '@/domain/plan/plan-graph';

/** The HTTP method an operation is sent with: mutations POST; a query GETs when persisted, else POSTs. */
function methodOf(
  op: Pick<OperationNode, 'method' | 'kind' | 'persisted'> | null | undefined,
): 'GET' | 'POST' {
  if (op?.method !== undefined) return op.method;
  if (op?.kind === 'mutation') return 'POST';
  return op?.persisted !== undefined && op.persisted !== 'none' ? 'GET' : 'POST';
}

export interface Hint {
  readonly maxAge: number;
  readonly source: 'hint' | 'default';
  readonly subgraph?: string | null;
}

/**
 * Max-age hint of one selected field: its cache_control, else (a composite or root field) its subgraph's
 * default; a scalar leaf inherits its parent's (null).
 */
function hintOf(
  g: SystemGraph,
  node: TreeNode,
  at: { readonly fd: FieldNode | undefined; readonly fetch: Fetch | undefined },
): Hint | null {
  const hint = at.fd?.cache_control?.max_age;
  if (hint !== undefined) return { maxAge: hint, source: 'hint' };
  if (node.parent !== null && node.type === null) return null;
  const fallback = subgraphNode(g, at.fetch?.subgraph)?.cache_control_default;
  return { maxAge: fallback ?? 0, source: 'default', subgraph: at.fetch?.subgraph ?? null };
}

export interface PrivateAt {
  readonly field: string;
  readonly path: string;
  readonly reason: 'auth' | 'scope';
  readonly auth: string | null;
}

export type HintAt = Hint & { readonly field: string; readonly path: string };

export interface TtlOverride {
  readonly at: string;
  readonly layer: string | null;
  readonly ttl: number;
  readonly reason: string | null;
  readonly exceeds: boolean;
  readonly onUncacheable: boolean;
}

export interface ResponsePolicy {
  readonly operation: string;
  readonly method: 'GET' | 'POST';
  readonly maxAge: number;
  readonly scope: 'public' | 'private';
  readonly cacheable: boolean;
  /** The sentence for the reader: "cached for 30 s, limited by Product.stock". */
  readonly why: string;
  readonly limitedBy: HintAt | null;
  readonly private: readonly PrivateAt[];
  readonly hints: readonly HintAt[];
  readonly overrides: readonly TtlOverride[];
  readonly auth: readonly string[];
}

export function privacyOf(
  fd: FieldNode | undefined,
): { readonly reason: 'auth' | 'scope'; readonly auth: string | null } | null {
  if (fd?.auth !== undefined && fd.auth.trim() !== '') return { reason: 'auth', auth: fd.auth };
  return fd?.cache_control?.scope === 'private' ? { reason: 'scope', auth: null } : null;
}

interface Facts {
  readonly g: SystemGraph;
  readonly selected: number;
  readonly mutation: boolean;
  readonly method: 'GET' | 'POST';
  readonly maxAge: number;
  readonly limitedBy: HintAt | null;
  readonly priv: readonly PrivateAt[];
}

function uncacheableWhy(f: Facts): string {
  const { g, limitedBy, maxAge } = f;
  if (limitedBy?.source !== 'default') {
    const field = limitedBy === null ? 'the response' : fieldLabel(g, limitedBy.field);
    return `cannot be cached: ${field} has max-age 0`;
  }
  return `cannot be cached: ${fieldLabel(g, limitedBy.field)} has no cache hint, so it takes ${sgName(g, limitedBy.subgraph ?? '')}'s default of ${String(maxAge)} s`;
}

function whyOf(f: Facts): string {
  const [first] = f.priv;
  if (f.selected === 0) return 'cannot be cached: no query plan';
  if (f.mutation) return 'a mutation is never cached';
  if (first !== undefined) {
    const how = first.auth === null ? 'scope: private' : `auth: ${first.auth}`;
    return `cannot be cached: ${fieldLabel(f.g, first.field)} is private (${how})`;
  }
  if (f.maxAge <= 0) return uncacheableWhy(f);
  const by = f.limitedBy === null ? '' : fieldLabel(f.g, f.limitedBy.field);
  if (f.method !== 'GET') {
    return `cannot be cached at a shared layer: it is sent as POST (send it as GET with a persisted id); otherwise ${String(f.maxAge)} s, limited by ${by}`;
  }
  return `cached for ${String(f.maxAge)} s, limited by ${by}`;
}

const policies = memoPerGraph<ResponsePolicy>();

/** The hints and private fields of the selected nodes; the gateway's own @requires fields count too. */
function collect(
  g: SystemGraph,
  opId: string,
): { readonly hints: readonly HintAt[]; readonly priv: readonly PrivateAt[] } {
  const plan = queryPlan(g, opId);
  const fetchOf = new Map(
    plan.selected.map((s) => [s.path, plan.fetches.find((f) => f.id === s.fetch)]),
  );
  const hints: HintAt[] = [];
  const priv: PrivateAt[] = [];
  for (const node of [...selectionTree(g, opId).all, ...plan.routerNodes]) {
    const fd = fieldNode(g, node.field);
    if (fd === undefined || !fetchOf.has(node.path)) continue;
    const h = hintOf(g, node, { fd, fetch: fetchOf.get(node.path) });
    if (h !== null) hints.push({ field: fd.id, path: node.path, ...h });
    const p = privacyOf(fd);
    if (p !== null) priv.push({ field: fd.id, path: node.path, ...p });
  }
  return { hints, priv };
}

function overridesOf(
  g: SystemGraph,
  op: OperationNode | undefined,
  limit: { readonly maxAge: number; readonly cacheable: boolean },
): TtlOverride[] {
  return (op?.cache ?? []).flatMap((c) =>
    c.ttl === undefined
      ? []
      : [
          {
            at: c.at,
            layer: storeNode(g, c.at)?.layer ?? null,
            ttl: c.ttl,
            reason: c.reason ?? null,
            exceeds: c.ttl > limit.maxAge,
            onUncacheable: !limit.cacheable,
          },
        ],
  );
}

function policyOf(g: SystemGraph, opId: string): ResponsePolicy {
  const op = operationNode(g, opId);
  const plan = queryPlan(g, opId);
  const method = methodOf(op);
  const { hints, priv } = collect(g, opId);
  const limitedBy = hints.reduce<HintAt | null>(
    (m, h) => (m === null || h.maxAge < m.maxAge ? h : m),
    null,
  );
  const maxAge = plan.selected.length === 0 ? 0 : (limitedBy?.maxAge ?? 0);
  const scope = priv.length > 0 ? 'private' : 'public';
  const mutation = plan.kind === 'mutation';
  const cacheable = !mutation && maxAge > 0 && scope === 'public' && method === 'GET';
  const why = whyOf({
    g,
    selected: plan.selected.length,
    mutation,
    method,
    maxAge,
    limitedBy,
    priv,
  });
  return {
    operation: opId,
    method,
    maxAge,
    scope,
    cacheable,
    why,
    limitedBy,
    private: priv,
    hints,
    overrides: overridesOf(g, op, { maxAge, cacheable }),
    auth: uniq(priv.map((p) => p.auth)),
  };
}

/**
 * The response policy the gateway derives for an operation: the minimum max-age over the selected fields, and
 * private if any field is. A field without a hint takes its subgraph's default (0 unless set) when it is a root
 * field or returns an object; a scalar leaf inherits. Cacheable means max-age above 0, public, GET, not a mutation.
 */
export function responsePolicy(g: SystemGraph, opId: string): ResponsePolicy {
  return policies(g, opId, () => policyOf(g, opId));
}

/** The max-age a gateway entity cache gives one fetch: the minimum over its fields' hints, else its subgraph's default. */
export function fetchMaxAge(g: SystemGraph, opId: string, fetch: Fetch): number {
  const paths = new Set(fetch.paths);
  const nodes = [...selectionTree(g, opId).all, ...queryPlan(g, opId).routerNodes];
  const hints = nodes
    .filter((n) => paths.has(n.path))
    .map((n) => hintOf(g, n, { fd: fieldNode(g, n.field), fetch }))
    .flatMap((h) => (h === null ? [] : [h.maxAge]));
  if (hints.length > 0) return Math.min(...hints);
  return subgraphNode(g, fetch.subgraph)?.cache_control_default ?? 0;
}

export interface Invalidators {
  /** Both: the shortcut and the events upstream of a purging step. */
  readonly messages: readonly string[];
  /** The purging step ids. */
  readonly steps: readonly string[];
  /** The store's own `invalidated_by`. */
  readonly shortcut: readonly string[];
  /** The messages heard upstream of a purging step: what a step really reacts to. */
  readonly fromSteps: readonly string[];
}

const invalidations = memoPerGraph<Invalidators>();

/** Who empties a cache: the store's `invalidated_by` shortcut plus the events upstream of every step that purges it. */
export function invalidators(g: SystemGraph, storeId: string): Invalidators {
  return invalidations(g, storeId, () => {
    const steps: string[] = [];
    const events: string[] = [];
    for (const flow of g.flows) {
      for (const [i, s] of flow.steps.entries()) {
        if (!(s.purges ?? []).includes(storeId)) continue;
        steps.push(s.id);
        const heard = flow.steps.slice(0, i + 1).findLast((x) => x.via.startsWith('msg:'));
        if (heard !== undefined) events.push(heard.via);
      }
    }
    const shortcut = storeNode(g, storeId)?.invalidated_by ?? [];
    return { messages: uniq([...shortcut, ...events]), steps, shortcut, fromSteps: uniq(events) };
  });
}
