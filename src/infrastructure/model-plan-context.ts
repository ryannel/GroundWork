import 'server-only';

import type { ModelIndex } from '@/application/model-index';
import { plansIndex, selectedPlanProjection, type IndexedPlan } from '@/application/plans-index';
import type { ModelPlan } from '@/domain/workspace-model';

import { readCanonicalModelIndex } from './model-index';
import { readModelPlanBase, readModelPlanBaseMarkers } from './model-plan-base';
import {
  readModelPlanEntries,
  readModelPlanEntry,
  readModelPlanRevisions,
  type ModelPlanEntry,
} from './model-plans';
import { readProgress, type ProgressRead } from './progress-store';

const contexts = new WeakMap<ModelIndex, WeakMap<ModelPlan, IndexedPlan>>();

interface ProjectionBasis {
  readonly current: ModelIndex;
  readonly landed?: ReadonlySet<string>;
  readonly frozen?: boolean;
}
function project(
  selected: ModelPlan,
  entries: readonly ModelPlanEntry[],
  { current, landed, frozen }: ProjectionBasis,
): IndexedPlan {
  const plans = entries.map((entry) =>
    entry.plan.meta.id === selected.meta.id ? selected : entry.plan,
  );
  const context =
    frozen === true
      ? plansIndex([selected], current.model, current).plans[0]
      : selectedPlanProjection(selected, plans, current.model, current, landed);
  if (context === undefined) throw new Error('Missing frozen plan projection.');
  return context;
}
function contextOf(
  selected: ModelPlan,
  entries: readonly ModelPlanEntry[],
  basis: ProjectionBasis,
  retain: boolean,
): IndexedPlan {
  if (!retain) return project(selected, entries, basis);
  const kept = contexts.get(basis.current) ?? new WeakMap<ModelPlan, IndexedPlan>();
  contexts.set(basis.current, kept);
  const known = kept.get(selected);
  if (known !== undefined) return known;
  const context = project(selected, entries, basis);
  kept.set(selected, context);
  return context;
}

async function selectedContext(
  id: string,
  entry: ModelPlanEntry,
  entries: readonly ModelPlanEntry[],
  current: ModelIndex,
  options: { readonly root: string | undefined; readonly retain: boolean },
): Promise<IndexedPlan> {
  const frozen = await readModelPlanBase(id, entry.slug, options.root);
  if (frozen !== null) {
    return contextOf(entry.plan, entries, { current: frozen.index, frozen: true }, options.retain);
  }
  const markers = await readModelPlanBaseMarkers(id, options.root);
  return contextOf(
    entry.plan,
    entries,
    { current, landed: new Set(markers.keys()) },
    options.retain,
  );
}

/** Resolve a native plan by its real folder and compose only its explicit ancestors. */
export async function readSelectedPlanContext(
  id: string,
  slug: string,
  root?: string,
  currentIndex?: ModelIndex,
  options: { readonly retain?: boolean } = {},
): Promise<IndexedPlan | null> {
  const current = currentIndex ?? (await readCanonicalModelIndex(id, root));
  if (current === null) return null;
  const entries = await readModelPlanEntries(id, root);
  const selected = entries.find((entry) => entry.slug === slug);
  if (selected === undefined) return null;
  return selectedContext(id, selected, entries, current, { root, retain: options.retain ?? true });
}

/** An open plan revision uses that snapshot's own ancestors over the current model. */
export async function readSelectedRevisionContext(
  id: string,
  slug: string,
  version: string,
  root?: string,
  options: { readonly currentIndex?: ModelIndex; readonly retain?: boolean } = {},
): Promise<IndexedPlan | null> {
  const current = options.currentIndex ?? (await readCanonicalModelIndex(id, root));
  if (current === null) return null;
  const entries = await readModelPlanEntries(id, root);
  const selected = entries.find((entry) => entry.slug === slug);
  if (selected === undefined) return null;
  const snapshots = await readModelPlanRevisions(id, slug, root);
  const snapshot = snapshots.find((entry) => entry.version === version);
  if (snapshot === undefined) return null;
  return selectedContext(id, { slug: selected.slug, plan: snapshot.plan }, entries, current, {
    root,
    retain: options.retain ?? true,
  });
}

/** Progress retains its independent, unchanged metadata schema and all read errors. */
export async function readModelPlanProgress(
  id: string,
  slug: string,
  root?: string,
): Promise<ProgressRead | null> {
  const current = await readCanonicalModelIndex(id, root);
  if (current === null) return null;
  const selected = await readModelPlanEntry(id, slug, root);
  return selected === null ? null : readProgress(id, selected.slug, root);
}
