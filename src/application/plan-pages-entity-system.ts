import type { Model } from '@/application/plan/derive';
import type { Edge } from '@/application/plan/derive-edges';

// What the inspector says about a system that no field on it says: the systems it leans on and that lean on it,
// what is inside it, and the flows it takes part in.

interface Group {
  readonly label: string;
  readonly ids: readonly string[];
}

/** How many parts or stores the inspector names before it says how many more there are. */
const NAMED = 6;

/** The `sys:` id each service and store belongs to: a service's system, a store's owner's. */
function systemsOf(model: Model): Map<string, string> {
  const of = new Map<string, string>();
  for (const s of model.plan.services) if (s.system !== undefined) of.set(s.id, s.system);
  for (const st of model.plan.stores ?? []) {
    const sys = of.get(st.owner);
    if (sys !== undefined) of.set(st.id, sys);
  }
  return of;
}

/** Who leans on whom along one edge: a caller on what it calls, a reader on its store, a consumer on its sender. */
const leaning = (e: Edge): readonly [string, string] =>
  e.kind === 'msg' ? [e.to, e.from] : [e.from, e.to];

function neighbours(model: Model, id: string, of: ReadonlyMap<string, string>) {
  const on = new Set<string>();
  const by = new Set<string>();
  for (const e of model.edges('asIs', 'all')) {
    const [a, b] = leaning(e).map((x) => of.get(x));
    if (a === undefined || b === undefined || a === b) continue;
    if (a === id) on.add(b);
    if (b === id) by.add(a);
  }
  return { on: [...on], by: [...by] };
}

const counted = (label: string, ids: readonly string[]): Group => ({
  label: ids.length > NAMED ? `${label} · ${String(NAMED)} of ${String(ids.length)}` : label,
  ids: ids.slice(0, NAMED),
});

/** A system's neighbours, parts, stores and flows, as labelled lists of ids; empty for anything else. */
export function systemGroups(model: Model, id: string): Group[] {
  if (!id.startsWith('sys:')) return [];
  const of = systemsOf(model);
  const { on, by } = neighbours(model, id, of);
  const parts = model.plan.services.filter((s) => s.system === id).map((s) => s.id);
  const mine = new Set(parts);
  const stores = (model.plan.stores ?? []).filter((s) => of.get(s.id) === id).map((s) => s.id);
  const flows = (model.plan.flows ?? [])
    .filter((f) => f.steps.some((s) => mine.has(s.from) || mine.has(s.to)))
    .map((f) => f.id);
  return [
    { label: 'Gets data from', ids: on },
    { label: 'Gives data to', ids: by },
    counted('Parts', parts),
    counted('Stores', stores),
    counted('Flows it takes part in', flows),
  ].filter((g) => g.ids.length > 0);
}
