import {
  type DiagramLine,
  type DiagramNode,
  interactionLines,
  interactionNodes,
} from './runtime-proof-layout';
import { anchor, html, type RuntimeProofView } from './runtime-proof-view';

export function wrapped(text: string, width = 29): string[] {
  const lines: string[] = [];
  const limit = Math.max(1, width);
  const words = text
    .split(' ')
    .flatMap((part) =>
      Array.from({ length: Math.ceil(part.length / limit) }, (_, index) =>
        part.slice(index * limit, (index + 1) * limit),
      ),
    );
  for (const word of words) {
    const last = lines.at(-1);
    if (last !== undefined && last.length + word.length < width) {
      lines[lines.length - 1] = `${last} ${word}`;
    } else lines.push(word);
  }
  return lines;
}
function nodeDrawing(node: DiagramNode): string {
  const lines = wrapped(node.label);
  const title = lines
    .map(
      (line, index) =>
        `<tspan x="${String(node.x + 16)}" y="${String(node.y + 48 + index * 19)}">${html(line)}</tspan>`,
    )
    .join('');
  return `<a href="#${anchor(node.id)}"><g><title>${html(node.label)}</title><rect class="node ${node.kind}" x="${String(node.x)}" y="${String(node.y)}" width="250" height="112" rx="10"/><text class="kind" x="${String(node.x + 16)}" y="${String(node.y + 23)}">${html(node.kind.toUpperCase())} · ${html(node.technology)}</text><text class="name">${title}</text></g></a>`;
}
function lineDrawing(line: DiagramLine, nodes: ReadonlyMap<string, DiagramNode>): string {
  const from = nodes.get(line.from);
  const to = nodes.get(line.to);
  if (from === undefined || to === undefined) throw new Error('Missing graph endpoint');
  const below = to.y > from.y + 150 && Math.abs(to.x - from.x) < 400;
  const x1 = below ? from.x + 125 : from.x + 250;
  const y1 = below ? from.y + 112 : from.y + 56;
  const x2 = below ? to.x + 125 : to.x;
  const y2 = below ? to.y : to.y + 56;
  const middle = (x1 + x2) / 2;
  const path = below
    ? `M${String(x1)} ${String(y1)} C${String(x1)} ${String(y1 + 80)},${String(x2)} ${String(y2 - 80)},${String(x2)} ${String(y2)}`
    : `M${String(x1)} ${String(y1)} C${String(middle)} ${String(y1)},${String(middle)} ${String(y2)},${String(x2)} ${String(y2)}`;
  const labelX = below ? x2 : middle;
  const labelY = below ? to.y - 44 : (y1 + y2) / 2 - 13;
  return `<a href="#${anchor(line.id)}"><g><title>${html(line.label)} · open contracts and call sites</title><path class="hit" d="${path}"/><path class="edge ${line.dashed ? 'uncertain' : ''}" d="${path}" marker-end="url(#arrow)"/><text class="edge-label" x="${String(labelX)}" y="${String(labelY)}">${html(line.label)}</text></g></a>`;
}
export function svgDocument(height: number, content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1320 ${String(height)}" role="img"><style>text{font-family:Arial,sans-serif;fill:#243c52}.heading{font-size:25px;font-weight:700}.sub{font-size:15px;fill:#586e80}.kind{font-size:10px;font-weight:700;fill:#647789;letter-spacing:1px}.name{font-size:16px;font-weight:700}.node{fill:#fff;stroke:#9cb4c6;stroke-width:1.5}.store{fill:#ecf6ef;stroke:#7eab90}.topic{fill:#fff4db;stroke:#baa064}.unresolved{fill:#fff8ec;stroke:#b38b57;stroke-dasharray:6 4}.edge{fill:none;stroke:#6e899d;stroke-width:2}.uncertain{stroke-dasharray:7 5}.hit{fill:none;stroke:transparent;stroke-width:18px;pointer-events:stroke}.edge-label{font-size:13px;fill:#436078;text-anchor:middle;paint-order:stroke;stroke:#f3f7fa;stroke-width:6px;stroke-linejoin:round}.op-label{font-size:13px}.local{fill:#fff;stroke:#adc0ce}a:hover rect{stroke:#276a9e;stroke-width:3}a:hover .edge{stroke:#276a9e;stroke-width:3}</style><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#6e899d"/></marker></defs><rect width="1320" height="${String(height)}" fill="#f3f7fa"/>${content}</svg>`;
}
export function runtimeOverview(view: RuntimeProofView): string {
  const nodes = interactionNodes(view);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const lines = interactionLines(view)
    .map((line) => lineDrawing(line, byId))
    .join('');
  const drawing = nodes.map(nodeDrawing).join('');
  const title = view.name === 'capture' ? 'Capture a payment transaction' : 'Create a soft offer';
  const unresolved = nodes.filter((node) => node.kind === 'unresolved').length;
  const hint = `${String(nodes.length - unresolved)} runtime components · ${String(unresolved)} unresolved boundaries. Source declarations remain distinct from deployment.`;
  return svgDocument(
    730,
    `<text class="heading" x="45" y="43">${title}</text><text class="sub" x="45" y="73">${hint}</text>${lines}${drawing}<text class="sub" x="45" y="665">Choose a component to see its implementation. Choose a connection to inspect schemas, values and GitHub sources.</text><text class="sub" x="45" y="695">Source declarations at pinned commits · deployed locations and unresolved dependencies remain explicit.</text>`,
  );
}
