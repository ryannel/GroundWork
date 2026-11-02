import { evidenceAnchor } from '@/domain/knowledge/evidence-anchor';
import type {
  ExecutionBinding,
  KnowledgeRecord,
  QueryEdge,
  QueryNode,
} from '@/domain/knowledge/knowledge.generated';

import { sourceLinks } from './runtime-proof-sources';
import { svgDocument, wrapped } from './runtime-proof-svg';
import { anchor, html, type RuntimeProofView, viewRecords } from './runtime-proof-view';

function implementationName(id: string, records: ReadonlyMap<string, KnowledgeRecord>): string {
  const record = records.get(id);
  return record?.kind === 'implementation' ? record.logicalId : id;
}
function implementationPosition(index: number): { readonly x: number; readonly y: number } {
  return { x: 55 + (index % 4) * 300, y: 85 + Math.floor(index / 4) * 150 };
}
function implementationBindings(view: RuntimeProofView, component: string): ExecutionBinding[] {
  const records = viewRecords(view);
  const selected = new Set(
    view.trace.nodes.filter((node) => node.component === component).map((node) => node.execution),
  );
  return [...records.values()]
    .filter(
      (record): record is ExecutionBinding =>
        record.kind === 'execution_binding' && selected.has(record.id),
    )
    .toSorted(
      (a, b) =>
        view.trace.nodes.findIndex((node) => node.execution === a.id) -
        view.trace.nodes.findIndex((node) => node.execution === b.id),
    );
}
export function componentInternals(view: RuntimeProofView, component: string): string {
  const bindings = implementationBindings(view, component);
  if (bindings.length === 0) {
    return '<p>This component is reached through its interface. No internal implementation is bound in this proof.</p>';
  }
  const records = viewRecords(view);
  const boxes = bindings
    .map((binding, index) => {
      const { x, y } = implementationPosition(index);
      const name = implementationName(binding.implementation, records);
      const title = wrapped(name, 25)
        .slice(0, 3)
        .map(
          (line, row) =>
            `<tspan x="${String(x + 15)}" y="${String(y + 24 + row * 19)}">${html(line)}</tspan>`,
        )
        .join('');
      const count = view.trace.nodes.filter((node) => node.execution === binding.id).length;
      return `<a href="#${anchor(binding.id)}"><rect class="node" x="${String(x)}" y="${String(y)}" width="260" height="108" rx="8"/><text class="name"><title>${html(name)}</title>${title}</text><text class="sub" x="${String(x + 15)}" y="${String(y + 91)}">${String(count)} contextual operations · open</text></a>`;
    })
    .join('');
  const calls = localCalls(view, bindings);
  const sourceIds = bindings.flatMap((binding) => binding.evidence);
  return `<h2>Code inside this component</h2>${svgDocument(120 + Math.ceil(bindings.length / 4) * 150, calls + boxes)}${sourceLinks(sourceIds, records)}<p>Calls between these implementations stay inside the component. Open one to follow branches, local calls and exits.</p>`;
}
function projectedEdges(view: RuntimeProofView, nodes: readonly QueryNode[]): QueryEdge[] {
  const selected = new Set(nodes.map((node) => node.id));
  const result: QueryEdge[] = [];
  for (const source of nodes) {
    const pending = view.trace.edges.filter((edge) => edge.from === source.id);
    const seen = new Set<string>();
    while (pending.length > 0) {
      const edge = pending.shift();
      if (edge === undefined || seen.has(edge.to)) continue;
      seen.add(edge.to);
      if (selected.has(edge.to)) result.push({ ...edge, from: source.id });
      else pending.push(...view.trace.edges.filter((next) => next.from === edge.to));
    }
  }
  return result;
}
function layers(
  nodes: readonly QueryNode[],
  edges: readonly QueryEdge[],
): ReadonlyMap<string, number> {
  const depth = new Map<string, number>(nodes.map((node) => [node.id, 0]));
  let remaining = nodes.length;
  while (remaining > 0) {
    remaining -= 1;
    let changed = false;
    for (const edge of edges) {
      const next = (depth.get(edge.from) ?? 0) + 1;
      if (next > (depth.get(edge.to) ?? 0) && next < nodes.length) {
        depth.set(edge.to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return depth;
}
function operationGraph(view: RuntimeProofView, binding: ExecutionBinding): string {
  const nodes = view.trace.nodes.filter((node) => node.execution === binding.id);
  const edges = projectedEdges(view, nodes);
  const levels = layers(nodes, edges);
  const groups = new Map<number, QueryNode[]>();
  for (const node of nodes) {
    const level = levels.get(node.id) ?? 0;
    groups.set(level, [...(groups.get(level) ?? []), node]);
  }
  const positions = new Map(
    nodes.map((node) => {
      const level = levels.get(node.id) ?? 0;
      const group = groups.get(level) ?? [];
      const index = group.findIndex((item) => item.id === node.id);
      return [node.id, { x: 660 - (group.length * 300) / 2 + index * 300, y: 55 + level * 135 }];
    }),
  );
  const paths = edges
    .map((edge) => {
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      if (from === undefined || to === undefined) return '';
      return `<g><title>${html(edge.condition ?? edge.on)}</title><path class="edge" marker-end="url(#arrow)" d="M${String(from.x + 140)} ${String(from.y + 88)}L${String(to.x + 140)} ${String(to.y)}"/><text class="edge-label" x="${String((from.x + to.x) / 2 + 140)}" y="${String((from.y + to.y) / 2 + 48)}">${html(edge.on)}</text></g>`;
    })
    .join('');
  const boxes = nodes
    .map((node) => operationBox(node, positions.get(node.id), viewRecords(view)))
    .join('');
  const maximum = Math.max(...levels.values(), 0);
  return svgDocument(180 + maximum * 135, paths + boxes);
}
function operationBox(
  node: QueryNode,
  position: { readonly x: number; readonly y: number } | undefined,
  records: ReadonlyMap<string, KnowledgeRecord>,
): string {
  if (position === undefined) return '';
  const lines = wrapped(node.label, 34);
  const text = lines
    .slice(0, 4)
    .map(
      (line, index) =>
        `<tspan x="${String(position.x + 12)}" y="${String(position.y + 21 + index * 17)}">${html(line)}</tspan>`,
    )
    .join('');
  const operation = records.get(node.record);
  const evidence = operation?.kind === 'operation' ? operation.evidence : [];
  const title = `${node.record}\n${node.label}\n${node.context.join(' → ')}\n${evidence.join(', ')}`;
  const box = `<g><title>${html(title)}</title><rect class="local" x="${String(position.x)}" y="${String(position.y)}" width="280" height="88" rx="6"/><text class="op-label">${text}</text></g>`;
  const sourceId = evidence[0];
  const source = sourceId === undefined ? undefined : records.get(sourceId);
  const url = source?.kind === 'evidence' ? evidenceAnchor(source) : null;
  return url === null
    ? box
    : `<a href="${html(url)}" target="_blank" rel="noopener noreferrer">${box}</a>`;
}
export function implementationPanels(view: RuntimeProofView): string {
  const records = viewRecords(view);
  const selected = new Set(view.trace.nodes.map((node) => node.execution));
  return [...records.values()]
    .filter(
      (record): record is ExecutionBinding =>
        record.kind === 'execution_binding' && selected.has(record.id),
    )
    .map((binding) => {
      const operations = view.trace.nodes
        .filter((node) => node.execution === binding.id)
        .map((node) => records.get(node.record))
        .filter((record) => record?.kind === 'operation');
      const evidence = operations.flatMap((operation) => operation.evidence);
      return `<section class="inspector" id="${anchor(binding.id)}"><a href="#${anchor(binding.component)}">← Component</a><h1>${html(implementationName(binding.implementation, records))}</h1><p>Invocation contexts are retained. Paths through local helpers are collapsed back to their return; hover an edge for its guard.</p>${operationGraph(view, binding)}<h2>GitHub sources</h2>${sourceLinks(evidence, records)}</section>`;
    })
    .join('');
}

function localCalls(view: RuntimeProofView, bindings: readonly ExecutionBinding[]): string {
  const records = viewRecords(view);
  const pairs = new Set<string>();
  for (const node of view.trace.nodes) {
    const pair = callPair(records, bindings, node);
    if (pair !== null) pairs.add(pair);
  }
  return [...pairs]
    .map((pair) => {
      const [from = 0, to = 0] = pair.split(',').map(Number);
      const start = implementationPosition(from);
      const end = implementationPosition(to);
      const below = start.y !== end.y;
      const forward = end.x > start.x;
      const exit = forward ? 260 : 0;
      const entrance = forward ? 0 : 260;
      const x1 = start.x + (below ? 130 : exit);
      const y1 = start.y + (below ? 108 : 54);
      const x2 = end.x + (below ? 130 : entrance);
      const y2 = end.y + (below ? 0 : 54);
      return `<path class="edge" marker-end="url(#arrow)" d="M${String(x1)} ${String(y1)}L${String(x2)} ${String(y2)}"/>`;
    })
    .join('');
}

function callPair(
  records: ReadonlyMap<string, KnowledgeRecord>,
  bindings: readonly ExecutionBinding[],
  node: QueryNode,
): string | null {
  const operation = records.get(node.record);
  if (operation?.kind !== 'operation' || operation.resolution === null) return null;
  const resolution = records.get(operation.resolution);
  if (resolution?.kind !== 'resolution') return null;
  const from = bindings.findIndex((binding) => binding.id === node.execution);
  const to = bindings.findIndex((binding) => binding.implementation === resolution.target);
  return from !== -1 && to !== -1 && from !== to ? `${String(from)},${String(to)}` : null;
}
