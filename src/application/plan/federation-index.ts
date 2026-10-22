import { parentOf } from '@/application/plan/ids';
import type {
  FieldNode,
  GraphNode,
  OperationNode,
  SchemaNode,
  StoreNode,
  SubgraphNode,
  SystemGraph,
} from '@/domain/plan/plan-graph';

/** Cache layers in cache-path order, outermost first. */
export const LAYERS = ['edge', 'gateway', 'subgraph'] as const;

/** GraphQL's built-in scalars: never "unknown types". */
export const BUILTIN_SCALARS = ['ID', 'String', 'Int', 'Float', 'Boolean'];

/** Memoise per graph object and string key; a graph is immutable once built, so callers may ask freely. */
export function memoPerGraph<T extends object>(): (
  g: SystemGraph,
  key: string,
  compute: () => T,
) => T {
  const store = new WeakMap<SystemGraph, Map<string, T>>();
  return (g, key, compute) => {
    const entries = store.get(g) ?? new Map<string, T>();
    store.set(g, entries);
    const hit = entries.get(key);
    if (hit !== undefined) return hit;
    const value = compute();
    entries.set(key, value);
    return value;
  };
}

export const fieldNode = (g: SystemGraph, id: string | null | undefined): FieldNode | undefined => {
  const n = g.get(id);
  return n?.$type === 'field' ? n : undefined;
};
export const schemaNode = (
  g: SystemGraph,
  id: string | null | undefined,
): SchemaNode | undefined => {
  const n = g.get(id);
  return n?.$type === 'schema' ? n : undefined;
};
export const subgraphNode = (
  g: SystemGraph,
  id: string | null | undefined,
): SubgraphNode | undefined => {
  const n = g.get(id);
  return n?.$type === 'subgraph' ? n : undefined;
};
export const storeNode = (g: SystemGraph, id: string | null | undefined): StoreNode | undefined => {
  const n = g.get(id);
  return n?.$type === 'store' ? n : undefined;
};
export const operationNode = (
  g: SystemGraph,
  id: string | null | undefined,
): OperationNode | undefined => {
  const n = g.get(id);
  return n?.$type === 'operation' ? n : undefined;
};

/** The parts of one graph in a built system graph. */
export interface GraphIndex {
  readonly graph: GraphNode | null;
  readonly gateway: string | null;
  /** Type name to its `kind: graph-type` schema. */
  readonly types: ReadonlyMap<string, SchemaNode>;
  readonly byId: ReadonlyMap<string, SchemaNode>;
  readonly roots: { readonly query: SchemaNode | null; readonly mutation: SchemaNode | null };
  readonly subgraphs: readonly SubgraphNode[];
  readonly operations: readonly OperationNode[];
}

const indexes = memoPerGraph<GraphIndex>();

export function graphIndex(g: SystemGraph, graphId: string | null | undefined): GraphIndex {
  return indexes(g, graphId ?? '', () => {
    const node = g.get(graphId);
    const graph = node?.$type === 'graph' ? node : null;
    const typeList = g.schemas.filter((s) => s.kind === 'graph-type' && s.graph === graphId);
    const types = new Map<string, SchemaNode>();
    for (const t of typeList) if (t.name !== '' && !types.has(t.name)) types.set(t.name, t);
    return {
      graph,
      gateway: graph?.gateway ?? null,
      types,
      byId: new Map(typeList.map((t) => [t.id, t])),
      roots: {
        query: typeList.find((t) => t.root === 'query') ?? null,
        mutation: typeList.find((t) => t.root === 'mutation') ?? null,
      },
      subgraphs: g.subgraphs.filter((s) => s.graph === graphId),
      operations: g.operations.filter((o) => o.graph === graphId),
    };
  });
}

type Key = NonNullable<SchemaNode['keys']>[number];

export const keysOf = (type: SchemaNode | null | undefined): Key[] => type?.keys ?? [];

export const fieldNamed = (type: SchemaNode | null | undefined, name: string): FieldNode | null =>
  type?.fields.find((f) => f.name === name) ?? null;

/** The subgraphs that may be asked for an entity of `type` by a key holding `fieldName` (or any key). */
export const keyIns = (type: SchemaNode | null | undefined, fieldName: string | null): string[] => [
  ...new Set(
    keysOf(type)
      .filter((k) => fieldName === null || k.fields.includes(fieldName))
      .flatMap((k) => k.in),
  ),
];

/** Whether subgraph `sg` can hand over field `name` of the type: it holds a key with it, or resolves it. */
const resolves = (type: SchemaNode | null | undefined, name: string, sg: string): boolean =>
  keyIns(type, name).includes(sg) || (fieldNamed(type, name)?.subgraphs ?? []).includes(sg);

/**
 * A key the router can use to go from `pair[0]` to `pair[1]`: one the second lists, whose fields the
 * first either lists as a key too or resolves (federation needs no matching @key on the side it leaves).
 */
export const sharedKey = (
  type: SchemaNode | null | undefined,
  pair: readonly [string, string],
): Key | null => {
  const [from, to] = pair;
  const usable = keysOf(type).filter((k) => k.in.includes(to));
  return (
    usable.find((k) => k.in.includes(from)) ??
    usable.find((k) => k.fields.every((name) => resolves(type, name, from))) ??
    null
  );
};

export const isKeyField = (type: SchemaNode | null | undefined, name: string): boolean =>
  keysOf(type).some((k) => k.fields.includes(name));

export const sgName = (g: SystemGraph, id: string): string => {
  const n = g.get(id);
  return n !== undefined && 'name' in n ? n.name : id.replace(/^sg:/u, '');
};

/** `Product.price` for a field id. */
export function fieldLabel(g: SystemGraph, fieldId: string): string {
  const type = g.get(parentOf(fieldId));
  const field = g.get(fieldId);
  const typeName = type !== undefined && 'name' in type ? type.name : (parentOf(fieldId) ?? '');
  const name = field !== undefined && 'name' in field ? field.name : (fieldId.split('#')[1] ?? '');
  return `${typeName}.${name}`;
}
