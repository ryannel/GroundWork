import { buildId, hasPrefix } from '@/domain/ids';
import type { LandscapeFlowConnection, LandscapeValueFlow } from '@/domain/landscape';
import { modelText, type ModelData, type ModelGap } from '@/domain/workspace-model';

import { modelAreaBoundaryOf, modelAreaComponentOf } from './model-area-facts';
import type { ModelEdge, ModelIndex } from './model-index';
import type {
  AreaBoundaryView,
  AreaSystemView,
  AreaTechnicalRelationship,
  AreaView,
} from './workspace-area';
import { workspaceHref } from './workspace-paths';

function connectionOf(value: ModelData<'LandscapeConnection'>): LandscapeFlowConnection {
  return { ...value, evidence: value.backs ?? [] };
}
function valueFlowOf(
  value: ModelData<'LandscapeValueFlow'> | undefined,
): LandscapeValueFlow | undefined {
  if (value === undefined) return undefined;
  const { connections, overview, summaries, ...metadata } = value;
  return {
    ...metadata,
    connections: connections.map(connectionOf),
    ...(overview === undefined ? {} : { overview: overview.map(connectionOf) }),
    ...(summaries === undefined ? {} : { summaries: summaries.map(connectionOf) }),
  };
}
function flowIds(value: LandscapeValueFlow | undefined): readonly string[] {
  if (value === undefined) return [];
  return [
    ...value.bands.flatMap((band) => band.nodes.map((node) => node.component)),
    ...[...value.connections, ...(value.overview ?? []), ...(value.summaries ?? [])].flatMap(
      (edge) => [edge.from, edge.to],
    ),
  ];
}
function systemOf(index: ModelIndex, id: string): AreaSystemView | null {
  const node = index.get(id);
  if (node?.kind !== 'system') return null;
  const declared = index.model.domains
    .flatMap((domain) => domain.systems)
    .find((system) => system.id === node.id);
  if (declared === undefined) return null;
  return {
    id: node.id,
    name: index.label(node.id),
    purpose: modelText(node.data.purpose) ?? 'Purpose not recorded.',
    href: index.href(node.id),
    components: declared.components.flatMap((component) => {
      const actual = index.get(component.id);
      return actual === null ? [] : [modelAreaComponentOf(index, actual)];
    }),
    resources: declared.components
      .filter((component) => component.kind === 'store' || component.kind === 'topic')
      .map((component) => component.id),
    ...(declared.narratives === null
      ? {}
      : {
          narratives: {
            basis: declared.narratives.basis,
            notice:
              'Saved interpretation; freshness has not been checked against the native model.',
            stories: declared.narratives.stories.map((story) => {
              const { connections, stages, ...metadata } = story;
              return {
                ...metadata,
                stages: stages.map((stage) => ({ ...stage, evidence: stage.backs ?? [] })),
                ...(connections === undefined
                  ? {}
                  : { connections: connections.map(connectionOf) }),
              };
            }),
          },
        }),
  };
}
function kindOf(edge: ModelEdge): 'api' | 'message' | 'data' {
  if (edge.kind === 'call') return 'api';
  return edge.kind === 'read' || edge.kind === 'write' ? 'data' : 'message';
}
function evidenceOf(
  index: ModelIndex,
  edge: ModelEdge,
): Pick<
  AreaTechnicalRelationship,
  'label' | 'detail' | 'evidenceIds' | 'evidenced' | 'native' | 'nativeSource' | 'evidence'
> {
  const source = index.get(edge.site)?.data;
  const words = {
    call: 'Calls',
    read: 'Reads',
    write: 'Writes',
    publish: 'Publishes',
    consume: 'Consumes',
    causes: 'Starts later work',
  };
  const qualification =
    edge.source === 'operation'
      ? 'Possible GraphQL reach from the cited document and composition; not an observed runtime query plan.'
      : 'Recorded declaration and retained source context; deployment and delivery are not established.';
  return {
    label: modelText(source?.says) ?? `${words[edge.kind]} ${index.label(edge.via)}`,
    detail:
      `${index.label(edge.from)} → ${index.label(edge.to)}. ${modelText(source?.reason) ?? ''} ${qualification}`.trim(),
    evidenceIds: [edge.site],
    evidenced: edge.cites.length > 0,
    native: edge,
    ...(source === undefined ? {} : { nativeSource: source }),
    evidence: edge.source === 'handler' ? 'handler' : 'declared',
  };
}
function topicOf(edge: ModelEdge): Pick<AreaTechnicalRelationship, 'topicId'> {
  if (edge.kind === 'publish') return { topicId: edge.to };
  if (edge.kind === 'consume') return { topicId: edge.from };
  return {};
}
function relationshipOf(index: ModelIndex, edge: ModelEdge): AreaTechnicalRelationship {
  return {
    id: `recorded:${edge.kind}|${edge.from}|${edge.to}|${edge.site}|${edge.via}`,
    from: edge.from,
    to: edge.to,
    fromSystem: index.place(edge.from)?.system ?? edge.from,
    toSystem: index.place(edge.to)?.system ?? edge.to,
    via: edge.via,
    kind: kindOf(edge),
    ...evidenceOf(index, edge),
    ...topicOf(edge),
    endpointId: index.get(edge.via)?.kind === 'endpoint' ? edge.via : null,
  };
}
function technicalOf(
  index: ModelIndex,
  ids: ReadonlySet<string>,
): readonly AreaTechnicalRelationship[] {
  return index
    .edges()
    .filter((edge) => ids.has(edge.from) && ids.has(edge.to) && edge.kind !== 'causes')
    .map((edge) => relationshipOf(index, edge));
}
interface AreaSelection {
  readonly systems: readonly AreaSystemView[];
  readonly boundaries: readonly AreaBoundaryView[];
  readonly ids: ReadonlySet<string>;
  readonly systemIds: ReadonlySet<string>;
  readonly missing: readonly ModelGap[];
}
function selectionOf(
  index: ModelIndex,
  detail: ModelData<'LandscapeDetail'> | undefined,
  valueFlow: LandscapeValueFlow | undefined,
): AreaSelection {
  const referenced = flowIds(valueFlow);
  const systemIds = new Set([
    ...(detail?.systems ?? []),
    ...referenced.flatMap((target) => index.place(target)?.system ?? []),
  ]);
  const systems = [...systemIds].flatMap((system) => {
    const view = systemOf(index, system);
    return view === null ? [] : [view];
  });
  const boundaries = [...new Set(referenced)].flatMap((target) => {
    const node = index.get(target);
    return node?.kind === 'system' || node?.kind === 'external'
      ? [modelAreaBoundaryOf(index, node)]
      : [];
  });
  const ids = new Set([
    ...systems.flatMap((system) => system.components.map((component) => component.id)),
    ...boundaries.map((boundary) => boundary.id),
  ]);
  const missing = [...new Set(referenced)]
    .filter((target) => index.get(target) === null)
    .map((target) => ({
      id: target,
      kind: 'unmapped_target',
      message: 'The authored value-flow target has not been mapped.',
    }));
  return { systems, boundaries, ids, systemIds, missing };
}
function gapsOf(index: ModelIndex, selection: AreaSelection): readonly ModelGap[] {
  return [
    ...index
      .gaps()
      .filter(
        (gap) =>
          selection.ids.has(gap.id) || selection.systemIds.has(index.place(gap.id)?.system ?? ''),
      ),
    ...selection.missing,
    ...selection.boundaries.flatMap((boundary) =>
      boundary.gaps.map((message) => ({
        id: boundary.id,
        kind: 'unmapped_implementation',
        message,
      })),
    ),
  ];
}
function areaOf(area: ModelData<'Area'>): AreaView['area'] {
  const { evidence_count: count, ...metadata } = area;
  return {
    ...metadata,
    activities: area.activities ?? [],
    boundary: area.boundary ?? 'Boundary not recorded.',
    ...(count === undefined ? {} : { evidenceCount: count }),
  };
}
function authoredLinks(
  detail: ModelData<'LandscapeDetail'> | undefined,
): Pick<AreaView, 'relationships' | 'collaborations'> {
  return {
    relationships: detail?.relationships ?? [],
    collaborations: detail?.collaborations ?? [],
  };
}
/** A bounded drawing reads the canonical index directly, retaining authored work and actual boundaries. */
export function modelAreaViewOf(index: ModelIndex, areaId: string): AreaView | null {
  const landscape = index.model.landscape;
  if (landscape === null) return null;
  const id = hasPrefix(areaId, 'area') ? areaId : buildId('area', areaId);
  const area = landscape.areas.find((value) => value.id === id);
  if (area === undefined) return null;
  const detail = landscape.details?.find((value) => value.area === area.id);
  const valueFlow = valueFlowOf(detail?.valueFlow);
  const selection = selectionOf(index, detail, valueFlow);
  return {
    workspace: { id: index.model.id, name: index.model.name, href: workspaceHref(index.model.id) },
    area: areaOf(area),
    reviewed: landscape.reviewed ?? 'Not recorded',
    scope: landscape.scope ?? 'Scope not recorded.',
    limitation: landscape.limitation ?? 'Evidence limitations not recorded.',
    systems: selection.systems,
    boundaries: selection.boundaries,
    ...authoredLinks(detail),
    technicalRelationships: technicalOf(index, selection.ids),
    gaps: gapsOf(index, selection),
    ...(valueFlow === undefined ? {} : { valueFlow }),
  };
}
