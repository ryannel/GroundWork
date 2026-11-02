import { corpusIndexPages } from '@/application/scan-explorer/corpus-index-pages';
import type { ExplorerNode, ExplorerPage, ExplorerService } from '@/domain/service-explorer';
import type { CorpusRepository } from '@/infrastructure/scan-explorer/corpus-catalogue';

import { corpusPageFile } from './publish-explorer-pages';
import type { refinementStore } from './refine-explorer-store';
import { writeRefinementPages } from './refine-explorer-write';

export async function refineSourceFiles(
  store: Awaited<ReturnType<typeof refinementStore>>,
  detail: CorpusRepository,
  identity: { readonly service: ExplorerService; readonly snapshot: string },
): Promise<number> {
  const inventory = capturedInventory(detail);
  const fileFor = (id: string) => corpusPageFile(detail.repo, id);
  const folders = await writeInventory(store, { detail, inventory }, identity.snapshot);
  const pagesToWrite: { readonly file: string; readonly page: ExplorerPage }[] = [];
  for (const [folder, children] of folders) {
    const nodes = [...children.values()].toSorted((left, right) =>
      left.label.localeCompare(right.label),
    );
    const id = folder === '' ? 'files' : `directory:${folder}`;
    const pages = corpusIndexPages({
      id,
      title: folder === '' ? 'Captured source files' : folder,
      nodes,
      snapshot: identity.snapshot,
      fileFor,
    });
    for (const page of pages) {
      pagesToWrite.push(page);
    }
  }
  await writeRefinementPages(store, pagesToWrite);
  const overview = await store.read(identity.service.overview);
  await store.write(identity.service.overview, {
    ...overview,
    nodes: overview.nodes.map((node) =>
      node.id === 'files' ? { ...node, label: `Captured files · ${String(inventory.size)}` } : node,
    ),
  });
  return inventory.size;
}
function folderNodes(
  item: { readonly filename: string; readonly target: string; readonly state: string },
  fileFor: (id: string) => string,
): readonly { readonly folder: string; readonly node: ExplorerNode }[] {
  const parts = item.filename.split('/');
  return parts.map((name, depth) => {
    const folder = parts.slice(0, depth).join('/');
    const child = parts.slice(0, depth + 1).join('/');
    const leaf = depth === parts.length - 1;
    return {
      folder,
      node: {
        id: child,
        label: leaf ? name : `${name}/`,
        detail: leaf ? item.state : 'Captured directory · open its files and subdirectories',
        kind: 'entry',
        sourceIds: [],
        target: leaf ? item.target : fileFor(`directory:${child}:0`),
      },
    };
  });
}
function capturedFilePage(
  detail: CorpusRepository,
  file: { readonly filename: string; readonly state: string },
  snapshot: string,
): ExplorerPage {
  const url = `https://github.com/${detail.repo}/blob/${detail.commit}/${file.filename.split('/').map(encodeURIComponent).join('/')}`;
  return {
    format: 'service-explorer-page/v1',
    snapshot,
    kind: 'overview',
    title: file.filename,
    description: `${file.state}. This inventory entry retains its pinned source; a function frame is not published for this file.`,
    nodes: [
      {
        id: 'captured-file',
        label: 'Open the captured source',
        detail: file.state,
        kind: 'schema',
        sourceIds: ['inventory-source'],
        target: null,
      },
    ],
    links: [],
    fields: [],
    sources: [{ id: 'inventory-source', label: file.filename, url }],
    gaps: [
      'No absence of declarations or behaviour is inferred. Declared schema records remain separately available in the schema index.',
    ],
    completeSelection: false,
  };
}

function capturedInventory(detail: CorpusRepository): ReadonlyMap<string, string> {
  const inventory = new Map(
    detail.scopes.flatMap((scope) => scope.files).map((file) => [file, 'parsed source']),
  );
  for (const file of detail.ancillary) inventory.set(file.path, file.state);
  return inventory;
}
async function writeInventory(
  store: Awaited<ReturnType<typeof refinementStore>>,
  input: { readonly detail: CorpusRepository; readonly inventory: ReadonlyMap<string, string> },
  snapshot: string,
): Promise<ReadonlyMap<string, ReadonlyMap<string, ExplorerNode>>> {
  const { detail, inventory } = input;
  const folders = new Map<string, Map<string, ExplorerNode>>();
  const pagesToWrite: { readonly file: string; readonly page: ExplorerPage }[] = [];
  const fileFor = (id: string) => corpusPageFile(detail.repo, id);
  for (const [filename, state] of inventory) {
    const existing = fileFor(`file:${filename}:0`);
    const target = store.has(existing) ? existing : fileFor(`captured-file:${filename}`);
    for (const child of folderNodes({ filename, target, state }, fileFor)) {
      const children = folders.get(child.folder) ?? new Map<string, ExplorerNode>();
      children.set(child.node.id, child.node);
      folders.set(child.folder, children);
    }
    if (!store.has(target)) {
      pagesToWrite.push({
        file: target,
        page: capturedFilePage(detail, { filename, state }, snapshot),
      });
    }
  }
  await writeRefinementPages(store, pagesToWrite);
  return folders;
}
