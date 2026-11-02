import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { checkedExplorerIndex } from '@/domain/explorer-publication-check';
import type {
  ExplorerArtifact,
  ExplorerCatalogue,
  ExplorerManifest,
} from '@/domain/service-explorer';
import { explorerPage } from '@/domain/service-explorer-check';
import { sourceDigest } from '@/infrastructure/scan/source-index';
import { parseExplorerManifest } from '@/infrastructure/service-explorer-format';

import { explorerPackWriter } from './pack-explorer-writer';
import { writeExplorerJson } from './publish-explorer-pages';

export async function packExplorerRepository(
  selection: ExplorerCatalogue['selections'][number],
  roots: { readonly source: string; readonly output: string },
): Promise<ExplorerCatalogue['selections'][number]> {
  const raw = await readChecked(roots.source, selection.manifest);
  const manifest = parseExplorerManifest(JSON.parse(raw));
  const buckets = await readBuckets(roots.source, manifest);
  const artifacts = [...buckets.values()].flat();
  const packed = await packPages(roots, artifacts);
  const indexWriter = explorerPackWriter(roots.output);
  for (const index of manifest.artifactIndexes ?? []) {
    const items = (buckets.get(index.bucket) ?? []).map(
      (artifact) => packed.get(artifact.file) ?? artifact,
    );
    const body = JSON.stringify({
      format: 'service-explorer-index/v1',
      snapshot: manifest.snapshot,
      artifacts: items,
    });
    await indexWriter.add(
      { file: index.file, bytes: Buffer.byteLength(body), sha256: sourceDigest(body) },
      body,
    );
  }
  const packedIndexes = await indexWriter.finish();
  const artifactIndexes = (manifest.artifactIndexes ?? []).map((index) => ({
    ...index,
    ...packedIndexes.get(index.file),
  }));
  const updated = parseExplorerManifest({ ...manifest, artifacts: [], artifactIndexes });
  const reference = await writeExplorerJson(roots.output, selection.manifest.file, updated);
  process.stdout.write(
    `${selection.service.repo} · ${String(artifacts.length)} logical pages packed\n`,
  );
  return { ...selection, manifest: reference };
}
async function packPages(
  roots: { readonly source: string; readonly output: string },
  artifacts: readonly ExplorerArtifact[],
): Promise<ReadonlyMap<string, ExplorerArtifact>> {
  const writer = explorerPackWriter(roots.output);
  for (let offset = 0; offset < artifacts.length; offset += 64) {
    const batch = artifacts.slice(offset, offset + 64);
    const pages = await Promise.all(
      batch.map(async (artifact) => normalisePage(await readChecked(roots.source, artifact))),
    );
    for (const [index, page] of pages.entries()) {
      const artifact = batch[index];
      if (artifact === undefined) throw new Error('Packing selection changed');
      await writer.add(
        { file: artifact.file, bytes: Buffer.byteLength(page), sha256: sourceDigest(page) },
        page,
      );
    }
  }
  return await writer.finish();
}
async function readChecked(root: string, artifact: ExplorerArtifact): Promise<string> {
  const raw = await readFile(path.join(root, artifact.file), 'utf8');
  if (Buffer.byteLength(raw) !== artifact.bytes || sourceDigest(raw) !== artifact.sha256) {
    throw new Error(`Packing input changed: ${artifact.file}`);
  }
  return raw;
}
async function readBuckets(
  root: string,
  manifest: ExplorerManifest,
): Promise<ReadonlyMap<string, readonly ExplorerArtifact[]>> {
  const buckets = new Map<string, readonly ExplorerArtifact[]>();
  const indexes = await Promise.all(
    (manifest.artifactIndexes ?? []).map(async (index) => ({
      bucket: index.bucket,
      artifacts: checkedExplorerIndex(
        JSON.parse(await readChecked(root, index)),
        manifest.snapshot,
      ),
    })),
  );
  for (const index of indexes) buckets.set(index.bucket, index.artifacts);
  return buckets;
}
function normalisePage(raw: string): string {
  const page = explorerPage(JSON.parse(raw));
  if (page.kind !== 'callers' && !page.title.startsWith('Used in code ·')) return raw;
  return JSON.stringify({
    ...page,
    title: page.title.replace('Used in code ·', 'Published references ·'),
    description:
      'Navigation references visible in bounded published frames. This is not an exhaustive source-reference or caller query.',
    completeSelection: false,
    gaps: [
      ...page.gaps,
      'Visual frames omit or leave some source evidence unexpanded. These references are a publication aid, not an authoritative relationship index.',
    ],
  });
}
