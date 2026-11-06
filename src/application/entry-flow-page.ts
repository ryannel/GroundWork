import { parseId, tokenToId } from '@/domain/ids';
import type { ModelPlan, WorkspaceModel } from '@/domain/workspace-model';
import { firstParam, type SearchParams } from '@/shared/search-params';

import { entryFlowOf, type EntryFlowView } from './entry-flow';
import { entryFlowHref } from './entry-flow-paths';
import { indexOf, type ModelIndex } from './model-index';
import { plansIndex } from './plans-index';

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
function selectedIndex(
  model: WorkspaceModel,
  plan: ModelPlan | undefined,
  version: string,
): ModelIndex {
  if (plan === undefined) return indexOf(model);
  const overlay = plansIndex([plan], model).plans[0];
  if (overlay === undefined) throw new Error('Selected overlay is missing.');
  return version === 'after' ? overlay.afterIndex : overlay.beforeIndex;
}
function entryLinks(index: ModelIndex, domain: string | null): EntryFlowPage['entries'] {
  return index
    .entries()
    .filter((node) => domain === null || node.place.domain === domain)
    .map((node) => ({
      id: node.id,
      kind: node.kind,
      title: index.label(node.id),
      href: entryFlowHref(index.model.id, { entry: node.id }),
    }));
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
/** Address choices select one projection before it is sent to the page. */
export function entryFlowPageOf(
  model: WorkspaceModel,
  plans: readonly ModelPlan[],
  query: SearchParams,
): EntryFlowPage | null {
  const selected = plans.find((plan) => plan.meta.id === addressId(firstParam(query.plan)));
  if (firstParam(query.plan) !== '' && selected === undefined) return null;
  const version = firstParam(query.version) === 'after' ? 'after' : 'before';
  const index = selectedIndex(model, selected, version);
  const entry = addressId(firstParam(query.id));
  const flow = entry === null ? null : entryFlowOf(index, entry);
  if (firstParam(query.id) !== '' && flow === null) return null;
  const domain = addressId(firstParam(query.domain));
  return {
    workspace: {
      name: model.name,
      href: entryFlowHref(model.id),
      description: model.description ?? null,
    },
    flow,
    entries: flow === null ? entryLinks(index, domain) : [],
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
