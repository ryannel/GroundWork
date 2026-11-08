import { parseId, tokenToId } from '@/domain/ids';
import type { ModelPlan, WorkspaceModel } from '@/domain/workspace-model';
import { firstParam, type SearchParams } from '@/shared/search-params';

import { entryFlowOf, type EntryFlowContext, type EntryFlowView } from './entry-flow';
import { entryFlowHref } from './entry-flow-paths';
import { modelSystemEntriesOf } from './model-catalogue';
import { indexOf, type ModelIndex } from './model-index';
import { selectedPlanProjection, type IndexedPlan } from './plans-index';

interface FlowLink {
  readonly title: string;
  readonly href: string;
}
export interface EntryFlowPage {
  readonly workspace: {
    readonly name: string;
    readonly href: string;
    readonly description: string | null;
  };
  readonly flow: EntryFlowView | null;
  readonly entries: readonly (FlowLink & { readonly id: string; readonly kind: string })[];
  readonly pagination: {
    readonly page: number;
    readonly pages: number;
    readonly total: number;
    readonly previous: string | null;
    readonly next: string | null;
  } | null;
  readonly plans: readonly FlowLink[];
  readonly comparison: {
    readonly title: string;
    readonly version: 'before' | 'after';
    readonly before: string;
    readonly after: string;
  } | null;
}
function addressId(value: string): string | null {
  return parseId(value) === null ? tokenToId(value) : value;
}
interface EntryScope {
  readonly domain: string | null;
  readonly system: string | null;
}
function entryScope(index: ModelIndex, query: SearchParams): EntryScope | null {
  const domain = addressId(firstParam(query.domain));
  const requested = firstParam(query.system);
  if (requested === '') return { domain, system: null };
  const id = addressId(requested);
  const system = id === null ? null : index.get(id);
  return system?.kind === 'system' ? { domain, system: system.id } : null;
}
function workspaceOf(
  model: Pick<WorkspaceModel, 'id' | 'name' | 'description'>,
  scope: EntryScope,
  context: EntryFlowContext,
): EntryFlowPage['workspace'] {
  return {
    name: model.name,
    href: entryFlowHref(
      model.id,
      scope.system === null
        ? {}
        : {
            ...context,
            system: scope.system,
            ...(scope.domain === null ? {} : { domain: scope.domain }),
          },
    ),
    description: model.description ?? null,
  };
}
interface FlowPlanSelection {
  readonly projection: IndexedPlan;
  readonly slug: string;
}
function flowContext(
  selected: ModelPlan | undefined,
  version: 'before' | 'after',
  selection: FlowPlanSelection | undefined,
): EntryFlowContext {
  if (selected === undefined) return {};
  const plan = selected.meta.id;
  return selection === undefined ? { plan, version } : { plan, version, planSlug: selection.slug };
}
function selectedIndex(
  current: ModelIndex,
  plan: ModelPlan | undefined,
  plans: readonly ModelPlan[],
  version: string,
  selection?: FlowPlanSelection,
): ModelIndex {
  if (plan === undefined) return current;
  const overlay =
    selection?.projection ?? selectedPlanProjection(plan, plans, current.model, current);
  return version === 'after' ? overlay.afterIndex : overlay.beforeIndex;
}
const ENTRIES_PER_PAGE = 30;

function entryList(
  index: ModelIndex,
  domain: string | null,
  system: string | null,
  requested: number,
  context: EntryFlowContext,
): Pick<EntryFlowPage, 'entries' | 'pagination'> {
  const scoped = system === null ? index.entries() : modelSystemEntriesOf(index, system);
  const found = scoped.filter((node) => domain === null || node.place.domain === domain);
  const pages = Math.max(1, Math.ceil(found.length / ENTRIES_PER_PAGE));
  const page = Math.min(Number.isSafeInteger(requested) && requested > 0 ? requested : 1, pages);
  const href = (number: number): string =>
    entryFlowHref(index.model.id, {
      ...context,
      ...(domain === null ? {} : { domain }),
      ...(system === null ? {} : { system }),
      page: number,
    });
  const entries = found
    .slice((page - 1) * ENTRIES_PER_PAGE, page * ENTRIES_PER_PAGE)
    .map((node) => ({
      id: node.id,
      kind: node.kind,
      title: index.label(node.id),
      href: entryFlowHref(index.model.id, {
        ...context,
        entry: node.id,
        ...(system === null ? {} : { system }),
      }),
    }));
  return {
    entries,
    pagination: {
      page,
      pages,
      total: found.length,
      previous: page > 1 ? href(page - 1) : null,
      next: page < pages ? href(page + 1) : null,
    },
  };
}
function comparisonOf(
  workspace: string,
  selected: ModelPlan | undefined,
  entry: string | null,
  version: 'before' | 'after',
): EntryFlowPage['comparison'] {
  if (selected === undefined) return null;
  const address = { ...(entry === null ? {} : { entry }), plan: selected.meta.id };
  return {
    title: selected.meta.title,
    version,
    before: entryFlowHref(workspace, { ...address, version: 'before' }),
    after: entryFlowHref(workspace, { ...address, version: 'after' }),
  };
}
/** Plan addresses carry the immutable identity, independently of their actual folder slug. */
export function entryFlowPlanId(query: SearchParams): string | null {
  return addressId(firstParam(query.plan));
}

/** Address choices select one projection before it is sent to the page. */
export function entryFlowPageOf(
  model: WorkspaceModel,
  plans: readonly ModelPlan[],
  query: SearchParams,
  current: ModelIndex = indexOf(model),
  selection?: FlowPlanSelection,
): EntryFlowPage | null {
  const selected = plans.find((plan) => plan.meta.id === entryFlowPlanId(query));
  if (firstParam(query.plan) !== '' && selected === undefined) return null;
  const version = firstParam(query.version) === 'after' ? 'after' : 'before';
  const index = selectedIndex(current, selected, plans, version, selection);
  const entry = addressId(firstParam(query.id));
  const context = flowContext(selected, version, selection);
  const flow = entry === null ? null : entryFlowOf(index, entry, context);
  if (firstParam(query.id) !== '' && flow === null) return null;
  const scope = entryScope(index, query);
  if (scope === null) return null;
  return {
    workspace: workspaceOf(index.model, scope, context),
    flow,
    ...(flow === null
      ? entryList(index, scope.domain, scope.system, Number(firstParam(query.page)), context)
      : { entries: [], pagination: null }),
    plans:
      flow === null
        ? []
        : plans.map((plan) => ({
            title: plan.meta.title,
            href: entryFlowHref(model.id, { entry: flow.id, plan: plan.meta.id, version: 'after' }),
          })),
    comparison: comparisonOf(model.id, selected, entry, version),
  };
}
