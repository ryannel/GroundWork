import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { checkedExplorerIndex } from '@/domain/explorer-publication-check';
import type { ExplorerManifest, ExplorerPage } from '@/domain/service-explorer';
import { explorerPage } from '@/domain/service-explorer-check';
import { sourceDigest } from '@/infrastructure/scan/source-index';
import { parseExplorerManifest } from '@/infrastructure/service-explorer-format';

import { publishExplorerIndexes, writeExplorerJson } from './publish-explorer-pages';

interface RefinementStore {
  readonly files: () => readonly string[];
  readonly has: (file: string) => boolean;
  readonly read: (file: string) => Promise<ExplorerPage>;
  readonly write: (file: string, page: ExplorerPage) => Promise<void>;
  readonly finish: () => Promise<ExplorerManifest>;
}
export async function refinementStore(
  output: string,
  manifest: ExplorerManifest,
): Promise<RefinementStore> {
  const artifacts = new Map(manifest.artifacts.map((artifact) => [artifact.file, artifact]));
  for (const index of manifest.artifactIndexes ?? []) {
    const bytes = await readFile(path.join(output, index.file), 'utf8');
    if (sourceDigest(bytes) !== index.sha256 || Buffer.byteLength(bytes) !== index.bytes) {
      throw new Error('Selected artifact index changed');
    }
    for (const artifact of checkedExplorerIndex(JSON.parse(bytes), manifest.snapshot)) {
      artifacts.set(artifact.file, artifact);
    }
  }
  const read = async (file: string) => {
    const artifact = artifacts.get(file);
    if (artifact === undefined) throw new Error('Unselected refinement page');
    const bytes = await readFile(path.join(output, file), 'utf8');
    if (sourceDigest(bytes) !== artifact.sha256 || Buffer.byteLength(bytes) !== artifact.bytes) {
      throw new Error(`Selected page changed: ${file}`);
    }
    return explorerPage(JSON.parse(bytes));
  };
  const write = async (file: string, page: ExplorerPage) => {
    explorerPage(page);
    if (Buffer.byteLength(JSON.stringify(page)) > 65_536 || page.snapshot !== manifest.snapshot) {
      throw new Error('Refined page bound or snapshot changed');
    }
    artifacts.set(file, await writeExplorerJson(output, file, page));
  };
  const finish = async () => {
    const service = manifest.services[0];
    if (service === undefined) throw new Error('Repository selection missing');
    const artifactIndexes = await publishExplorerIndexes(
      output,
      { repo: service.repo, snapshot: manifest.snapshot },
      [...artifacts.values()],
    );
    return parseExplorerManifest({ ...manifest, artifactIndexes });
  };
  return {
    files: () => [...artifacts.keys()],
    has: (file) => artifacts.has(file),
    read,
    write,
    finish,
  };
}
