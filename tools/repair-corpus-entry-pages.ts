import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { visualFlow } from '@/application/scan-explorer/visual-flow';
import type { ScanDocument } from '@/domain/scan/scan.generated';
import type { ExplorerCatalogue, ExplorerPage } from '@/domain/service-explorer';
import { sourceDigest } from '@/infrastructure/scan/source-index';
import {
  corpusDocuments,
  readCorpusDocument,
  type CorpusRepository,
} from '@/infrastructure/scan-explorer/corpus-catalogue';
import { parseExplorerManifest } from '@/infrastructure/service-explorer-format';

import { corpusVisualContext } from './publish-corpus-context';
import { writeExplorerJson } from './publish-explorer-pages';
import { refinementStore } from './refine-explorer-store';

type Selection = ExplorerCatalogue['selections'][number];
type Store = Awaited<ReturnType<typeof refinementStore>>;
interface RepairInput {
  readonly detail: CorpusRepository;
  readonly selection: Selection;
  readonly roots: { readonly root: string; readonly output: string; readonly snapshot: string };
}
interface PendingEntry {
  readonly file: string;
  readonly source: string;
  readonly path: string;
  readonly page: ExplorerPage;
}

export async function repairCorpusEntryPages(
  detail: CorpusRepository,
  selection: Selection,
  roots: { readonly root: string; readonly output: string; readonly snapshot: string },
): Promise<Selection> {
  const raw = await readFile(path.join(roots.output, selection.manifest.file), 'utf8');
  if (sourceDigest(raw) !== selection.manifest.sha256) {
    throw new Error('Entry repair manifest changed');
  }
  const manifest = parseExplorerManifest(JSON.parse(raw));
  const store = await refinementStore(roots.output, manifest);
  const pending = await pendingEntries(store, manifest.services[0]?.entries ?? []);
  if (pending.length === 0) return selection;
  const repaired = await repairDocuments({ detail, selection, roots }, pending, store);
  if (repaired === 0) return selection;
  const updated = await store.finish();
  const reference = await writeExplorerJson(roots.output, selection.manifest.file, updated);
  process.stdout.write(
    `${detail.repo} · ${String(repaired)} metadata-only entries replaced by captured method bodies\n`,
  );
  return { ...selection, manifest: reference };
}
async function repairDocuments(
  input: RepairInput,
  pending: readonly PendingEntry[],
  store: Store,
): Promise<number> {
  const { roots, detail, selection } = input;
  const documents = corpusDocuments(roots.root, detail);
  const metadata: ScanDocument[] = [];
  for (const ref of documents.filter((candidate) =>
    candidate.filename.endsWith('/metadata.json'),
  )) {
    metadata.push(await readCorpusDocument(ref));
  }
  let repaired = 0;
  for (const [index, scope] of detail.scopes.entries()) {
    const selected = pending.filter((entry) => scope.files.includes(entry.path));
    if (selected.length === 0) continue;
    const ref = documents.filter((candidate) => !candidate.program)[index];
    if (ref === undefined) throw new Error('Native scope selection changed');
    const native = await readCorpusDocument(ref);
    const merged = withMetadata(native, metadata);
    const context = corpusVisualContext(merged, { ...selection.service, snapshot: roots.snapshot });
    repaired += await repairScope(context, selected, store);
  }
  return repaired;
}
async function pendingEntries(
  store: Store,
  entries: Selection['service']['entries'],
): Promise<readonly PendingEntry[]> {
  const result: PendingEntry[] = [];
  for (const entry of entries) {
    const page = await store.read(entry.file);
    const pending = pendingEntry(page, entry.file);
    if (pending !== null) result.push(pending);
  }
  return result;
}
function pendingEntry(page: ExplorerPage, file: string): PendingEntry | null {
  if (!page.description.startsWith('Source entry declared;')) return null;
  const node = page.nodes.find((candidate) => candidate.kind === 'entry');
  const source = page.sources.find((candidate) => node?.sourceIds.includes(candidate.id) === true);
  if (node === undefined || source === undefined) return null;
  return { file, source: node.id, path: source.label.replace(/:\d+$/u, ''), page };
}
function withMetadata(native: ScanDocument, metadata: readonly ScanDocument[]): ScanDocument {
  return {
    ...native,
    sources: [...metadata.flatMap((item) => item.sources), ...native.sources],
    framework: [...metadata.flatMap((item) => item.framework ?? []), ...(native.framework ?? [])],
    bindings: [...metadata.flatMap((item) => item.bindings ?? []), ...(native.bindings ?? [])],
    contracts: [...metadata.flatMap((item) => item.contracts), ...native.contracts],
  };
}
async function repairScope(
  context: ReturnType<typeof corpusVisualContext>,
  entries: readonly PendingEntry[],
  store: Store,
): Promise<number> {
  let count = 0;
  for (const entry of entries) {
    if (context.functions?.has(entry.source) !== true) continue;
    const page = visualFlow(context, entry.source, entry.page.title);
    const missing = page.nodes.some((node) => node.target !== null && !store.has(node.target));
    await store.write(entry.file, {
      ...page,
      incoming: entry.page.incoming,
      nodes: page.nodes.map((node) =>
        node.target !== null && !store.has(node.target) ? { ...node, target: null } : node,
      ),
      completeSelection: page.completeSelection && !missing,
      gaps: missing
        ? [...page.gaps, 'Some target implementations are outside this publication.']
        : page.gaps,
    });
    count += 1;
  }
  return count;
}
