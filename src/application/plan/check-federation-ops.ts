import { opRef } from '@/application/plan/check-context';
import type { Scope } from '@/application/plan/check-federation-scope';
import { fieldLabel } from '@/application/plan/federation-index';
import { queryPlan } from '@/application/plan/federation-plan';
import { responsePolicy, type ResponsePolicy } from '@/application/plan/federation-policy';
import {
  selectionTree,
  type SelectionTree,
  type TreeError,
} from '@/application/plan/federation-tree';
import type { OperationNode, StoreNode } from '@/domain/plan/plan-graph';
import type { CacheUse } from '@/domain/plan/plan.generated';

const PLAN_WARNINGS = new Set(['plan-check', 'no-shared-key', 'no-owner']);

/** What the reader can do about a field the document selects that the graph does not have. */
function fixFor(
  at: { readonly s: Scope; readonly op: OperationNode },
  tree: SelectionTree,
  e: TreeError,
): string {
  const { s, op } = at;
  if (e.code !== 'unknown-field' && e.code !== 'top-level') return '';
  const node = tree.all.find((n) => n.path === e.path);
  const fid =
    node?.parentType === null || node === undefined ? null : `${node.parentType}#${node.name}`;
  const gone = fid === null ? undefined : s.ctx.removedBy.get(fid);
  if (s.toBe && fid !== null && gone !== undefined) {
    return `; ${opRef(gone)} removes ${fid} while ${op.id} still selects it, so change the document first (modify: ${op.id} set: { document })`;
  }
  return '; fix the document, or add the field to the graph type';
}

function checkDocument(s: Scope, op: OperationNode, tree: SelectionTree): void {
  for (const e of tree.errors) {
    if (e.code === 'unknown-operation') continue;
    s.error(s.at(op, 'document'), `${op.id}: ${e.message}${fixFor({ s, op }, tree, e)}`);
  }
  const parsed = tree.parsed.kind;
  if (parsed !== null && parsed !== op.kind) {
    s.error(
      s.at(op, 'kind'),
      `${op.id}'s document is a ${parsed} but kind says ${op.kind}; make them agree`,
    );
  }
  if (op.kind === 'subscription') {
    s.warn(
      s.at(op, 'kind'),
      `${op.id} is a subscription; no query plan or cache path is derived for subscriptions`,
    );
  }
  if (op.kind === 'mutation' && (op.writes ?? []).length === 0) {
    s.warn(
      s.at(op, 'writes', ['id']),
      `${op.id} is a mutation but names no writes; add writes: [sch:…] (the records its root resolver changes)`,
    );
  }
}

function checkClient(s: Scope, op: OperationNode): void {
  if (op.client === undefined || op.client === '') return;
  for (const [i, x] of (op.screens ?? []).entries()) {
    const scr = s.g.get(x.split('#')[0]);
    if (scr?.$type !== 'screen' || scr.service === op.client) continue;
    s.error(
      s.at(op, 'client'),
      `${op.id} is sent by ${op.client}, but ${x} is served by ${scr.service}; set client to the service that serves its screens, or fix screens[${String(i)}]`,
    );
  }
}

function checkPlanWarnings(s: Scope, op: OperationNode): void {
  for (const w of queryPlan(s.g, op.id).warnings) {
    if (PLAN_WARNINGS.has(w.code)) {
      s.warn(s.at(op, w.code === 'plan-check' ? 'plan_check' : 'document'), w.message);
    }
  }
}

interface CacheAt {
  readonly s: Scope;
  readonly op: OperationNode;
  readonly pol: ResponsePolicy;
  readonly c: CacheUse;
  readonly st: StoreNode;
  readonly i: number;
}

/** A private response cannot sit at the edge, or in a gateway that caches whole responses. */
function privateProblem({ s, op, pol, c, st }: CacheAt): string | null {
  const shared = st.layer === 'edge' || (st.layer === 'gateway' && st.granularity !== 'entity');
  if (pol.scope !== 'private' || !shared) return null;
  const field = pol.private[0]?.field;
  const which = field === undefined ? 'a field' : fieldLabel(s.g, field);
  return `${op.name} cannot be cached at the ${String(st.layer)}: ${which} is private; drop ${c.at} from its cache, or move the private field into its own operation`;
}

/** A ttl the response cannot honour, or one that outlives the derived max-age without a reason. */
function ttlProblem({ s, op, pol, c, st }: CacheAt): string | null {
  const ttl = c.ttl;
  if (ttl === undefined) return null;
  const edgePost = st.layer === 'edge' && pol.method !== 'GET';
  if (!pol.cacheable && st.layer !== 'subgraph' && !edgePost) {
    return `${op.name}: ${c.at} ttl ${String(ttl)} s is set on a response that cannot be cached (${pol.why}); drop the ttl, or fix the field's cache hint`;
  }
  if (ttl <= pol.maxAge || (c.reason ?? '') !== '') return null;
  const by = pol.limitedBy === null ? 'its fields' : fieldLabel(s.g, pol.limitedBy.field);
  return `${op.name}: ${c.at} ttl ${String(ttl)} s overrides the derived ${String(pol.maxAge)} s (limited by ${by}); add reason: saying why serving it ${String(ttl)} s old is acceptable, or drop the ttl`;
}

/** Where a cache layer holds the response, and whether the response lets it. */
function checkCache(a: CacheAt): void {
  const { s, op, pol, c, st, i } = a;
  const at = s.at(op, 'cache', ['cache', i, 'at']);
  if (st.kind !== 'cache') {
    s.warn(at, `${op.id} caches at ${c.at}, a ${st.kind}; cache[].at names a kind: cache store`);
    return;
  }
  if (st.layer === 'edge' && pol.method !== 'GET') {
    s.warn(
      at,
      `the edge does not cache POST; ${op.name} needs method: GET with a persisted id (persisted: apq or safelist), or drop ${c.at} from its cache`,
    );
  }
  const scope = privateProblem(a);
  if (scope !== null) {
    s.warn(at, scope);
    return;
  }
  const ttl = ttlProblem(a);
  if (ttl !== null) s.warn(s.at(op, 'cache', ['cache', i, 'ttl']), ttl);
}

/** Checks 17, 18 and 20: the document resolves, the right client sends it, caches can hold it. */
export function checkOperations(s: Scope): void {
  for (const op of s.g.operations) {
    const tree = selectionTree(s.g, op.id);
    checkDocument(s, op, tree);
    checkClient(s, op);
    checkPlanWarnings(s, op);
    if (op.kind === 'subscription' || tree.root === null) continue;
    const pol = responsePolicy(s.g, op.id);
    for (const [i, c] of (op.cache ?? []).entries()) {
      const st = s.g.get(c.at);
      if (st?.$type === 'store') checkCache({ s, op, pol, c, st, i });
    }
  }
}
