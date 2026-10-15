import type { Model } from '@/application/plan/derive';
import {
  countOf,
  fieldsOf,
  type GraphMode,
  graphIn,
  graphTypes,
  subgraphLabel,
  subgraphsOf,
} from '@/application/plan-viz-graph-base';

// The graph as one picture, left to right: the front end, the edge cache, the gateway with its operations, the
// gateway cache, then each subgraph with the types it answers and the stores behind it.

export interface PictureOperation {
  readonly id: string;
  readonly fields: number;
  /** The subgraphs its query plan reaches. */
  readonly on: readonly string[];
  readonly summary: string;
}

export interface PictureType {
  readonly id: string;
  readonly label: string;
  /** "key only", or "3 of 7". */
  readonly share: string;
}

export interface PictureRow {
  readonly id: string;
  readonly label: string;
  readonly team: string | null;
  readonly service: string;
  readonly types: readonly PictureType[];
  readonly stores: readonly string[];
}

export interface Band {
  readonly id: string;
  readonly layer: 'edge' | 'gateway';
  readonly tech: string;
  readonly perItem: boolean;
}

export interface GraphPictureView {
  readonly graph: string;
  readonly clients: readonly string[];
  readonly edge: readonly Band[];
  readonly gateway: {
    readonly id: string;
    readonly team: string | null;
    readonly summary: string;
    readonly operations: readonly PictureOperation[];
  };
  readonly gatewayCache: readonly Band[];
  readonly rows: readonly PictureRow[];
}

function bandsOf(model: Model, mode: GraphMode, layer: Band['layer']): Band[] {
  return graphIn(model, mode)
    .stores.filter((s) => s.kind === 'cache' && s.layer === layer)
    .map((s) => ({
      id: s.id,
      layer,
      tech: s.tech ?? '',
      perItem: s.granularity === 'entity',
    }));
}

function operationsOfGraph(model: Model, graphId: string, mode: GraphMode): PictureOperation[] {
  const subgraphs = subgraphsOf(model, graphId, mode);
  return graphIn(model, mode)
    .operations.filter((o) => o.graph === graphId)
    .map((o) => {
      const on = subgraphs
        .filter((s) => model.operationsOn(s.id, mode).includes(o.id))
        .map((s) => s.id);
      const fields = model.queryPlan(o.id, mode).selected.filter((x) => x.addedByRouter === null);
      return {
        id: o.id,
        fields: fields.length,
        on,
        summary: `${countOf(fields.length, 'field')} · ${countOf(on.length, 'subgraph')}`,
      };
    });
}

function typesOfSubgraph(
  model: Model,
  mode: GraphMode,
  scope: { readonly graphId: string; readonly subgraph: string },
): PictureType[] {
  const { graphId, subgraph: sg } = scope;
  const found: PictureType[] = [];
  for (const type of graphTypes(model, graphId, mode)) {
    const owners = model.fieldOwners(type.id, mode);
    const mine = owners.bySubgraph[sg] ?? [];
    if (mine.length === 0) continue;
    const keyOnly = mine.every((f) => owners.keyFields.includes(f));
    found.push({
      id: type.id,
      label: model.label(type.id),
      share: keyOnly
        ? 'key only'
        : `${String(mine.length)} of ${String(fieldsOf(graphIn(model, mode), type.id).length)}`,
    });
  }
  return found;
}

/** The picture of one graph in a mode, or null when the graph is not in it. */
export function graphPicture(
  model: Model,
  graphId: string,
  mode: GraphMode = 'asIs',
): GraphPictureView | null {
  const graph = graphIn(model, mode).get(graphId);
  if (graph?.$type !== 'graph') return null;
  const operations = operationsOfGraph(model, graphId, mode);
  const subgraphs = subgraphsOf(model, graphId, mode);
  const clients = graphIn(model, mode)
    .operations.filter((o) => o.graph === graphId)
    .flatMap((o) => (o.client === undefined ? [] : [o.client]));
  return {
    graph: graphId,
    clients: [...new Set(clients)],
    edge: bandsOf(model, mode, 'edge'),
    gateway: {
      id: graph.gateway,
      team: model.ownerTeam(graph.gateway),
      summary: `composes ${countOf(subgraphs.length, 'subgraph')} · ${countOf(operations.length, 'operation')}`,
      operations,
    },
    gatewayCache: bandsOf(model, mode, 'gateway'),
    rows: subgraphs.map((s) => ({
      id: s.id,
      label: subgraphLabel(model, s.id),
      team: model.ownerTeam(s.id),
      service: s.service,
      types: typesOfSubgraph(model, mode, { graphId, subgraph: s.id }),
      stores: graphIn(model, mode)
        .stores.filter((st) => st.owner === s.service)
        .map((st) => st.id),
    })),
  };
}
