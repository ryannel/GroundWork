import type { ModelIndex } from '@/application/model-index';
import { inheritedPlanOrder } from '@/application/plans-index';
import { appendChild, isQualifiedId, kindOf, rootId } from '@/domain/ids';
import type { ModelOp } from '@/domain/plan-apply';
import {
  modelList,
  modelRecord,
  modelText,
  type ModelGap,
  type ModelPlan,
} from '@/domain/workspace-model';

export interface ModelPlanDomains {
  readonly domains: readonly string[];
  readonly gaps: readonly ModelGap[];
}
export interface ModelPlanFootprint extends ModelPlanDomains {
  readonly systems: readonly string[];
}
interface Added {
  readonly id: string;
  readonly parent: string | null;
  readonly kind: string | null;
}
const CHILDREN: Readonly<Record<string, readonly string[]>> = {
  domain: ['systems'],
  system: [
    'components',
    'interfaces',
    'messages',
    'subscriptions',
    'jobs',
    'interactions',
    'operations',
    'schemas',
    'screens',
    'handlers',
    'relationships',
  ],
  interface: ['entries'],
  graph: ['subgraphs'],
};
function targetOf(op: ModelOp): string {
  if ('add' in op) {
    return isQualifiedId(op.value.id) ? op.value.id : appendChild(op.into ?? '', op.value.id);
  }
  if ('modify' in op) return op.modify;
  return 'remove' in op ? op.remove : op.deprecate;
}
function additionOf(
  value: unknown,
  parent: string | null,
  index: ModelIndex,
  forced?: string,
  identity?: string,
): Added | null {
  const declared = identity ?? modelText(modelRecord(value)?.id);
  if (declared === null) return null;
  const id = index.get(declared)?.id ?? declared;
  return { id, parent, kind: kindOf(id) ?? forced ?? null };
}
function additionsOf(plans: readonly ModelPlan[], index: ModelIndex): ReadonlyMap<string, Added> {
  const added = new Map<string, Added>();
  const register = (
    value: unknown,
    parent: string | null,
    forced?: string,
    identity?: string,
  ): void => {
    const node = additionOf(value, parent, index, forced, identity);
    if (node === null) return;
    const previous = added.get(node.id);
    if (previous !== undefined && previous.parent !== parent) {
      throw new Error(`Conflicting added placement: ${node.id}.`);
    }
    added.set(node.id, node);
    for (const key of CHILDREN[node.kind ?? ''] ?? []) {
      for (const child of modelList(modelRecord(value)?.[key])) register(child, node.id);
    }
  };
  const operations = plans.flatMap((plan) => plan.changes.flatMap((change) => change.ops ?? []));
  for (const op of operations) {
    if ('add' in op) {
      register(
        op.value,
        op.into === undefined ? index.model.id : (index.get(op.into)?.id ?? op.into),
        op.add,
        targetOf(op),
      );
    }
  }
  return added;
}
interface Placement {
  readonly domain: string | null;
  readonly system: string | null;
  readonly known: boolean;
}
function placementOf(
  id: string,
  index: ModelIndex,
  added: ReadonlyMap<string, Added>,
  open: ReadonlySet<string> = new Set(),
): Placement {
  const current = index.get(id);
  if (current !== null) {
    return { domain: current.place.domain, system: current.place.system, known: true };
  }
  if (open.has(id)) return { domain: null, system: null, known: false };
  const declared = added.get(id);
  if (declared !== undefined) {
    if (declared.kind === 'domain') return { domain: declared.id, system: null, known: true };
    if (declared.parent === null) return { domain: null, system: null, known: true };
    const parent = placementOf(declared.parent, index, added, new Set([...open, id]));
    return declared.kind === 'system' ? { ...parent, system: declared.id } : parent;
  }
  const root = rootId(id);
  return root === id
    ? { domain: null, system: null, known: false }
    : placementOf(root, index, added, new Set([...open, id]));
}
function workDomainsOf(plan: ModelPlan, index: ModelIndex): ModelPlanFootprint {
  const repos = new Set((plan.work_items ?? []).flatMap((item) => item.repo ?? []));
  const placed = index.entities
    .filter((node) => node.kind === 'system')
    .flatMap((node) =>
      index
        .codeHomes(node.id)
        .filter((home) => repos.has(home.repo))
        .map((home) => ({ repo: home.repo, domain: node.place.domain, system: node.id })),
    );
  const known = new Set(placed.map((home) => home.repo));
  return {
    domains: [...new Set(placed.flatMap((home) => home.domain ?? []))],
    systems: [...new Set(placed.map((home) => home.system))],
    gaps: [...repos]
      .filter((repo) => !known.has(repo))
      .map((repo) => ({
        id: plan.meta.id,
        kind: 'unknown_work_repository',
        reference: repo,
        message: `The work repository ${repo} has no recorded system code home.`,
      })),
  };
}
/** Resolve only declared structural parents and real code homes; no plan application or ownership fallback. */
export function modelPlanFootprintOf(
  plan: ModelPlan,
  allPlans: readonly ModelPlan[],
  currentIndex: ModelIndex,
): ModelPlanFootprint {
  const registry = new Map(allPlans.map((candidate) => [candidate.meta.id, candidate]));
  if (registry.size !== allPlans.length) throw new Error('Duplicate plan identity.');
  registry.set(plan.meta.id, plan);
  const added = additionsOf([...inheritedPlanOrder(plan, registry), plan], currentIndex);
  const domains = new Set<string>();
  const systems = new Set<string>();
  const gaps: ModelGap[] = [];
  const targets = new Set(plan.changes.flatMap((change) => (change.ops ?? []).map(targetOf)));
  for (const target of targets) {
    const placement = placementOf(target, currentIndex, added);
    if (placement.domain !== null) domains.add(placement.domain);
    if (placement.system !== null) systems.add(placement.system);
    if (!placement.known) {
      gaps.push({
        id: plan.meta.id,
        kind: 'unknown_plan_placement',
        reference: target,
        message: `The changed target ${target} has no declared domain placement.`,
      });
    }
  }
  const work = workDomainsOf(plan, currentIndex);
  for (const domain of work.domains) domains.add(domain);
  for (const system of work.systems) systems.add(system);
  gaps.push(...work.gaps);
  const order = [
    ...currentIndex.model.domains.map((domain) => domain.id),
    ...[...added.values()].filter((node) => node.kind === 'domain').map((node) => node.id),
  ];
  const systemOrder = [
    ...currentIndex.entities.filter((node) => node.kind === 'system').map((node) => node.id),
    ...[...added.values()].filter((node) => node.kind === 'system').map((node) => node.id),
  ];
  return {
    domains: [...new Set(order)].filter((id) => domains.has(id)),
    systems: [...new Set(systemOrder)].filter((id) => systems.has(id)),
    gaps,
  };
}

/** Domain-only callers retain the existing bounded shape. */
export function modelPlanDomainsOf(
  plan: ModelPlan,
  allPlans: readonly ModelPlan[],
  currentIndex: ModelIndex,
): ModelPlanDomains {
  const { domains, gaps } = modelPlanFootprintOf(plan, allPlans, currentIndex);
  return { domains, gaps };
}
