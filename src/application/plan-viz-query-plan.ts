import type { Model } from '@/application/plan/derive';
import type { Added, Fetch, QueryPlan } from '@/application/plan/federation-plan-types';

// The query plan as a tree: how the gateway resolves one operation, in the words a query plan uses. Rounds of fetches
// run one after another (Sequence); fetches in one round run together (Parallel); a fetch below the root says where
// its result is folded in (Flatten). One round trip has no Sequence; one fetch in a round has no Parallel.

export type PlanMode = 'asIs' | 'toBe';

/** Why the gateway added a name to a fetch's selection. */
export const WHY: Readonly<Record<Added['reason'], string>> = {
  key: 'Added by the gateway: the key the next fetch asks by',
  requires: 'Added by the gateway: a field above needs it (@requires)',
};

/** A name in a fetch's selection, with the names asked inside it. */
export interface SelNode {
  readonly name: string;
  readonly kids: SelNode[];
  router: Added['reason'] | null;
}

const slug = (id: string): string => id.replace(/^sg:/, '');

/** The plan to draw, or null when the document does not parse or no fetch is derived. */
export function planOf(model: Model, opId: string, mode: PlanMode = 'toBe'): QueryPlan | null {
  const plan = model.queryPlan(opId, mode);
  if (plan.fetches.length === 0 || plan.warnings.some((w) => w.code === 'parse')) return null;
  return plan;
}

/** The fetches in rounds, one entry per round trip. */
export function roundsOf(plan: QueryPlan): Fetch[][] {
  const byId = new Map(plan.fetches.map((f) => [f.id, f]));
  return plan.levels
    .map((ids) => ids.flatMap((id) => byId.get(id) ?? []))
    .filter((round) => round.length > 0);
}

/** The tree as plain text, which every surface must agree with: "Sequence>Fetch product>Parallel(2)". */
export function planFacts(model: Model, opId: string, mode: PlanMode = 'toBe'): string {
  const plan = planOf(model, opId, mode);
  if (plan === null) return '';
  const rounds = roundsOf(plan);
  const steps = rounds.map((r) =>
    r.length > 1 ? `Parallel(${String(r.length)})` : `Fetch ${slug(r[0]?.subgraph ?? '')}`,
  );
  return (rounds.length > 1 ? ['Sequence', ...steps] : steps).join('>');
}

function put(roots: SelNode[], rel: readonly string[], router: Added['reason'] | null): void {
  let level = roots;
  let node: SelNode | undefined;
  for (const name of rel) {
    node = level.find((n) => n.name === name);
    if (node === undefined) {
      node = { name, kids: [], router: null };
      level.push(node);
    }
    level = node.kids;
  }
  if (node !== undefined && router !== null) node.router = router;
}

/** A fetch's selection as nested names ("price { amount currency }"), relative to where it is folded in. */
export function selectionOf(plan: QueryPlan, f: Fetch): SelNode[] {
  const roots: SelNode[] = [];
  const base = f.kind === 'root' ? 0 : f.path.split('.').length;
  const add = (path: string, router: Added['reason'] | null): void => {
    if (f.kind !== 'root' && !path.startsWith(`${f.path}.`)) return;
    const rel = path.split('.').slice(base);
    if (rel.length > 0) put(roots, rel, router);
  };
  for (const p of f.paths) add(p, null);
  for (const a of plan.addedByRouter) if (a.fetch === f.id) add(a.path, a.reason);
  return roots;
}
