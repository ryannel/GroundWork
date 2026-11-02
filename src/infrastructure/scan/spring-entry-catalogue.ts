import 'server-only';

import type {
  EntryBoundary,
  EntryCatalogueInput,
  SpringEntry,
  SpringEntryCatalogue,
} from './spring-entry-types';

const STORAGE = new Set([
  'mongo_collection_binding',
  'mongo_repository_binding',
  'mongo_operation_binding',
]);
const OUTBOUND = new Set(['outbound_binding', 'graphql_binding', 'library_binding']);

function entryDeclarations(input: EntryCatalogueInput): readonly SpringEntry[] {
  const routes: SpringEntry[] = input.routes.map((route) => ({
    id: `entry:${route.id}`,
    kind: 'rest',
    binding_id: route.id,
    declaration_source_id: route.method.declaration_source_id,
    executable_source_id: route.method.implementation_source_id ?? null,
    root_source_ids: [
      ...new Set([
        route.method.declaration_source_id,
        ...(route.method.implementation_source_id === undefined
          ? []
          : [route.method.implementation_source_id]),
      ]),
    ],
    completeness: 'partial',
  }));
  return [
    ...routes,
    ...input.bindings.flatMap((binding): readonly SpringEntry[] => {
      if (
        (binding.kind !== 'consumer_binding' && binding.kind !== 'schedule_binding') ||
        binding.source === undefined
      ) {
        return [];
      }
      return [
        {
          id: `entry:${binding.id}`,
          kind: binding.kind === 'consumer_binding' ? 'kafka_consumer' : 'schedule',
          binding_id: binding.id,
          declaration_source_id: binding.source,
          executable_source_id: binding.source,
          root_source_ids: [binding.source],
          completeness: 'partial',
        },
      ];
    }),
  ];
}

function boundaries(input: EntryCatalogueInput): readonly EntryBoundary[] {
  return input.bindings.flatMap((binding): readonly EntryBoundary[] => {
    if (
      binding.source === undefined ||
      (!STORAGE.has(binding.kind) && !OUTBOUND.has(binding.kind))
    ) {
      return [];
    }
    return [
      {
        binding_id: binding.id,
        kind: STORAGE.has(binding.kind) ? 'storage' : 'outbound',
        binding_kind: binding.kind,
        source_id: binding.source,
        owner_source_id: binding.owner_source ?? null,
      },
    ];
  });
}

/** Inventory source declarations from shared framework bindings; no entry establishes actor intent or activation. */
export function springEntryCatalogue(input: EntryCatalogueInput): SpringEntryCatalogue {
  return {
    entries: entryDeclarations(input).toSorted((left, right) => left.id.localeCompare(right.id)),
    boundaries: boundaries(input).toSorted((left, right) =>
      left.binding_id.localeCompare(right.binding_id),
    ),
    quarantined_paths: input.indexes
      .filter((index) => index.diagnostics.length > 0)
      .map((index) => index.path),
    completeness: 'partial',
    gaps: [
      'Only selected source-declared REST routes, Kafka consumers and schedules are inventoried; inherited, composed, dynamically registered and external declarations may remain unresolved.',
      'Boundary bindings account for source candidates; an entry catalogue does not establish complete behaviour, effective activation, actor intent, delivery or durable effects.',
      'Quarantined files cannot establish entries or absence; on-demand query plans expose unresolved calls and explicit resource budgets.',
    ],
  };
}
