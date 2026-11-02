import 'server-only';

import { springEntryCatalogue } from './spring-entry-catalogue';
import { entryPlannerContext, type EntryPlannerContext } from './spring-entry-context';
import { entryWalkState } from './spring-entry-state';
import type {
  EntryCatalogueInput,
  EntryQueryLimits,
  SpringEntry,
  SpringEntryCatalogue,
  SpringEntryQueryPlan,
} from './spring-entry-types';
import { walkEntryOwner } from './spring-entry-walk';

const DEFAULT_LIMITS: EntryQueryLimits = {
  maxOwners: 32,
  maxCalls: 256,
  maxFields: 64,
  maxDepth: 8,
  maxSyntaxNodes: 4096,
  maxFrontiers: 64,
};
interface Planner {
  readonly catalogue: SpringEntryCatalogue;
  readonly source_locations: readonly { readonly source_id: string; readonly path: string }[];
  readonly plan: (entryId: string, limits?: Partial<EntryQueryLimits>) => SpringEntryQueryPlan;
}

function queryPlan(
  context: EntryPlannerContext,
  entry: SpringEntry,
  limits: EntryQueryLimits,
): SpringEntryQueryPlan {
  const state = entryWalkState();
  state.enqueue(entry.executable_source_id ?? entry.declaration_source_id, 0);
  if (entry.executable_source_id === null) {
    state.addFrontier({
      kind: 'missing_declaration',
      source_id: entry.declaration_source_id,
      binding_id: entry.binding_id,
      reason: 'No exact executable implementation is bound to this entry declaration.',
    });
  }
  while (state.hasPending()) {
    const pending = state.next();
    if (pending) walkEntryOwner(context, state, { ...pending, limits });
  }
  return {
    entry_id: entry.id,
    root_source_ids: entry.root_source_ids,
    owner_source_ids: [...state.owners],
    field_source_ids: [...state.fields],
    call_binding_ids: [...state.calls],
    boundary_binding_ids: [
      ...new Set(
        [...state.selectedSources].flatMap((source) => context.boundaries.get(source) ?? []),
      ),
    ],
    frontiers: state.frontiers.slice(0, limits.maxFrontiers),
    omitted_frontiers: Math.max(0, state.frontiers.length - limits.maxFrontiers),
    limits,
    selected_syntax_nodes: state.nodeCount(),
    completeness: 'partial',
    execution: 'source_reachability_runtime_unverified',
  };
}

function queryLimits(input: Partial<EntryQueryLimits>): EntryQueryLimits {
  const limits = { ...DEFAULT_LIMITS, ...input };
  if (Object.values(limits).some((value) => !Number.isInteger(value) || value < 0)) {
    throw new Error('Entry query budgets must be non-negative integers.');
  }
  return limits;
}

/** Index once, then select bounded native query roots by exact entry identity without rebuilding source graphs. */
export function createSpringEntryPlanner(input: EntryCatalogueInput): Planner {
  const catalogue = springEntryCatalogue(input);
  const context = entryPlannerContext(input, catalogue.boundaries);
  return {
    catalogue,
    source_locations: [...new Set([...context.methods.keys(), ...context.fields])].flatMap(
      (source) => {
        const syntax = context.syntax.get(source);
        return syntax === undefined ? [] : [{ source_id: source, path: syntax.index.path }];
      },
    ),
    plan(entryId, limits = {}) {
      const entry = catalogue.entries.find((candidate) => candidate.id === entryId);
      if (!entry) throw new Error(`Unknown source entry ${entryId}`);
      return queryPlan(context, entry, queryLimits(limits));
    },
  };
}
