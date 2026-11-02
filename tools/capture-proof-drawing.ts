import type { QueryResponse } from '@/domain/knowledge/knowledge.generated';

interface Group {
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly operations: readonly string[];
}

const CONTROLLER_ENTRY = 'controller.entry';

const GROUPS: readonly Group[] = [
  {
    label: 'Request and declared policy',
    x: 430,
    y: 90,
    operations: [CONTROLLER_ENTRY, 'controller.invoke', 'capture.entry'],
  },
  {
    label: 'Load session and transaction',
    x: 430,
    y: 185,
    operations: ['capture.session', 'capture.map', 'capture.transaction'],
  },
  {
    label: 'Check current stage and history',
    x: 430,
    y: 280,
    operations: [
      'capture.validate',
      'validator.entry',
      'validator.predicate',
      'validator.branch',
      'validator.throw',
      'validator.return',
      'predicate.entry',
      'predicate.current',
      'predicate.history',
      'predicate.true',
      'predicate.false',
    ],
  },
  {
    label: 'Check capture method, reference, stage',
    x: 430,
    y: 375,
    operations: ['capture.automatic', 'capture.external', 'capture.stage', 'capture.message'],
  },
  { label: 'Construct outgoing arguments', x: 430, y: 470, operations: ['capture.payload'] },
  { label: 'Call capture client', x: 430, y: 565, operations: ['capture.remote'] },
  {
    label: 'Evaluate wrapper; discard data',
    x: 430,
    y: 660,
    operations: ['capture.wrapper', 'capture.data'],
  },
  {
    label: '202 · acceptance returned',
    x: 430,
    y: 755,
    operations: ['capture.return', 'controller.202'],
  },
  { label: '208 · already completed', x: 60, y: 280, operations: ['controller.208'] },
  {
    label: '422 · validation rejection',
    x: 825,
    y: 375,
    operations: [
      'capture.rejectAutomatic',
      'capture.rejectExternal',
      'capture.rejectStage',
      'controller.422',
    ],
  },
  {
    label: '500 · null dereference',
    x: 825,
    y: 660,
    operations: ['capture.nullStage', 'capture.nullWrapper', 'controller.500'],
  },
];

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function frame(title: string, description: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="920" viewBox="0 0 1200 920"><style>text{font-family:Arial,sans-serif;fill:#23323d;font-size:13px}.title{font-size:22px;font-weight:700}.label{font-size:14px;font-weight:600}.note{fill:#657480;font-size:12px}.node{fill:#fff;stroke:#aab7bf;stroke-width:1.3}.gap{stroke:#b88126;fill:#fff8eb}.edge{fill:none;stroke:#8597a3;stroke-width:1.4}.uncertain{stroke:#b88126;stroke-dasharray:5 4}</style><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="#8597a3"/></marker></defs><rect width="1200" height="920" fill="#f5f8fa"/><text class="title" x="40" y="36">${escapeXml(title)}</text><text class="note" x="40" y="60">${escapeXml(description)}</text>${body}<text class="note" x="40" y="865">Source inspection at pinned revisions · candidate implementations excluded · path feasibility not checked</text><text class="note" x="40" y="890">Amber marks unresolved implementation or policy. Collapsed groups retain operation identities and expansion details.</text></svg>`;
}

function groupFor(record: string): Group | undefined {
  return GROUPS.find((group) => group.operations.some((operation) => `r1/${operation}` === record));
}

function point(x: number, y: number): string {
  return `${String(x)} ${String(y)}`;
}

function connectorPath(from: Group, to: Group): string {
  if (from.x === to.x) return `M${point(from.x + 160, from.y + 60)} L${point(to.x + 160, to.y)}`;
  if (to.x < from.x) return `M${point(from.x, from.y + 30)} L${point(to.x + 320, to.y + 30)}`;
  const start = point(from.x + 320, from.y + 30);
  const end = point(to.x, to.y + 30);
  if (from.y === to.y) return `M${start} L${end}`;
  return `M${start} L${point(from.x + 360, from.y + 30)} L${point(from.x + 360, to.y + 30)} L${end}`;
}

function groupNote(group: Group, count: number, unresolved: boolean): string {
  if (unresolved) return 'Implementation unresolved; continuation conditional';
  if (group.operations.includes(CONTROLLER_ENTRY)) {
    return 'Role declared; effective middleware unresolved';
  }
  return `${String(count)} operations · inspect for branches and evidence`;
}

function connectors(result: QueryResponse): string {
  const byNode = new Map(result.nodes.map((node) => [node.id, groupFor(node.record)]));
  const drawn = new Set<string>();
  return result.edges
    .map((edge) => {
      const from = byNode.get(edge.from);
      const to = byNode.get(edge.to);
      if (from === undefined || to === undefined || from === to) return '';
      const id = `${from.label}/${to.label}`;
      if (drawn.has(id)) return '';
      drawn.add(id);
      return `<path class="edge ${edge.assumption === null ? '' : 'uncertain'}" d="${connectorPath(from, to)}" marker-end="url(#arrow)"><title>${escapeXml(edge.condition ?? edge.on)}</title></path>`;
    })
    .join('');
}

export function captureControlDrawing(result: QueryResponse): string {
  for (const node of result.nodes) {
    if (groupFor(node.record) === undefined) {
      throw new Error(`Unrepresented operation ${node.record}`);
    }
  }
  const nodes = GROUPS.map((group) => {
    const members = result.nodes.filter((node) => groupFor(node.record) === group);
    const unresolved = result.frontiers.some((frontier) =>
      members.some((node) => node.id === frontier.at),
    );
    const policy = group.operations.includes(CONTROLLER_ENTRY);
    const note = groupNote(group, members.length, unresolved);
    const detail = members.map((node) => node.label).join('\n');
    return `<g><title>${escapeXml(detail)}</title><rect class="node ${unresolved || policy ? 'gap' : ''}" x="${String(group.x)}" y="${String(group.y)}" width="320" height="60" rx="8"/><text class="label" x="${String(group.x + 14)}" y="${String(group.y + 24)}">${escapeXml(group.label)}</text><text class="note" x="${String(group.x + 14)}" y="${String(group.y + 44)}">${escapeXml(note)}</text></g>`;
  }).join('');
  return frame(
    'Volvo capture · control flow',
    `${String(result.nodes.length)} contextual operations collapsed into ${String(GROUPS.length)} groups. 202 does not establish provider completion.`,
    connectors(result) + nodes,
  );
}

export function captureValueDrawing(result: QueryResponse): string {
  const nodes = result.nodes.toReversed();
  const boxes = nodes
    .map(
      (node, index) =>
        `<g><rect class="node gap" x="${String(60 + index * 380)}" y="260" width="320" height="95" rx="8"/><text class="label" x="${String(75 + index * 380)}" y="290">${escapeXml(node.label.split(' (')[0] ?? node.label)}</text><text class="note" x="${String(75 + index * 380)}" y="315">${['Persisted shape: inherited field candidate', 'Mapped internal value', 'Explicit constructed assignment'][index] ?? 'Value definition'}</text><text class="note" x="${String(75 + index * 380)}" y="337">${escapeXml(node.record)}</text></g>`,
    )
    .join('');
  const lines = nodes
    .slice(1)
    .map(
      (_, index) =>
        `<path class="edge uncertain" d="M${String(380 + index * 380)} 307 L${String(440 + index * 380)} 307" marker-end="url(#arrow)"/>`,
    )
    .join('');
  return frame(
    'Volvo capture · provider reference',
    'One selected value journey. Exact inherited getter, builder and wire semantics remain unresolved.',
    `${
      boxes + lines
    }<text x="60" y="430">The assignment instruction is known. Effective wire output requires the exact imported artifacts.</text><text x="60" y="460">No physical database location is established by the committed Mongo configuration.</text>`,
  );
}
