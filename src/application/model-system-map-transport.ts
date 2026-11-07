import type {
  LineKind,
  MapNodeIn,
  MapSatelliteIn,
  MapServiceIn,
  MapSystemIn,
  SystemMapInput,
} from './plan-viz-system-map-types';

type NodeRow = readonly [number, number, number, number, number, number];
type ServiceRow = readonly [NodeRow, number, boolean?];
type SystemRow = readonly [NodeRow, number, number, number, boolean?];
type StoreRow = readonly [NodeRow, boolean, number, readonly number[]];
type EdgeRow = readonly [LineKind, number, number, number, boolean, boolean];
type Pairs = readonly (readonly [number, number])[];
interface Arrangement {
  readonly kind?: SystemMapInput['arrangement'];
  readonly stages: Pairs;
  readonly placement?: Pairs;
  readonly focus: readonly number[] | null;
  readonly lens: number;
}

export interface ModelSystemMapWire {
  readonly arrangement: Arrangement;
  readonly text: readonly string[];
  readonly services: readonly ServiceRow[];
  readonly systems: readonly SystemRow[];
  readonly stores: readonly StoreRow[];
  readonly edges: readonly EdgeRow[];
  readonly occurrences: readonly number[];
  readonly labels: Pairs;
  readonly interfaces: Pairs;
  readonly words: Pairs;
  readonly carries: Pairs;
}

function table() {
  const indexes = new Map<string, number>();
  const text: string[] = [];
  function key(value: string | null): number {
    if (value === null) return -1;
    const known = indexes.get(value);
    if (known !== undefined) return known;
    const index = text.length;
    indexes.set(value, index);
    text.push(value);
    return index;
  }
  return { key, text };
}

/** The native map draws only cards and exchanges. The evidence and gaps stay in the canonical index. */
export function packModelSystemMap(input: SystemMapInput): ModelSystemMapWire {
  const { key, text } = table();
  const node = (item: MapNodeIn): NodeRow => [
    key(item.id),
    key(item.name),
    key(item.kind),
    key(item.does),
    key(item.team),
    item.teamSlot,
  ];
  const services = input.services.map((item): ServiceRow => {
    const row: readonly [NodeRow, number] = [node(item), key(item.system)];
    return item.infrastructure === true ? [...row, true] : row;
  });
  const systems = input.systems.map((item): SystemRow => {
    const row: readonly [NodeRow, number, number, number] = [
      node(item),
      key(item.place ?? null),
      item.parts ?? 0,
      item.stores ?? 0,
    ];
    return item.mapped === false ? [...row, false] : row;
  });
  const stores = input.stores.map((item): StoreRow => [
    node(item),
    item.topic,
    key(item.owner),
    item.carries.map(key),
  ]);
  const edges: EdgeRow[] = [];
  const rows = new Map<string, number>();
  const occurrences = input.edges.map((edge) => {
    const row: EdgeRow = [
      edge.kind,
      key(edge.from),
      key(edge.to),
      key(edge.via),
      edge.read,
      edge.write,
    ];
    const identity = row.join(',');
    const known = rows.get(identity);
    if (known !== undefined) return known;
    const position = edges.length;
    rows.set(identity, position);
    edges.push(row);
    return position;
  });
  const pairs = (values: Readonly<Record<string, string>> = {}): Pairs =>
    Object.entries(values).map(([id, value]) => [key(id), key(value)]);
  const { arrangement, stageOf, placement, focus, lens } = input;
  return {
    arrangement: {
      ...(arrangement === undefined ? {} : { kind: arrangement }),
      ...(placement === undefined
        ? {}
        : { placement: Object.entries(placement).map(([id, system]) => [key(id), key(system)]) }),
      stages: Object.entries(stageOf).map(([id, stage]) => [key(id), stage]),
      focus: focus === null ? null : focus.map(key),
      lens: key(lens),
    },
    text,
    services,
    systems,
    stores,
    edges,
    occurrences,
    labels: pairs(input.labels),
    interfaces: pairs(input.interfaceOf),
    words: pairs(input.callWords),
    carries: pairs(input.carries),
  };
}

function at<T>(list: readonly T[], index: number): T {
  const item = list[index];
  if (item === undefined) throw new Error('The system map data is incomplete.');
  return item;
}

/** Rebuild only the drawing records, preserving order and every occurrence. */
export function unpackModelSystemMap(wire: ModelSystemMapWire): SystemMapInput {
  const text = (id: number): string => at(wire.text, id);
  const nullable = (id: number): string | null => (id === -1 ? null : text(id));
  const node = ([id, name, kind, does, team, teamSlot]: NodeRow): MapNodeIn => ({
    id: text(id),
    name: text(name),
    kind: text(kind),
    does: text(does),
    team: nullable(team),
    teamSlot,
  });
  const services = wire.services.map(([row, system, infrastructure]): MapServiceIn => ({
    ...node(row),
    system: nullable(system),
    ...(infrastructure === true ? { infrastructure } : {}),
  }));
  const systems = wire.systems.map(([row, place, parts, stores, mapped]): MapSystemIn => ({
    ...node(row),
    parts,
    stores,
    ...(place === -1 ? {} : { place: text(place) }),
    ...(mapped === false ? { mapped } : {}),
  }));
  const stores = wire.stores.map(([row, topic, owner, carries]): MapSatelliteIn => ({
    ...node(row),
    topic,
    owner: nullable(owner),
    carries: carries.map(text),
  }));
  const edges = wire.edges.map(([kind, from, to, via, read, write]) => ({
    kind,
    from: text(from),
    to: text(to),
    via: nullable(via),
    read,
    write,
    steps: [],
  }));
  const values = (pairs: Pairs): Record<string, string> =>
    Object.fromEntries(pairs.map(([id, value]) => [text(id), text(value)]));
  const { kind, placement, stages, focus, lens } = wire.arrangement;
  return {
    ...(kind === undefined ? {} : { arrangement: kind }),
    ...(placement === undefined
      ? {}
      : {
          placement: Object.fromEntries(
            placement.map(([id, system]) => [text(id), nullable(system)]),
          ),
        }),
    stageOf: Object.fromEntries(stages.map(([id, stage]) => [text(id), stage])),
    focus: focus === null ? null : focus.map(text),
    lens: nullable(lens),
    services,
    systems,
    stores,
    edges: wire.occurrences.map((index) => at(edges, index)),
    stages: [],
    steps: [],
    refs: {},
    labels: {
      ...Object.fromEntries(
        [...services, ...systems, ...stores].map((card) => [card.id, card.name]),
      ),
      ...values(wire.labels),
    },
    interfaceOf: values(wire.interfaces),
    callWords: values(wire.words),
    carries: values(wire.carries),
  };
}
