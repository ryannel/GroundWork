import { queryKnowledge } from '@/application/knowledge/query-knowledge';
import type { QueryRequest, QueryResponse } from '@/domain/knowledge/knowledge.generated';
import type {
  Correspondence,
  ExplorerIndex,
  ExplorerPage,
  ExplorerRecord,
  PageRequest,
} from '@/domain/scan-explorer/contracts';
import { interactionCorrespondence } from '@/domain/scan-explorer/correspondence';

import { explorerPage } from './page';

interface ComponentRequest extends PageRequest {
  readonly component: string;
  readonly entry?: string;
}

function componentIds(index: ExplorerIndex, logicalId: string): ReadonlySet<string> {
  return new Set(
    index.components
      .filter(({ record }) => record.logicalId === logicalId || record.id === logicalId)
      .map(({ record }) => record.id),
  );
}

export function callers(
  index: ExplorerIndex,
  request: ComponentRequest,
): ExplorerPage<Correspondence> {
  const targets = componentIds(index, request.component);
  const matches = index.interactions.flatMap((interaction) =>
    interactionCorrespondence(index, interaction),
  );
  const filtered = matches.filter((match) => {
    const provider = match.providerContract?.record.component;
    const target = match.interaction.record.target;
    const knownProvider = provider !== undefined && provider !== null;
    const relevant =
      (knownProvider && targets.has(provider)) || (target !== null && targets.has(target));
    return (
      relevant && (request.entry === undefined || match.provider?.record.entry === request.entry)
    );
  });
  return explorerPage(index, filtered, {
    request,
    references: (match) => [
      { snapshot: match.interaction.snapshot, id: match.interaction.record.id },
      ...(match.provider === null
        ? []
        : [{ snapshot: match.provider.snapshot, id: match.provider.record.id }]),
      ...(match.callerContract === null
        ? []
        : [{ snapshot: match.callerContract.snapshot, id: match.callerContract.record.id }]),
      ...(match.providerContract === null
        ? []
        : [{ snapshot: match.providerContract.snapshot, id: match.providerContract.record.id }]),
    ],
  });
}

export function serviceOverview(
  index: ExplorerIndex,
  request: ComponentRequest,
): ExplorerPage<ExplorerRecord> {
  const targets = componentIds(index, request.component);
  const items = index.selections.flatMap(({ reader }) => {
    const components = reader
      .select('kind', 'runtime_component')
      .filter((record) => targets.has(record.id));
    const associated = [...targets].flatMap((id) => reader.select('component', id));
    const executions = associated.filter((record) => record.kind === 'execution_binding');
    const executionIds = new Set(executions.map((record) => record.id));
    const entries = reader
      .select('kind', 'entry_binding')
      .filter((record) => record.kind === 'entry_binding' && executionIds.has(record.execution));
    const outbound = reader
      .select('kind', 'interaction')
      .filter((record) => record.kind === 'interaction' && executionIds.has(record.execution));
    return [
      ...new Map(
        [...components, ...associated, ...entries, ...outbound].map((record) => [
          record.id,
          { snapshot: reader.snapshot, record },
        ]),
      ).values(),
    ];
  });
  return explorerPage(index, items, {
    request,
    references: (item) => [{ snapshot: item.snapshot, id: item.record.id }],
  });
}

export function dataInspection(
  index: ExplorerIndex,
  request: PageRequest & { readonly snapshot: string; readonly ids: readonly string[] },
): ExplorerPage<ExplorerRecord> {
  const reader = index.selections.find(
    (selection) => selection.reader.snapshot === request.snapshot,
  )?.reader;
  if (reader === undefined) throw new Error('Unknown explorer snapshot');
  if (request.ids.length > 2000) throw new Error('Data inspection selection exceeds 2000 records');
  const items = [...new Set(request.ids)].map((id) => {
    const record = reader.get(id);
    if (record === undefined) throw new Error(`Unknown explorer record ${id}`);
    return { snapshot: reader.snapshot, record };
  });
  return explorerPage(index, items, {
    request,
    references: (item) => [{ snapshot: item.snapshot, id: item.record.id }],
  });
}

/** Native traversal owns branch, failure, invocation and asynchronous continuation semantics. */
export function entryFlow(index: ExplorerIndex, request: QueryRequest): QueryResponse {
  const reader = index.selections.find(
    (selection) => selection.reader.snapshot === request.snapshot,
  )?.reader;
  if (reader === undefined) throw new Error('Unknown explorer snapshot');
  return queryKnowledge(reader, request);
}
