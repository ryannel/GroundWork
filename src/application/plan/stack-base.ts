import { applyOps } from '@/application/plan/apply-ops';
import { systemOf } from '@/application/plan/graph';
import { collectionsOf, fingerprintOf, type PlanBase } from '@/application/plan/plan-base';
import { rootId } from '@/domain/ids';
import type { OpKind, OpRecord, SystemSource } from '@/domain/plan/plan-graph';
import type { Plan } from '@/domain/plan/plan.generated';

// A stacked plan's today: the workspace's today with the changes of the plans it builds on applied, in dependency
// order. Each thing those plans added or changed remembers which plan did it, so a page can say "Added by …".

/** Which plan below this one added or changed a thing, so it reads as inherited rather than as today. */
export interface Provenance {
  readonly plan: string;
  readonly title: string;
  readonly kind: 'added' | 'modified';
}

/** What the plans a plan builds on added or changed, by id. Plain data, so it can travel to the browser. */
export type Inherited = Readonly<Record<string, Provenance>>;

export const NOTHING_INHERITED: Inherited = {};

/** One plan in the stack, read: its changes, and the things it lists itself rather than adding with an op. */
export interface StackLayer {
  readonly slug: string;
  readonly plan: Plan;
  readonly listed: ReadonlySet<string>;
}

/** Today with the stack applied, who did what, and the ops that no longer apply in that order. */
export interface Stacked {
  readonly system: SystemSource;
  readonly inherited: Inherited;
  readonly problems: readonly string[];
}

const idsIn = (system: SystemSource): Set<string> =>
  new Set(
    Object.values(collectionsOf(system))
      .flat()
      .flatMap((entity) => (typeof entity.id === 'string' ? [entity.id] : [])),
  );

/** The system with what a plan lists itself added, unless the system already has it. */
function withListed(system: SystemSource, layer: StackLayer): SystemSource {
  const present = idsIn(system);
  const only = <T extends { readonly id: string }>(list: readonly T[] | undefined): T[] =>
    (list ?? []).filter((entity) => layer.listed.has(entity.id) && !present.has(entity.id));
  const { plan } = layer;
  return {
    teams: [...system.teams, ...only(plan.teams)],
    systems: [...system.systems, ...only(plan.systems)],
    services: [...system.services, ...only(plan.services)],
    stores: [...system.stores, ...only(plan.stores)],
    schemas: [...system.schemas, ...only(plan.schemas)],
    interfaces: [...system.interfaces, ...only(plan.interfaces)],
    messages: [...system.messages, ...only(plan.messages)],
    flows: [...system.flows, ...only(plan.flows)],
    screens: [...system.screens, ...only(plan.screens)],
    interactions: [...system.interactions, ...only(plan.interactions)],
    user_journeys: [...system.user_journeys, ...only(plan.user_journeys)],
    graphs: [...system.graphs, ...only(plan.graphs)],
    subgraphs: [...system.subgraphs, ...only(plan.subgraphs)],
    operations: [...system.operations, ...only(plan.operations)],
    handlers: [...system.handlers, ...only(plan.handlers)],
  };
}

/** Who a thing is down to after an op: forgotten once removed; what a layer below added stays its own. */
function after(
  current: Provenance | undefined,
  kind: OpKind,
  by: Omit<Provenance, 'kind'>,
): Provenance | null {
  if (kind === 'remove') return null;
  if (kind === 'add') return { ...by, kind: 'added' };
  return current?.kind === 'added' ? current : { ...by, kind: 'modified' };
}

/** Who did what, once a layer's ops are applied. */
function noted(
  inherited: ReadonlyMap<string, Provenance>,
  by: Omit<Provenance, 'kind'>,
  records: readonly OpRecord[],
): Map<string, Provenance> {
  const next = new Map(inherited);
  for (const record of records) {
    const { kind } = record;
    for (const id of kind === null ? [] : record.ids) {
      const found = kind === null ? null : after(next.get(id), kind, by);
      if (found === null) next.delete(id);
      else next.set(id, found);
    }
  }
  return next;
}

/**
 * Today with each layer's changes applied in the order given (bases first). What a layer adds is "added" by it
 * for good; what it changes is "modified" by the last layer to change it, unless a layer below added it.
 */
export function stackOnto(today: Partial<SystemSource>, layers: readonly StackLayer[]): Stacked {
  let system = systemOf(today);
  let inherited = new Map<string, Provenance>();
  const problems: string[] = [];
  for (const layer of layers) {
    const by = { plan: layer.slug, title: layer.plan.meta.title };
    const before = idsIn(system);
    system = withListed(system, layer);
    for (const id of idsIn(system)) {
      if (!before.has(id)) inherited.set(id, { ...by, kind: 'added' });
    }
    const applied = applyOps(system, layer.plan.changes);
    problems.push(
      ...applied.records.flatMap((record) =>
        record.problems.map(
          (problem) => `${layer.slug}/${record.changeId ?? '?'}: ${problem.message}`,
        ),
      ),
    );
    inherited = noted(inherited, by, applied.records);
    system = applied.system;
  }
  return { system, inherited: Object.fromEntries(inherited), problems };
}

/** A stacked plan's base, read like today: live, never landed. */
export function stackedBase(stacked: Stacked): PlanBase {
  return { collections: collectionsOf(stacked.system), mode: 'live', landedOn: null };
}

const rootOf = (id: string): string => rootId(id);

/** A short hash of what the stack added and changed, as it stands in the composed base. */
export function composedHashOf(base: PlanBase, inherited: Inherited): string {
  const roots = new Set(Object.keys(inherited).map(rootOf));
  const entities = Object.values(base.collections)
    .flat()
    .filter((entity) => typeof entity.id === 'string' && roots.has(entity.id))
    .map((entity) => [String(entity.id), fingerprintOf(entity)] as const)
    .toSorted(([a], [b]) => a.localeCompare(b));
  return fingerprintOf(entities);
}
