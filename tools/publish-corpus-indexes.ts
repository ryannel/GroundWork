import { corpusIndexPages } from '@/application/scan-explorer/corpus-index-pages';
import { visualBoundaries } from '@/application/scan-explorer/visual-boundaries';
import type { VisualContext } from '@/application/scan-explorer/visual-types';
import type { ExplorerNode, ExplorerPage, ExplorerService } from '@/domain/service-explorer';

interface CorpusIndex {
  readonly accept: (context: VisualContext) => void;
  readonly pages: () => readonly { readonly file: string; readonly page: ExplorerPage }[];
  readonly service: () => ExplorerService;
}
interface IndexIdentity {
  readonly repo: string;
  readonly commit: string;
  readonly name: string;
  readonly snapshot: string;
  readonly purpose: ExplorerService['purpose'];
  readonly fileFor: (id: string) => string;
}
function indexNode(id: string, label: string, target: string): ExplorerNode {
  return {
    id,
    label,
    target,
    kind: 'entry',
    detail: 'Captured source. Open the selected evidence.',
    sourceIds: [],
  };
}
export function corpusIndexes(identity: IndexIdentity): CorpusIndex {
  const entries = new Map<string, ExplorerService['entries'][number]>();
  const schemas = new Map<string, ExplorerNode>();
  const methods = new Map<string, Map<string, ExplorerNode>>();
  const boundaries = new Map<string, ExplorerNode>();
  const accept = (context: VisualContext) => {
    for (const entry of context.entries) {
      if (!entries.has(entry.id)) {
        entries.set(entry.id, {
          id: entry.id,
          label: entry.label,
          file: identity.fileFor(entry.source),
        });
      }
    }
    for (const node of schemaNodes(context, identity.fileFor)) schemas.set(node.id, node);
    for (const item of methodNodes(context, identity.fileFor)) {
      const members = methods.get(item.path) ?? new Map<string, ExplorerNode>();
      members.set(item.node.id, item.node);
      methods.set(item.path, members);
    }
    for (const node of visualBoundaries(context).nodes) {
      if (!boundaries.has(node.id)) boundaries.set(node.id, { ...node, sourceIds: [] });
    }
  };
  const service = (): ExplorerService => ({
    id: identity.repo.split('/').at(-1) ?? identity.repo,
    name: identity.name,
    repo: identity.repo,
    commit: identity.commit,
    purpose: identity.purpose,
    scope: 'repository',
    overview: identity.fileFor('overview'),
    callers: identity.fileFor('callers'),
    sourceIndex: identity.fileFor('files:0'),
    entryCount: entries.size,
    entries: [...entries.values()].slice(0, 500),
  });
  const pages = () =>
    publishIndexes(identity, {
      entries: [...entries.values()],
      schemas: [...schemas.values()],
      methods,
      boundaries: [...boundaries.values()],
    });
  return { accept, service, pages };
}
function publishIndexes(
  identity: IndexIdentity,
  collected: {
    readonly entries: ExplorerService['entries'];
    readonly schemas: readonly ExplorerNode[];
    readonly methods: ReadonlyMap<string, ReadonlyMap<string, ExplorerNode>>;
    readonly boundaries: readonly ExplorerNode[];
  },
): readonly { readonly file: string; readonly page: ExplorerPage }[] {
  const page = (id: string, title: string, nodes: readonly ExplorerNode[]) =>
    corpusIndexPages({ id, title, nodes, snapshot: identity.snapshot, fileFor: identity.fileFor });
  const files = [...collected.methods].toSorted(([left], [right]) => left.localeCompare(right));
  const methods = files.flatMap(([filename, nodes]) =>
    page(`file:${filename}`, filename, [...nodes.values()]),
  );
  const entries = collected.entries.map((entry) => indexNode(entry.id, entry.label, entry.file));
  const sources = files.map(([filename, nodes]) =>
    indexNode(
      filename,
      `${filename} · ${String(nodes.size)}`,
      identity.fileFor(`file:${filename}:0`),
    ),
  );
  return [
    ...methods,
    ...page('entries', 'API, consumer and job entries', entries),
    ...page('schemas', 'Declared schemas', collected.schemas),
    ...page('files', 'Source files', sources),
    ...page('boundaries', 'Calls and resources', collected.boundaries),
    ...summaryPages(identity, collected.boundaries, {
      entries: entries.length,
      schemas: collected.schemas.length,
      files: files.length,
    }),
  ];
}

function schemaNodes(
  context: VisualContext,
  fileFor: IndexIdentity['fileFor'],
): readonly ExplorerNode[] {
  return context.input.records.flatMap((record) => {
    if (record.kind !== 'schema_binding' && record.kind !== 'contract') return [];
    const label = record.kind === 'schema_binding' ? record.typeName : record.shape.spelling;
    return [{ ...indexNode(record.id, label, fileFor(record.id)), kind: 'schema' as const }];
  });
}
function methodNodes(
  context: VisualContext,
  fileFor: IndexIdentity['fileFor'],
): readonly { readonly path: string; readonly node: ExplorerNode }[] {
  return [...(context.functions?.values() ?? [])].flatMap((node) => {
    const source = context.sources?.get(node.source);
    return source === undefined
      ? []
      : [
          {
            path: source.path,
            node: indexNode(node.source, node.name ?? source.path, fileFor(node.source)),
          },
        ];
  });
}
function summaryPages(
  identity: IndexIdentity,
  boundaries: readonly ExplorerNode[],
  counts: { readonly entries: number; readonly schemas: number; readonly files: number },
): readonly { readonly file: string; readonly page: ExplorerPage }[] {
  const component = `repository:${identity.repo}`;
  const overviewNodes = [...summaryNodes(identity, counts), ...boundaries.slice(0, 12)];
  const base: ExplorerPage = {
    format: 'service-explorer-page/v1',
    snapshot: identity.snapshot,
    kind: 'overview',
    title: identity.name,
    description:
      'Captured repository scope. Source membership does not establish one deployed service.',
    nodes: overviewNodes,
    links: boundaries.slice(0, 12).map((node) => ({
      id: `boundary:${node.id}`,
      from: component,
      to: node.id,
      label: 'Source-declared call or resource',
      kind: 'interaction',
      sourceIds: [],
    })),
    fields: [],
    sources: [],
    completeSelection: false,
    gaps: [
      'This is source evidence, not a deployment boundary. Open All calls and resources for the complete captured index.',
    ],
  };
  return [
    { file: identity.fileFor('overview'), page: base },
    {
      file: identity.fileFor('callers'),
      page: {
        ...base,
        kind: 'callers',
        title: 'Callers',
        nodes: [],
        links: [],
        description:
          'Complete cross-repository caller correspondence is not established by this capture.',
        gaps: [
          'No absence of callers is inferred. Calls and resources preserves declared call boundaries.',
        ],
      },
    },
  ];
}

function summaryNodes(
  identity: IndexIdentity,
  counts: { readonly entries: number; readonly schemas: number; readonly files: number },
): readonly ExplorerNode[] {
  const component = `repository:${identity.repo}`;
  return [
    { ...indexNode(component, identity.name, identity.fileFor('files:0')), kind: 'component' },
    indexNode(
      'entries',
      `API, consumer and job entries · ${String(counts.entries)}`,
      identity.fileFor('entries:0'),
    ),
    {
      ...indexNode(
        'schemas',
        `Declared schemas · ${String(counts.schemas)}`,
        identity.fileFor('schemas:0'),
      ),
      kind: 'schema',
    },
    {
      ...indexNode('files', `Source files · ${String(counts.files)}`, identity.fileFor('files:0')),
      kind: 'schema',
    },
    {
      ...indexNode(
        'boundaries',
        `All calls and resources · captured`,
        identity.fileFor('boundaries:0'),
      ),
      kind: 'schema',
    },
  ];
}
