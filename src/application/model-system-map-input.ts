import type { ModelEdge, ModelIndex } from '@/application/model-index';
import {
  packModelSystemMap,
  type ModelSystemMapWire,
} from '@/application/model-system-map-transport';
import { modelTeamSlotOf } from '@/application/model-team';
import { structureMapInput } from '@/application/plan-viz-system-map-structure';
import type {
  MapEdgeIn,
  MapNodeIn,
  MapSystemIn,
  SystemMapInput,
} from '@/application/plan-viz-system-map-types';
import { rootId } from '@/domain/ids';
import { modelText, type ModelEntity } from '@/domain/workspace-model';

interface MapOptions {
  readonly focus?: readonly string[] | null;
  readonly lens?: string | null;
}
interface Selection {
  readonly cards: readonly ModelEntity[];
  readonly edges: readonly ModelEdge[];
  readonly focus: readonly string[] | null;
}
const CARD_KINDS = new Set(['system', 'service', 'app', 'external', 'library', 'store', 'topic']);
function selectionOf(index: ModelIndex, focus: MapOptions['focus']): Selection {
  const all = index.entities.filter((node) => CARD_KINDS.has(node.kind));
  const requested =
    focus === null || focus === undefined
      ? null
      : new Set(focus.map((id) => index.get(id)?.id ?? id));
  const inside = new Set(
    all
      .filter(
        (node) =>
          requested === null ||
          [node.id, node.place.system, node.place.domain].some(
            (id) => id !== null && requested.has(id),
          ),
      )
      .map((node) => node.id),
  );
  const edges = index.edges().filter((edge) => inside.has(edge.from) || inside.has(edge.to));
  const reached = new Set([...inside, ...edges.flatMap((edge) => [edge.from, edge.to])]);
  const cards = all.filter((node) => reached.has(node.id));
  const systems = new Set(cards.flatMap((node) => node.place.system ?? []));
  return {
    cards: all.filter(
      (node) => reached.has(node.id) || (node.kind === 'system' && systems.has(node.id)),
    ),
    edges,
    focus: requested === null ? null : [...inside],
  };
}
function nodeIn(index: ModelIndex, node: ModelEntity): MapNodeIn {
  const team = index.owningTeam(node.id);
  const names: Readonly<Record<string, string>> = { app: 'ui' };
  return {
    id: node.id,
    name: index.label(node.id),
    kind: names[node.kind] ?? node.kind,
    does:
      modelText(node.data.does) ??
      modelText(node.data.summary) ??
      modelText(node.data.purpose) ??
      '',
    team,
    teamSlot: modelTeamSlotOf(index, team),
  };
}
function systemIn(index: ModelIndex, node: ModelEntity): MapSystemIn {
  const contained = index.entities.filter((part) => part.place.system === node.id);
  const mapped = node.data.mapped === false ? false : undefined;
  const base = nodeIn(index, node);
  return {
    ...base,
    ...(mapped === undefined ? {} : { mapped }),
    does:
      mapped === false
        ? [base.does, 'Implementation not mapped.'].filter(Boolean).join(' ')
        : base.does,
    parts: contained.filter((part) => ['service', 'app'].includes(part.kind)).length,
    stores: contained.filter((part) => ['store', 'topic'].includes(part.kind)).length,
    place: index.label(node.place.domain ?? ''),
  };
}
function lineKind(kind: ModelEdge['kind']): MapEdgeIn['kind'] {
  if (kind === 'call') return 'api';
  return kind === 'read' || kind === 'write' ? 'data' : 'msg';
}
function edgesIn(edges: readonly ModelEdge[]): readonly MapEdgeIn[] {
  return edges.flatMap((edge) =>
    edge.kind === 'causes'
      ? []
      : [
          {
            kind: lineKind(edge.kind),
            from: edge.from,
            to: edge.to,
            via: edge.via === '' ? null : edge.via,
            steps: [],
            read: edge.kind === 'read',
            write: edge.kind === 'write',
          },
        ],
  );
}
function callWords(index: ModelIndex, id: string): string | null {
  const node = index.get(id);
  if (node?.kind === 'operation') return `GraphQL ${modelText(node.data.kind) ?? 'operation'}`;
  const protocol = index.get(node?.parent ?? '')?.data.kind;
  const words: Readonly<Record<string, string>> = {
    rest: 'REST',
    graphql: 'GraphQL',
    grpc: 'gRPC',
    sdk: 'SDK',
  };
  return typeof protocol === 'string' && words[protocol] !== undefined
    ? `${words[protocol]} call`
    : null;
}
function carriedLabel(index: ModelIndex, node: ModelEntity): string | null {
  const response = modelText(node.data.response);
  if (response === null) return null;
  const label = index.label(rootId(response));
  return label === index.label(node.id) ? null : label;
}
function referenceDetails(index: ModelIndex, named: ReadonlySet<string>) {
  const interfaces: Record<string, string> = {};
  const words: Record<string, string> = {};
  const carries: Record<string, string> = {};
  const labels = new Set(named);
  for (const id of named) {
    const node = index.get(id);
    if (node === null) continue;
    if (node.kind === 'endpoint' && node.parent !== null) {
      interfaces[node.id] = node.parent;
      labels.add(node.parent);
    }
    const how = callWords(index, id);
    if (how !== null) words[id] = how;
    const carriesLabel = carriedLabel(index, node);
    if (carriesLabel !== null) carries[id] = carriesLabel;
  }
  return { fields: { interfaceOf: interfaces, callWords: words, carries }, labels };
}
/** A bounded drawing of the selected native index; execution and ownership are never re-derived. */
export function modelSystemMapInput(index: ModelIndex, options: MapOptions = {}): SystemMapInput {
  const selected = selectionOf(index, options.focus);
  const services = selected.cards.filter((node) =>
    ['service', 'app', 'external', 'library'].includes(node.kind),
  );
  const resources = selected.cards.filter((node) => ['store', 'topic'].includes(node.kind));
  const systems = selected.cards.filter((node) => node.kind === 'system');
  const edges = edgesIn(selected.edges);
  const cardIds = new Set(selected.cards.map((node) => node.id));
  const drawn = edges.filter((edge) => cardIds.has(edge.from) && cardIds.has(edge.to));
  const details = referenceDetails(index, new Set(drawn.flatMap((edge) => edge.via ?? [])));
  const labels = new Set([
    ...details.labels,
    ...selected.cards.map((node) => node.id),
    ...selected.cards.flatMap((node) => index.owningTeam(node.id) ?? []),
  ]);
  return structureMapInput({
    services: services.map((node) => ({
      ...nodeIn(index, node),
      system: node.place.system,
      ...(node.data.infrastructure === true ? { infrastructure: true } : {}),
    })),
    systems: systems.map((node) => systemIn(index, node)),
    stores: resources.map((node) => ({
      ...nodeIn(index, node),
      kind: modelText(node.data.form) ?? node.kind,
      topic: node.kind === 'topic',
      owner: index.resourceOwner(node.id),
      carries: index.entities
        .filter((message) => message.kind === 'message' && message.data.topic === node.id)
        .map((message) => index.label(message.id)),
    })),
    edges: drawn,
    steps: [],
    stages: [],
    stageOf: {},
    refs: {},
    ...details.fields,
    labels: Object.fromEntries([...labels].filter(Boolean).map((id) => [id, index.label(id)])),
    placement: Object.fromEntries(selected.cards.map((node) => [node.id, node.place.system])),
    lens: options.lens ?? null,
    focus: selected.focus,
  });
}

const drawings = new WeakMap<ModelIndex, Map<string, ModelSystemMapWire>>();

/** Pack the native view once for the same index and scope, including across a system’s flow pages. */
export function modelSystemMapWire(
  index: ModelIndex,
  options: MapOptions = {},
): ModelSystemMapWire {
  const key = JSON.stringify([options.focus ?? null, options.lens ?? null]);
  const maps = drawings.get(index) ?? new Map<string, ModelSystemMapWire>();
  const previous = maps.get(key);
  if (previous !== undefined) return previous;
  const drawing = packModelSystemMap(modelSystemMapInput(index, options));
  maps.set(key, drawing);
  drawings.set(index, maps);
  return drawing;
}
