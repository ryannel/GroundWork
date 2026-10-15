import type { Model } from '@/application/plan/derive';
import type { FieldNode, SchemaNode, SubgraphNode, SystemGraph } from '@/domain/plan/plan-graph';

// What the three graph pictures share: which graph a mode reads, its types in the order they are drawn, and the
// small wordings. `lens` everywhere is a team id; things of other teams are dimmed.

export type GraphMode = 'asIs' | 'toBe';

export const graphIn = (model: Model, mode: GraphMode): SystemGraph =>
  mode === 'asIs' ? model.asIs : model.toBe;

/** The graph-types of one graph in a mode: the entry points (roots) last. */
export function graphTypes(model: Model, graphId: string, mode: GraphMode = 'toBe'): SchemaNode[] {
  const types = graphIn(model, mode).schemas.filter(
    (s) => s.kind === 'graph-type' && s.graph === graphId,
  );
  return [
    ...types.filter((t) => t.root === undefined),
    ...types.filter((t) => t.root !== undefined),
  ];
}

export const subgraphsOf = (model: Model, graphId: string, mode: GraphMode): SubgraphNode[] =>
  graphIn(model, mode).subgraphs.filter((s) => s.graph === graphId);

/** The name of a subgraph without the word "subgraph". */
export const subgraphLabel = (model: Model, id: string): string =>
  model.label(id).replace(/ subgraph$/i, '');

/** A field a response must not share between people: it needs sign-in, or says so. */
export const isPrivateField = (field: FieldNode | undefined): boolean =>
  field !== undefined && (field.auth !== undefined || field.cache_control?.scope === 'private');

export const fieldName = (id: string): string => id.split('#')[1] ?? '';

export const fieldsOf = (graph: SystemGraph, typeId: string): FieldNode[] => {
  const node = graph.get(typeId);
  return node?.$type === 'schema' ? node.fields : [];
};

export const countOf = (n: number, one: string): string =>
  [String(n), n === 1 ? one : `${one}s`].join(' ');
