import { corpusIndexPages } from '@/application/scan-explorer/corpus-index-pages';
import type {
  ExplorerNode,
  ExplorerPage,
  ExplorerService,
  ExplorerSource,
} from '@/domain/service-explorer';
import { sourceDigest } from '@/infrastructure/scan/source-index';

import { corpusPageFile } from './publish-explorer-pages';
import type { refinementStore } from './refine-explorer-store';

export async function refineSourceReferences(
  store: Awaited<ReturnType<typeof refinementStore>>,
  identity: { readonly service: ExplorerService; readonly snapshot: string },
): Promise<number> {
  const { incoming, titles, sources } = await readReferences(store);
  const fileFor = (id: string) => corpusPageFile(identity.service.repo, id);
  const targets: ExplorerNode[] = [];
  for (const [file, nodes] of incoming) {
    const id = `incoming:${file}`;
    const pages = corpusIndexPages({
      id,
      title: `Used in code · ${titles.get(file) ?? file}`,
      nodes,
      snapshot: identity.snapshot,
      sources,
      fileFor,
    });
    for (const page of pages) {
      await store.write(page.file, {
        ...page.page,
        gaps: [
          'Source references, including labelled candidates. These do not establish deployed callers or end-to-end execution.',
        ],
      });
    }
    const original = await store.read(file);
    await store.write(file, { ...original, incoming: fileFor(`${id}:0`) });
    targets.push({
      id: file,
      label: `${titles.get(file) ?? file} · ${String(nodes.length)} references`,
      detail:
        'Captured source references within this repository; deployment and caller/provider compatibility remain unverified.',
      kind: 'entry',
      sourceIds: [],
      target: fileFor(`${id}:0`),
    });
  }
  const pages = corpusIndexPages({
    id: 'source-references',
    title: 'Source references',
    nodes: targets,
    snapshot: identity.snapshot,
    fileFor,
  });
  for (const [index, page] of pages.entries()) {
    await store.write(index === 0 ? identity.service.callers : page.file, {
      ...page.page,
      kind: 'callers',
      gaps: [
        'Cross-repository service caller correspondence is not established. This index retains source-level references.',
      ],
    });
  }
  return incoming.size;
}
function collectReferences(
  from: { readonly page: ExplorerPage; readonly file: string },
  known: (file: string) => boolean,
): readonly { readonly target: string; readonly node: ExplorerNode }[] {
  return from.page.nodes.flatMap((node) => {
    if (node.target === null || node.target === from.file || !known(node.target)) return [];
    if (!['call', 'storage', 'message', 'async', 'schema'].includes(node.kind)) return [];
    const key = sourceDigest(`${from.file}:${node.id}`);
    return [
      {
        target: node.target,
        node: {
          id: `reference:${key}`,
          label: `${from.page.title} · ${node.label}`.slice(0, 220),
          detail: `${node.kind} source reference. ${node.detail}`.slice(0, 1200),
          kind: 'entry',
          sourceIds: node.sourceIds.slice(0, 1),
          target: from.file,
        },
      },
    ];
  });
}

async function readReferences(store: Awaited<ReturnType<typeof refinementStore>>): Promise<{
  readonly incoming: ReadonlyMap<string, readonly ExplorerNode[]>;
  readonly titles: ReadonlyMap<string, string>;
  readonly sources: ReadonlyMap<string, ExplorerSource>;
}> {
  const incoming = new Map<string, ExplorerNode[]>();
  const titles = new Map<string, string>();
  const sources = new Map<string, ExplorerSource>();
  for await (const { file, page } of refinementPages(store)) {
    titles.set(file, page.title);
    if (page.kind !== 'flow' && page.kind !== 'data') continue;
    for (const source of page.sources) sources.set(source.id, source);
    for (const item of collectReferences({ page, file }, store.has)) {
      const nodes = incoming.get(item.target) ?? [];
      nodes.push(item.node);
      incoming.set(item.target, nodes);
    }
  }
  return { incoming, titles, sources };
}

async function* refinementPages(
  store: Awaited<ReturnType<typeof refinementStore>>,
): AsyncGenerator<{ readonly file: string; readonly page: ExplorerPage }> {
  const files = store.files();
  for (let offset = 0; offset < files.length; offset += 32) {
    const pages = await Promise.all(
      files
        .slice(offset, offset + 32)
        .map(async (file) => ({ file, page: await store.read(file) })),
    );
    yield* pages;
  }
}
