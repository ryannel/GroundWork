import { visualBoundaryPage, isVisualBoundary } from '@/application/scan-explorer/visual-boundary';
import { visualFlow } from '@/application/scan-explorer/visual-flow';
import { visualSchema } from '@/application/scan-explorer/visual-schema';
import type { VisualContext } from '@/application/scan-explorer/visual-types';
import type { ExplorerCatalogue, ExplorerPage } from '@/domain/service-explorer';
import { sourceDigest } from '@/infrastructure/scan/source-index';
import {
  corpusDocuments,
  readCorpusDocument,
  type CorpusRepository,
} from '@/infrastructure/scan-explorer/corpus-catalogue';
import { readCorpusPurpose } from '@/infrastructure/scan-explorer/corpus-purpose';
import { parseExplorerManifest } from '@/infrastructure/service-explorer-format';

import { corpusVisualContext } from './publish-corpus-context';
import { corpusIndexes } from './publish-corpus-indexes';
import { corpusPageFile, explorerPageWriter, writeExplorerJson } from './publish-explorer-pages';

export async function publishCorpusRepository(
  detail: CorpusRepository,
  config: {
    readonly root: string;
    readonly output: string;
    readonly workspace: string;
    readonly snapshot: string;
    readonly name: string;
  },
): Promise<ExplorerCatalogue['selections'][number]> {
  const identity = {
    repo: detail.repo,
    commit: detail.commit,
    name: config.name,
    snapshot: config.snapshot,
    purpose: await readCorpusPurpose(config.root, detail),
    fileFor: (id: string) => corpusPageFile(detail.repo, id),
  };
  const indexes = corpusIndexes(identity);
  const writer = await explorerPageWriter(config.output, identity);
  const pending = new Map<string, ExplorerPage>();
  const documents = corpusDocuments(config.root, detail);
  for (const [position, ref] of documents.entries()) {
    const document = await readCorpusDocument(ref);
    const context = corpusVisualContext(document, identity);
    indexes.accept(context);
    await writeContext(context, writer, (file, page) => {
      pending.set(file, page);
    });
    if (position % 50 === 0) {
      process.stdout.write(
        `${detail.repo} · ${String(position + 1)}/${String(documents.length)} scopes · ${String(writer.count())} pages\n`,
      );
    }
  }
  for (const [file, page] of pending) await writer.write(file, page);
  for (const page of indexes.pages()) await writer.write(page.file, page.page);
  const artifactIndexes = await writer.finish();
  const service = indexes.service();
  const manifest = parseExplorerManifest({
    format: 'service-explorer/v1',
    workspace: config.workspace,
    snapshot: config.snapshot,
    services: [service],
    artifacts: [],
    artifactIndexes,
  });
  const reference = await writeExplorerJson(
    config.output,
    `manifest-${sourceDigest(detail.repo).slice(0, 24)}.json`,
    manifest,
  );
  process.stdout.write(
    `${detail.repo} · complete · ${String(writer.count())} pages · ${String(service.entryCount)} entries\n`,
  );
  return { service: { ...service, entries: [] }, manifest: reference };
}
async function writeContext(
  context: VisualContext,
  writer: Awaited<ReturnType<typeof explorerPageWriter>>,
  pending: (file: string, page: ExplorerPage) => void,
): Promise<void> {
  const fileFor = (id: string) => corpusPageFile(context.input.binding.repo, id);
  await writeMethods(context, writer, pending);
  for (const record of context.input.records) {
    const file = fileFor(record.id);
    if (writer.has(file)) continue;
    if (record.kind === 'schema_binding' || record.kind === 'contract') {
      await writer.write(file, visualSchema(context, record));
    }
    if (isVisualBoundary(record)) await writer.write(file, visualBoundaryPage(context, record));
  }
}

async function writeMethods(
  context: VisualContext,
  writer: Awaited<ReturnType<typeof explorerPageWriter>>,
  pending: (file: string, page: ExplorerPage) => void,
): Promise<void> {
  const fileFor = (id: string) => corpusPageFile(context.input.binding.repo, id);
  for (const node of context.functions?.values() ?? []) {
    const file = fileFor(node.source);
    if (!writer.has(file)) {
      await writer.write(file, visualFlow(context, node.source, node.name ?? node.source));
    }
  }
  for (const entry of context.entries) {
    if (!writer.has(fileFor(entry.source))) {
      pending(fileFor(entry.source), visualFlow(context, entry.source, entry.label));
    }
  }
}
