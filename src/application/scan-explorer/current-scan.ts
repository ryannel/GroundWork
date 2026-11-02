import type {
  CurrentBounds,
  CurrentRecord,
  CurrentScanInput,
  CurrentView,
} from '@/domain/scan-explorer/current-contracts';

import { currentDataRecords } from './current-data';
import { currentPage } from './current-page';
import { currentSourceIds } from './current-source-ids';

function validate(input: CurrentScanInput): void {
  const { binding } = input;
  if (binding.declarations.length === 0) {
    throw new Error('Runtime binding needs a pinned runtime declaration');
  }
  if (
    !binding.declarations.every(
      (source) => source.repo === binding.repo && source.commit === binding.commit,
    )
  ) {
    throw new Error('Runtime declaration revision mismatch');
  }
  if (binding.modulePaths.some((path) => !path.endsWith('/') || path.includes('..'))) {
    throw new Error('Runtime module paths need directory boundaries');
  }
  if (binding.modulePaths.length === 0) {
    throw new Error('Runtime binding needs explicit module paths');
  }
}

function boundSources(input: CurrentScanInput): ReadonlySet<string> {
  return new Set(
    input.sources
      .filter(
        (source) =>
          source.repo === input.binding.repo &&
          source.commit === input.binding.commit &&
          input.binding.modulePaths.some((path) => source.path.startsWith(path)),
      )
      .map((source) => source.id),
  );
}

function view(
  input: CurrentScanInput,
  records: readonly CurrentRecord[],
  bounds: number | CurrentBounds,
): CurrentView {
  validate(input);
  return currentPage(input, records, typeof bounds === 'number' ? { limit: bounds } : bounds);
}

export function currentServiceOverview(
  input: CurrentScanInput,
  limit: number | CurrentBounds = 200,
): CurrentView {
  const bound = boundSources(input);
  return view(
    input,
    input.records.filter(
      (record) =>
        [
          'source_framework_binding',
          'route_binding',
          'aspnet_route_binding',
          'schema_binding',
          'security_binding',
          'contract',
          'mongo_collection_binding',
          'mongo_repository_binding',
          'outbound_binding',
          'consumer_binding',
          'schedule_binding',
          'configuration_binding',
          'event_binding',
          'async_binding',
        ].includes(record.kind) && currentSourceIds(record).some((id) => bound.has(id)),
    ),
    limit,
  );
}

/** Traverses native AST/control/value edges; detached same-owner nodes are not introduced. */
export function currentEntryFlow(
  input: CurrentScanInput,
  request: {
    readonly rootSourceIds: readonly string[];
    readonly limit: number;
    readonly offset?: number;
    readonly maxBytes?: number;
  },
): CurrentView {
  const bound = boundSources(input);
  const reached = new Set(request.rootSourceIds.filter((id) => bound.has(id)));
  const selected = new Set<string>();
  let changed = true;
  while (changed && selected.size <= 2000) {
    changed = false;
    for (const record of input.records) {
      if (selected.has(record.id) || !reachableBoundRecord(record, { reached, bound })) continue;
      selected.add(record.id);
      reached.add(record.id);
      for (const id of onward(record)) reached.add(id);
      changed = true;
    }
  }
  return view(
    input,
    input.records.filter((record) => selected.has(record.id)),
    request,
  );
}

function reachableBoundRecord(
  record: CurrentRecord,
  state: { readonly reached: ReadonlySet<string>; readonly bound: ReadonlySet<string> },
): boolean {
  return (
    currentSourceIds(record).some((id) => state.bound.has(id)) &&
    reachableRecord(record, state.reached)
  );
}

function reachableRecord(record: CurrentRecord, reached: ReadonlySet<string>): boolean {
  if (record.kind === 'semantic_edge') return reached.has(record.from);
  if (record.kind === 'java_value_binding') {
    return reached.has(record.from) || (record.call !== null && reached.has(record.call));
  }
  if (record.kind === 'java_call_binding') return reached.has(record.call);
  if (record.kind === 'csharp_symbol_binding') return reached.has(record.source);
  if (record.kind === 'semantic_node') return reached.has(record.source) || reached.has(record.id);
  return currentSourceIds(record).some((id) => reached.has(id));
}

function onward(record: CurrentRecord): readonly string[] {
  if (record.kind === 'semantic_edge') return [record.to];
  if (record.kind === 'java_call_binding') return record.target === null ? [] : [record.target];
  if (record.kind === 'java_value_binding') return [record.to];
  if (record.kind === 'csharp_symbol_binding') {
    return record.dispatch === 'exact' && record.target !== null ? [record.target] : [];
  }
  if (record.kind === 'semantic_node') return [record.source];
  return [];
}

export function currentDataInspection(
  input: CurrentScanInput,
  request: {
    readonly sourceIds: readonly string[];
    readonly limit: number;
    readonly offset?: number;
    readonly maxBytes?: number;
  },
): CurrentView {
  const bound = boundSources(input);
  const records = input.records.filter((record) =>
    currentSourceIds(record).some((id) => bound.has(id)),
  );
  return view(input, currentDataRecords(records, request.sourceIds), request);
}

/** Candidate implementations are inspected separately; registration conditions never become dispatch proof. */
export function currentImplementationCandidates(
  input: CurrentScanInput,
  request: CurrentBounds & {
    readonly sourceId: string;
  },
): CurrentView {
  const candidates = input.records.filter(
    (record) =>
      record.kind === 'csharp_symbol_binding' &&
      record.relation === 'implementation_candidate' &&
      record.source === request.sourceId,
  );
  return view(input, candidates, request);
}
