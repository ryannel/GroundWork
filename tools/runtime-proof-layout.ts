import type { QueryEdge } from '@/domain/knowledge/knowledge.generated';

import type { RuntimeProofView } from './runtime-proof-view';

export interface DiagramNode {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly technology: string;
  readonly x: number;
  readonly y: number;
}
export interface DiagramLine {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly label: string;
  readonly dashed: boolean;
  readonly edges: readonly QueryEdge[];
}
export function interactionLines(view: RuntimeProofView): DiagramLine[] {
  const groups = new Map<string, QueryEdge[]>();
  for (const edge of view.interactions.edges) {
    const key = `${edge.from}--${edge.to}`;
    groups.set(key, [...(groups.get(key) ?? []), edge]);
  }
  return [...groups].map(([id, edges]) => {
    const first = edges[0];
    if (first === undefined) throw new Error('Empty interaction group');
    const modes = [
      ...new Set(edges.map((edge) => (edge.on === 'consume' ? 'possible delivery' : edge.on))),
    ];
    const suffix = edges.length > 1 ? ` · ${String(edges.length)} sites` : '';
    return {
      id,
      from: first.from,
      to: first.to,
      label: modes.join(' / ') + suffix,
      dashed:
        modes.includes('possible delivery') ||
        modes.includes('unknown') ||
        first.to.includes('interaction/'),
      edges,
    };
  });
}
export function interactionNodes(view: RuntimeProofView): DiagramNode[] {
  const records = new Map(view.interactions.records.map((record) => [record.id, record]));
  return view.interactions.nodes.map((node, index) => {
    const record = records.get(node.record);
    const kind = record?.kind === 'runtime_component' ? record.category : 'unresolved';
    const position = positions(view.name, node.id, index);
    const contract = record?.kind === 'interaction' ? records.get(record.contract) : undefined;
    const protocol = contract?.kind === 'interface_contract' ? contract.protocol : 'unknown';
    const technology = record?.kind === 'runtime_component' ? record.technology : protocol;
    return { id: node.id, label: node.label, kind, technology, ...position };
  });
}
function positions(
  name: string,
  id: string,
  index: number,
): { readonly x: number; readonly y: number } {
  if (name === 'capture') {
    return index === 0 ? { x: 65, y: 270 } : { x: 855, y: 95 + (index - 1) * 190 };
  }
  const locations: Readonly<Record<string, { readonly x: number; readonly y: number }>> = {
    'u3/component/mas': { x: 45, y: 195 },
    'u3/component/postgres': { x: 45, y: 435 },
    'u3/component/commercial-topic': { x: 475, y: 195 },
    'u3/component/assortment-worker': { x: 935, y: 195 },
    'u3/component/blob': { x: 710, y: 435 },
    'u3/component/redis': { x: 1010, y: 435 },
  };
  return locations[id] ?? { x: 45 + index * 300, y: 580 };
}
