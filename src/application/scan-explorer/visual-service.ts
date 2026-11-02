import type { CurrentCorrespondence } from '@/domain/scan-explorer/current-connections';
import type { ExplorerNode, ExplorerPage, ExplorerService } from '@/domain/service-explorer';

import { visualBoundaries } from './visual-boundaries';
import { isVisualBoundary, visualBoundaryPage } from './visual-boundary';
import { visualFlow } from './visual-flow';
import { visualPage } from './visual-page';
import { visualSchema } from './visual-schema';
import type { VisualArtifact, VisualContext } from './visual-types';

const SCHEMA_INDEX = 'schemas:index';

export function visualOverview(context: VisualContext): ExplorerPage {
  const declaration = context.input.binding.declarations[0];
  const component: ExplorerNode = {
    id: context.input.binding.component.id,
    label: context.input.binding.component.label,
    detail: `Inferred purpose: ${context.purpose.statement}`,
    kind: 'component',
    sourceIds: declaration === undefined ? [] : [declaration.id],
    target: null,
  };
  const boundaries = visualBoundaries(context);
  const entries = [...new Set(context.entries.map((entry) => entry.kind))].map((kind) => ({
    id: `entries:${kind}`,
    label: `${kind} entries · ${String(context.entries.filter((entry) => entry.kind === kind).length)}`,
    detail: 'Open this declared entry index, or choose an exact entry in the selector',
    kind: 'entry' as const,
    sourceIds: context.entries
      .filter((entry) => entry.kind === kind)
      .flatMap((entry) => entry.sourceIds),
    target: context.files.get(`entries:${kind}`) ?? null,
  }));
  return visualPage(context, {
    kind: 'overview',
    title: context.input.binding.component.label,
    description: `Inferred · ${context.purpose.confidence} confidence. ${context.purpose.statement}`,
    nodes: [
      component,
      ...boundaries.nodes,
      ...entries,
      {
        id: SCHEMA_INDEX,
        label: 'Declared source schemas',
        detail:
          'Source DTO declarations; entry/transport association remains unresolved unless a native contract explicitly links it',
        kind: 'schema',
        sourceIds: [],
        target: context.files.get(SCHEMA_INDEX) ?? null,
      },
    ],
    links: [
      ...boundaries.links,
      ...entries.map((entry) => ({
        id: `exposes:${entry.id}`,
        from: component.id,
        to: entry.id,
        label: 'source-declared entry group',
        kind: 'interaction' as const,
        sourceIds: entry.sourceIds,
      })),
    ],
    fields: [],
    gaps: [...context.input.coverage, ...context.input.binding.limitations],
    completeSelection: false,
  });
}

export function visualCallers(
  context: VisualContext,
  matches: readonly CurrentCorrespondence[],
): ExplorerPage {
  const nodes = matches.map((match, index): ExplorerNode => ({
    id: `caller:${String(index)}`,
    label: `${match.status}: ${match.caller.method} ${match.caller.path ?? 'unresolved address'}`,
    detail: `${match.reasons.join('. ')} Caller (${match.caller.origin ?? 'scan/v1'}): ${match.caller.record}; current provider declaration: ${match.provider?.record ?? 'unresolved'}`,
    kind: 'component',
    sourceIds: [...match.caller.sourceIds, ...(match.provider?.sourceIds ?? [])],
    target:
      context.files.get(
        context.entries.find((entry) => entry.id === match.provider?.record)?.source ?? '',
      ) ?? null,
  }));
  return visualPage(context, {
    kind: 'callers',
    title: 'Callers',
    description:
      'Selected workspace source correspondences. Confirmed source addresses and labelled candidates are distinct; complete caller discovery is not established.',
    nodes,
    links: [],
    fields: [],
    gaps: [
      'Caller-built schemas and provider-declared schemas remain separate',
      ...matches.flatMap((match) => match.reasons),
      'No deployed version or payload compatibility guarantee',
    ],
    completeSelection: false,
  });
}

export function visualService(context: VisualContext): ExplorerService {
  return {
    id: context.input.binding.component.logicalId,
    name: context.input.binding.component.label,
    repo: context.input.binding.repo,
    commit: context.input.binding.commit,
    purpose: context.purpose,
    overview: context.files.get('overview') ?? 'overview.json',
    callers: context.files.get('callers') ?? 'callers.json',
    entries: context.entries.map((entry) => ({
      id: entry.id,
      label: entry.label,
      file: context.files.get(entry.source) ?? 'unexpanded.json',
    })),
  };
}

export function visualArtifacts(context: VisualContext): VisualArtifact[] {
  const schemas = context.input.records
    .filter((record) => record.kind === 'schema_binding' || record.kind === 'contract')
    .flatMap((record) => {
      const file = context.files.get(record.id);
      return file === undefined ? [] : [{ file, page: visualSchema(context, record) }];
    });
  const frames = [...context.files]
    .filter(([id]) => id.startsWith('source:'))
    .map(([source, file]) => ({
      file,
      page: visualFlow(
        context,
        source,
        context.entries.find((entry) => entry.source === source)?.label ??
          [...context.nodes.values()].find(
            (node) => node.source === source && node.nodeKind === 'function',
          )?.name ??
          context.input.sources
            .find((item) => item.id === source)
            ?.path.split('/')
            .at(-1) ??
          source,
      ),
    }));
  return [
    ...schemas,
    ...frames,
    ...visualEntryIndexes(context),
    visualSchemaIndex(context),
    ...context.input.records.filter(isVisualBoundary).flatMap((record) => {
      const file = context.files.get(record.id);
      return file === undefined ? [] : [{ file, page: visualBoundaryPage(context, record) }];
    }),
  ];
}

function visualEntryIndexes(context: VisualContext): VisualArtifact[] {
  return [...new Set(context.entries.map((entry) => entry.kind))].map((kind) => ({
    file: context.files.get(`entries:${kind}`) ?? 'missing.json',
    page: visualPage(context, {
      kind: 'overview',
      title: `${kind} entries`,
      description:
        'Declared source entries. Selected method frames and remaining unexpanded coverage are explicit.',
      nodes: context.entries
        .filter((entry) => entry.kind === kind)
        .map((entry) => ({
          id: entry.id,
          label: entry.label,
          detail: 'Declared source entry; open source implementation',
          kind: 'entry',
          sourceIds: entry.sourceIds,
          target: context.files.get(entry.source) ?? null,
        })),
      links: [],
      fields: [],
      gaps: ['Entry discovery is separate from semantic execution coverage'],
      completeSelection: false,
    }),
  }));
}

function visualSchemaIndex(context: VisualContext): VisualArtifact {
  const schemas = context.input.records.filter(
    (record) => record.kind === 'schema_binding' || record.kind === 'contract',
  );
  return {
    file: context.files.get(SCHEMA_INDEX) ?? 'schemas.json',
    page: visualPage(context, {
      kind: 'overview',
      title: 'Declared source schemas',
      description:
        'Source DTOs. Presence here does not establish an endpoint response, wire schema or stored representation.',
      nodes: schemas.map((schema) => ({
        id: schema.id,
        label: schema.kind === 'schema_binding' ? schema.typeName : schema.shape.spelling,
        detail:
          'Declared source schema; associations require a native route, storage or interaction binding',
        kind: 'schema',
        sourceIds: schema.kind === 'schema_binding' ? [schema.source] : schema.support,
        target: context.files.get(schema.id) ?? null,
      })),
      links: [],
      fields: [],
      gaps: [
        'Schemas without explicit entry/transport bindings retain unresolved association',
        'This index is bounded; all selected schema pages remain in the manifest for direct bounded retrieval',
      ],
      completeSelection: false,
    }),
  };
}
