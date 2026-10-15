import type { SystemMapDrawing } from '@/application/plan-viz-system-map-types';

// What lights up when a reader points at a card or a line: it, what it is made of, and what it talks to.

export type TraceTarget =
  { readonly kind: 'node'; readonly id: string } | { readonly kind: 'line'; readonly key: string };

export interface Trace {
  readonly nodes: ReadonlySet<string>;
  readonly lines: ReadonlySet<string>;
  readonly trunks: ReadonlySet<string>;
}

/** A card, the parts inside it, and the topics and stores hung under any of them. */
function ownedBy(drawing: SystemMapDrawing, id: string): Set<string> {
  const own = new Set([id]);
  for (const n of drawing.nodes) if (n.system === id) own.add(n.id);
  for (const n of drawing.nodes) if (n.host !== null && own.has(n.host)) own.add(n.id);
  return own;
}

function withSystems(drawing: SystemMapDrawing, ids: Set<string>): Set<string> {
  for (const n of drawing.nodes) if (ids.has(n.id) && n.system !== null) ids.add(n.system);
  return ids;
}

function ofNode(drawing: SystemMapDrawing, id: string): Trace {
  const own = ownedBy(drawing, id);
  const lines = drawing.lines.filter((l) => own.has(l.a) || own.has(l.b));
  const nodes = new Set(own);
  for (const l of lines) for (const end of [l.a, l.b, l.hostA, l.hostB]) nodes.add(end);
  for (const l of drawing.inner) {
    if (!own.has(l.a) && !own.has(l.b)) continue;
    for (const end of [l.a, l.b, l.hostA, l.hostB]) nodes.add(end);
  }
  const trunks = drawing.trunks.filter(
    (t) => own.has(t.host) || own.has(t.unit) || nodes.has(t.node),
  );
  return {
    nodes: withSystems(drawing, nodes),
    lines: new Set(lines.map((l) => l.key)),
    trunks: new Set(trunks.map((t) => t.node)),
  };
}

function ofLine(drawing: SystemMapDrawing, key: string): Trace {
  const line = drawing.lines.find((l) => l.key === key);
  const nodes = new Set(line === undefined ? [] : [line.a, line.b, line.hostA, line.hostB]);
  return { nodes: withSystems(drawing, nodes), lines: new Set([key]), trunks: new Set() };
}

/** Everything the target lights; the rest of the map fades. */
export function traceOf(drawing: SystemMapDrawing, target: TraceTarget): Trace {
  return target.kind === 'node' ? ofNode(drawing, target.id) : ofLine(drawing, target.key);
}
