import type { QueryResponse } from '@/domain/knowledge/knowledge.generated';

function escapeText(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
interface Group {
  readonly x: number;
  readonly y: number;
  readonly ids: readonly string[];
  readonly title: string;
  readonly detail: string;
  readonly tone: string;
}
function box(result: QueryResponse, group: Group): string {
  const operations = result.nodes.filter((node) => group.ids.includes(node.record));
  if (operations.length === 0) throw new Error(`Drawing group missing: ${group.title}`);
  const detail = operations.map((node) => `${node.record}: ${node.label}`).join('\n');
  return `<g tabindex="0"><title>${escapeText(detail)}</title><rect class="${group.tone}" x="${String(group.x)}" y="${String(group.y)}" width="338" height="70" rx="9"/><text class="title" x="${String(group.x + 16)}" y="${String(group.y + 28)}">${escapeText(group.title)}</text><text class="detail" x="${String(group.x + 16)}" y="${String(group.y + 51)}">${escapeText(group.detail)}</text></g>`;
}
function drawing(height: number, contents: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1320 ${String(height)}" role="img"><style>text{font-family:Arial,sans-serif;fill:#22384d}.heading{font-size:27px;font-weight:700}.sub{font-size:16px;fill:#53697d}.lane{font-size:17px;font-weight:700}.title{font-size:16px;font-weight:700}.detail{font-size:13px;fill:#4b6277}.note{font-size:14px;fill:#687683}.step{fill:#fff;stroke:#b8c8d5}.write{fill:#e9f4ef;stroke:#71a48c}.warn{fill:#fff3dd;stroke:#caa660}.async{fill:none;stroke:#967637;stroke-width:2;stroke-dasharray:7 5}.line{fill:none;stroke:#859aab;stroke-width:1.8}.band{fill:#e9eff4}g:focus rect{stroke:#225ea0;stroke-width:3}</style><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="#859aab"/></marker></defs><rect width="1320" height="${String(height)}" fill="#f4f7fa"/>${contents}</svg>`;
}

const GROUPS: readonly Group[] = [
  {
    x: 38,
    y: 165,
    ids: ['s2/http.start', 's2/http.map', 's2/add.identity'],
    title: 'Map input and generate identity',
    detail: 'Code defines deterministic Id; InternalId is separate',
    tone: 'step',
  },
  {
    x: 38,
    y: 275,
    ids: ['s2/http.add', 's2/add.stage', 's2/add.save', 's2/add.saved'],
    title: 'Stage entity → await database save',
    detail: 'TPC SoftOffer table · normal-return acknowledgement',
    tone: 'write',
  },
  {
    x: 38,
    y: 385,
    ids: ['s2/add.refetch', 's2/add.enabled'],
    title: 'Refetch row; notification enabled?',
    detail: 'Failed/no-data refetch or disabled → skip publish',
    tone: 'step',
  },
  {
    x: 38,
    y: 495,
    ids: [
      's2/add.notify',
      's2/notify.build',
      's2/notify.headers',
      's2/notify.send',
      's2/publish.serialise',
    ],
    title: 'Build SoftOfferCreated protobuf',
    detail: 'x-type = descriptor name · id = correlation ID',
    tone: 'step',
  },
  {
    x: 468,
    y: 495,
    ids: ['s2/publish.attempt'],
    title: 'Await ProduceAsync',
    detail: 'Null partition key · consumer is not awaited',
    tone: 'step',
  },
  {
    x: 468,
    y: 605,
    ids: ['s2/publish.receipt', 's2/publish.persisted', 's2/publish.not-persisted'],
    title: 'Inspect persistence report',
    detail: 'Persisted → log success · otherwise → log error',
    tone: 'warn',
  },
  {
    x: 38,
    y: 715,
    ids: [
      's2/http.201',
      's2/http.500',
      's2/http.409',
      's2/add.conflict',
      's2/add.error',
      's2/add.return',
      's2/notify.error',
      's2/notify.return',
      's2/publish.return',
      's2/publish.error',
    ],
    title: '201 Created or mapped HTTP error',
    detail: '201 does not establish publication or cache completion',
    tone: 'warn',
  },
  {
    x: 898,
    y: 165,
    ids: ['s2/consumer.receive', 's2/consumer.parse', 's2/consumer.map'],
    title: 'Filter, decode and project',
    detail: 'Matching x-type · require non-empty entity Id',
    tone: 'step',
  },
  {
    x: 898,
    y: 275,
    ids: [
      's2/consumer.list',
      's2/consumer.hot-read',
      's2/consumer.cold-exists',
      's2/consumer.cold-read',
      's2/consumer.hydrate',
      's2/consumer.deserialise',
      's2/consumer.empty',
      's2/consumer.upsert',
      's2/consumer.serialise',
    ],
    title: 'Read, replace by Id, serialise list',
    detail: 'Cold fallback hydrates Redis; Result ignored',
    tone: 'step',
  },
  {
    x: 898,
    y: 385,
    ids: ['s2/consumer.cold', 's2/consumer.cold-ok'],
    title: 'Overwrite cold list in blob storage',
    detail: 'container upstream-entities · /upstream-entities',
    tone: 'write',
  },
  {
    x: 898,
    y: 495,
    ids: ['s2/consumer.hot', 's2/consumer.hot-ok'],
    title: 'On cold success, update Redis',
    detail: 'key upstream-entities · wrapper Result success',
    tone: 'write',
  },
  {
    x: 898,
    y: 605,
    ids: ['s2/consumer.failed', 's2/consumer.done', 's2/consumer.exception'],
    title: 'Return Result; worker logs failure',
    detail: 'Offsets, retries and redelivery remain unresolved',
    tone: 'warn',
  },
];

export function softOfferDrawing(result: QueryResponse): string {
  const grouped = new Set(GROUPS.flatMap((group) => group.ids));
  const missing = result.nodes.filter((node) => !grouped.has(node.record));
  if (missing.length > 0) {
    throw new Error(`Ungrouped proof operations: ${missing.map((node) => node.record).join(', ')}`);
  }
  const lanes = [
    [38, 'HTTP request · Manage and Segment'],
    [468, 'Broker boundary'],
    [898, 'Possible continuation · Assortment'],
  ]
    .map(([x, label]) => `<text class="lane" x="${String(x)}" y="133">${String(label)}</text>`)
    .join('');
  const lines =
    '<path class="line" marker-end="url(#arrow)" stroke-dasharray="5 4" d="M38 420H18V750H38"/><text class="note" x="48" y="659">Skip publication</text><path class="line" marker-end="url(#arrow)" d="M207 235V275 M207 345V385 M207 455V495 M376 530H468 M637 565V605 M468 640H420V750H376 M1067 235V275 M1067 345V385 M1067 455V495 M1067 565V605"/><path class="async" marker-end="url(#arrow)" d="M806 530H846V200H898"/><text class="note" x="480" y="318">Possible delivery, separately rooted</text><text class="note" x="480" y="344">Source profiles + schemas match</text><text class="note" x="480" y="370">Effective deployment not established</text>';
  return drawing(
    1010,
    `<text class="heading" x="38" y="48">Create a soft offer</text><text class="sub" x="38" y="79">POST /api/commercial-items/soft-offers · committed production profiles · static source proof</text>${lanes}${lines}${GROUPS.map((group) => box(result, group)).join('')}<rect class="band" x="38" y="826" width="1198" height="140" rx="10"/><text class="title" x="58" y="855">Two failure windows; no shared transaction established</text><text class="sub" x="58" y="884">1. Database save → optional publish: a save can survive a skip, exception or non-persisted report.</text><text class="sub" x="58" y="912">2. Cold list → hot list: blob can change before Redis fails; concurrent whole-list updates are unresolved.</text><text class="note" x="58" y="942">${String(result.nodes.length)} contextual operations → 12 groups. Guards and source links remain in the query. Hydration is grouped; its ignored Result remains explicit.</text>`,
  );
}

export function softOfferValueDrawing(result: QueryResponse): string {
  const labels = [
    'Input Name',
    'Entity Name',
    'Re-read Name',
    'Notification Name',
    'Created protobuf Name',
    'Outgoing wire Name',
    'Decoded Name',
    'Cached Name',
  ];
  const nodes = [...result.nodes].toReversed();
  const groups = nodes.map((node, index) => {
    const x = 38 + (index % 4) * 310;
    const y = index < 4 ? 155 : 335;
    const detail = [node.id, node.context.join(' → ')].join('\n');
    return `<g tabindex="0"><title>${escapeText(detail)}</title><rect class="step" x="${String(x)}" y="${String(y)}" width="272" height="72" rx="9"/><text class="title" x="${String(x + 14)}" y="${String(y + 28)}">${escapeText(labels[index] ?? node.label)}</text><text class="detail" x="${String(x + 14)}" y="${String(y + 51)}">${index === 6 ? 'Across explicit asynchronous handoff' : 'Field-sensitive provenance'}</text></g>`;
  });
  return drawing(
    535,
    `<text class="heading" x="38" y="48">Follow one field: request Name → cached Name</text><text class="sub" x="38" y="80">${String(nodes.length)} values across three call frames and one asynchronous boundary</text><path class="line" marker-end="url(#arrow)" d="M310 191H348 M620 191H658 M930 191H968 M1240 191H1280V285H18V371H38 M310 371H348 M620 371H658 M930 371H968"/>${groups.join('')}<text class="note" x="38" y="468">Declared AutoMapper instruction remains qualified: effective imported mapper is unbound.</text><text class="note" x="38" y="496">Refetch assumes no intervening writer. Wire matching does not prove delivery; the selected field has its own context.</text>`,
  );
}
