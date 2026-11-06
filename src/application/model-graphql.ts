// Graph composition describes possible resolver reach, not an observed runtime query plan.
import {
  modelList,
  modelRecord,
  modelText,
  type ModelEntity,
  type ModelGap,
} from '@/domain/workspace-model';

export interface GraphqlReach {
  readonly field: string;
  readonly subgraph: string;
  readonly component: string;
}
export interface GraphModel {
  readonly nodes: readonly ModelEntity[];
  readonly get: (id: string) => ModelEntity | null;
}
interface SelectedField {
  readonly field: ModelEntity;
  readonly parents: readonly ModelEntity[];
}
interface Selection {
  readonly path: string;
  readonly name: string;
}
interface Trace {
  readonly path: string;
  readonly fields: readonly SelectedField[];
}
interface Cache<Value> {
  readonly read: (key: string) => Value | undefined;
  readonly keep: (key: string, value: Value) => void;
}
function cacheOf<Value>(): Cache<Value> {
  const values = new Map<string, Value>();
  return {
    read: (key) => values.get(key),
    keep: (key, value) => {
      values.set(key, value);
    },
  };
}
interface GraphState {
  readonly fields: ReadonlyMap<string, readonly ModelEntity[]>;
  readonly traces: Cache<readonly Trace[]>;
  readonly reaches: Cache<readonly GraphqlReach[]>;
}
const states = new WeakMap<GraphModel, GraphState>();
function stateOf(graph: GraphModel): GraphState {
  const known = states.get(graph);
  if (known !== undefined) return known;
  const fields = new Map<string, ModelEntity[]>();
  for (const node of graph.nodes) {
    if (node.kind === 'field' && node.parent !== null) {
      fields.set(node.parent, [...(fields.get(node.parent) ?? []), node]);
    }
  }
  const state = {
    fields,
    traces: cacheOf<readonly Trace[]>(),
    reaches: cacheOf<readonly GraphqlReach[]>(),
  };
  states.set(graph, state);
  return state;
}
function reference(value: unknown, graph: GraphModel): string | null {
  const id = modelText(value);
  return id === null ? null : (graph.get(id)?.id ?? null);
}
function schemasOf(operation: ModelEntity, graph: GraphModel): readonly ModelEntity[] {
  const id = reference(operation.data.graph, graph);
  if (id === null) return [];
  return graph.nodes.filter(
    (node) =>
      node.kind === 'schema' &&
      node.data.kind === 'graph-type' &&
      reference(node.data.graph, graph) === id,
  );
}
function referencedSchemas(
  value: unknown,
  schemas: readonly ModelEntity[],
  graph: GraphModel,
): readonly ModelEntity[] {
  if (typeof value === 'string') {
    const exact = graph.get(value);
    return exact?.kind === 'schema'
      ? [exact]
      : schemas.filter((schema) => schema.data.name === value);
  }
  const tagged = modelRecord(value);
  if (tagged === null) return [];
  return [...modelList(tagged.one_of), tagged.array, modelRecord(tagged.map)?.value].flatMap(
    (item) => referencedSchemas(item, schemas, graph),
  );
}
function selectionsOf(document: ModelEntity): readonly Selection[] {
  return modelList(document.data.selections).flatMap((value) => {
    const data = modelRecord(value);
    const path = modelText(data?.path);
    const name = modelText(data?.field_name);
    return path === null || name === null ? [] : [{ path, name }];
  });
}
interface SelectionScope {
  readonly roots: readonly ModelEntity[];
  readonly schemas: readonly ModelEntity[];
  readonly names: ReadonlyMap<string, string>;
  readonly graph: GraphModel;
}
function traceSelection(selection: Selection, scope: SelectionScope): Trace {
  let candidates: readonly {
    readonly schema: ModelEntity;
    readonly parents: readonly ModelEntity[];
  }[] = scope.roots.map((schema) => ({ schema, parents: [] }));
  let found: readonly SelectedField[] = [];
  const path: string[] = [];
  for (const part of selection.path.split('.')) {
    path.push(part);
    const name = scope.names.get(path.join('.')) ?? part;
    found = candidates.flatMap(({ schema, parents }) =>
      (stateOf(scope.graph).fields.get(schema.id) ?? [])
        .filter((node) => node.data.name === name)
        .map((field) => ({ field, parents })),
    );
    candidates = found.flatMap(({ field, parents }) =>
      referencedSchemas(field.data.type ?? field.data.ref, scope.schemas, scope.graph).map(
        (schema) => ({ schema, parents: [...parents, field] }),
      ),
    );
  }
  return { path: selection.path, fields: found };
}
function calculateTraces(operation: ModelEntity, graph: GraphModel): readonly Trace[] {
  const document = graph.get(modelText(operation.data.document) ?? '');
  if (document?.data.kind !== 'graphql_document_binding') return [];
  const schemas = schemasOf(operation, graph);
  const roots = schemas.filter((schema) => schema.data.root === document.data.operation_type);
  const selections = selectionsOf(document);
  const names = new Map(selections.map((selection) => [selection.path, selection.name]));
  return selections.map((selection) => traceSelection(selection, { roots, schemas, names, graph }));
}
function tracesOf(operation: ModelEntity, graph: GraphModel): readonly Trace[] {
  const kept = stateOf(graph).traces;
  const known = kept.read(operation.id);
  if (known !== undefined) return known;
  const traces = calculateTraces(operation, graph);
  kept.keep(operation.id, traces);
  return traces;
}
function requiredFields(
  selected: SelectedField,
  graph: GraphModel,
  seen: ReadonlySet<string>,
): readonly SelectedField[] {
  if (seen.has(selected.field.id)) return [];
  if (providedByOne(selected, graph)) return [selected];
  const visited = new Set([...seen, selected.field.id]);
  const required = modelList(selected.field.data.requires).flatMap((id) => {
    const field = typeof id === 'string' ? graph.get(id) : null;
    return field?.kind === 'field'
      ? requiredFields({ field, parents: selected.parents }, graph, visited)
      : [];
  });
  return [selected, ...required];
}
function providerIds(field: ModelEntity, graph: GraphModel): readonly string[] {
  const declared = modelList(field.data.subgraphs).flatMap((id) =>
    typeof id === 'string' ? [reference(id, graph) ?? id] : [],
  );
  const override = modelRecord(field.data.override);
  const original = modelText(override?.from);
  if (original === null) return declared;
  const from = reference(original, graph) ?? original;
  const percent = override?.percent;
  if (percent === 0) return [from];
  if (typeof percent === 'number' && percent < 100) return [...new Set([...declared, from])];
  return declared.filter((id) => id !== from);
}
function supplyingParent(selected: SelectedField, graph: GraphModel): ModelEntity | undefined {
  return selected.parents.findLast((parent) =>
    modelList(parent.data.provides).some((id) => reference(id, graph) === selected.field.id),
  );
}
function providersOf(selected: SelectedField, graph: GraphModel): readonly string[] {
  const parent = supplyingParent(selected, graph);
  if (parent === undefined) return providerIds(selected.field, graph);
  const supplied = providerIds(parent, graph);
  return supplied.length === 1
    ? supplied
    : [...new Set([...supplied, ...providerIds(selected.field, graph)])];
}
function providedByOne(selected: SelectedField, graph: GraphModel): boolean {
  const parent = supplyingParent(selected, graph);
  return parent !== undefined && providerIds(parent, graph).length === 1;
}
function requirementCycles(
  selected: SelectedField,
  graph: GraphModel,
  seen: ReadonlySet<string>,
): readonly string[] {
  if (providedByOne(selected, graph)) return [];
  if (seen.has(selected.field.id)) return [selected.field.id];
  const visited = new Set([...seen, selected.field.id]);
  return modelList(selected.field.data.requires).flatMap((id) => {
    const field = typeof id === 'string' ? graph.get(id) : null;
    return field?.kind === 'field'
      ? requirementCycles({ field, parents: selected.parents }, graph, visited)
      : [];
  });
}
function expandedFields(operation: ModelEntity, graph: GraphModel): readonly SelectedField[] {
  return tracesOf(operation, graph).flatMap((trace) =>
    trace.fields.flatMap((selected) => requiredFields(selected, graph, new Set())),
  );
}
export function selectedGraphFields(
  operation: ModelEntity,
  graph: GraphModel,
): readonly ModelEntity[] {
  return tracesOf(operation, graph).flatMap((trace) =>
    trace.fields.map((selected) => selected.field),
  );
}
export function graphqlReaches(operation: ModelEntity, graph: GraphModel): readonly GraphqlReach[] {
  const kept = stateOf(graph).reaches;
  const known = kept.read(operation.id);
  if (known !== undefined) return known;
  const reaches = expandedFields(operation, graph).flatMap((selected) =>
    providersOf(selected, graph).flatMap((id) => {
      const subgraph = graph.get(id);
      const component = reference(subgraph?.data.component, graph);
      return subgraph?.kind !== 'subgraph' || component === null
        ? []
        : [{ field: selected.field.id, subgraph: subgraph.id, component }];
    }),
  );
  const unique = [
    ...new Map(reaches.map((reach) => [`${reach.field}\n${reach.subgraph}`, reach])).values(),
  ];
  kept.keep(operation.id, unique);
  return unique;
}
function providerGaps(
  selected: SelectedField,
  operation: string,
  graph: GraphModel,
): readonly ModelGap[] {
  const providers = providersOf(selected, graph);
  const known =
    providers.length > 0 &&
    providers.every((id) => reference(graph.get(id)?.data.component, graph) !== null);
  const gaps: ModelGap[] = known
    ? []
    : [
        {
          id: operation,
          kind: 'unmapped_target',
          reference: selected.field.id,
          message: 'The selected graph field has no complete recorded provider placement.',
        },
      ];
  const parent = supplyingParent(selected, graph);
  if (parent !== undefined && providerIds(parent, graph).length !== 1) {
    gaps.push({
      id: operation,
      kind: 'ambiguous_provider',
      reference: selected.field.id,
      message: 'The provided field is not attributed to an individual active provider.',
    });
  }
  const required = providedByOne(selected, graph) ? [] : modelList(selected.field.data.requires);
  for (const id of required) {
    if (typeof id === 'string' && graph.get(id)?.kind !== 'field') {
      gaps.push({
        id: operation,
        kind: 'unmapped_target',
        reference: id,
        message: 'A required graph field is not recorded.',
      });
    }
  }
  return gaps;
}
export function graphqlGaps(operation: ModelEntity, graph: GraphModel): readonly ModelGap[] {
  const absent: readonly ModelGap[] = tracesOf(operation, graph)
    .filter((trace) => trace.fields.length === 0)
    .map((trace) => ({
      id: operation.id,
      kind: 'unmapped_target',
      reference: trace.path,
      message: 'The selected document path cannot be resolved through the recorded graph types.',
    }));
  const cycles: readonly ModelGap[] = tracesOf(operation, graph)
    .flatMap((trace) =>
      trace.fields.flatMap((selected) => requirementCycles(selected, graph, new Set())),
    )
    .map((id) => ({
      id: operation.id,
      kind: 'cyclic_composition',
      reference: id,
      message: 'The graph field requirements contain a cycle.',
    }));
  return [
    ...absent,
    ...cycles,
    ...expandedFields(operation, graph).flatMap((selected) =>
      providerGaps(selected, operation.id, graph),
    ),
  ];
}
