import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { explorerBucket } from '@/domain/explorer-artifact-index';
import type {
  ExplorerManifest,
  ExplorerPage,
  ExplorerArtifactIndex,
} from '@/domain/service-explorer';
import { explorerPage } from '@/domain/service-explorer-check';
import { sourceDigest } from '@/infrastructure/scan/source-index';

type Artifact = ExplorerManifest['artifacts'][number];
interface PageWriter {
  readonly has: (file: string) => boolean;
  readonly write: (file: string, page: ExplorerPage) => Promise<void>;
  readonly finish: () => Promise<readonly ExplorerArtifactIndex[]>;
  readonly count: () => number;
}
export function corpusPageFile(repo: string, id: string): string {
  const identity = `${repo}:${id}`;
  return `page-${sourceDigest(identity).slice(0, 24)}.json`;
}
export async function writeExplorerJson(
  output: string,
  file: string,
  data: unknown,
): Promise<Artifact> {
  const bytes = JSON.stringify(data);
  await writeFile(path.join(output, file), bytes);
  return { file, bytes: Buffer.byteLength(bytes), sha256: sourceDigest(bytes) };
}
export async function explorerPageWriter(
  output: string,
  identity: { readonly repo: string; readonly snapshot: string },
): Promise<PageWriter> {
  await mkdir(output, { recursive: true });
  const artifacts = new Map<string, Artifact>();
  const references = new Map<string, readonly string[]>();
  const write = async (file: string, page: ExplorerPage) => {
    if (artifacts.has(file)) return;
    explorerPage(page);
    if (page.snapshot !== identity.snapshot || Buffer.byteLength(JSON.stringify(page)) > 65_536) {
      throw new Error('Invalid corpus visual page bound or snapshot');
    }
    artifacts.set(file, await writeExplorerJson(output, file, page));
    references.set(
      file,
      page.nodes.flatMap((node) => (node.target === null ? [] : [node.target])),
    );
  };
  const finish = async () => {
    for (const [file, targets] of references) {
      if (targets.every((target) => artifacts.has(target))) continue;
      const original = explorerPage(JSON.parse(await readFile(path.join(output, file), 'utf8')));
      const page = {
        ...original,
        nodes: original.nodes.map((node) =>
          node.target !== null && !artifacts.has(node.target)
            ? {
                ...node,
                target: null,
                detail: `${node.detail} · Target implementation or schema was not published in this selected repository.`,
              }
            : node,
        ),
        completeSelection: false,
        gaps: [
          ...original.gaps,
          'Some cross-scope targets remain unresolved; their source declarations are retained.',
        ],
      };
      artifacts.set(file, await writeExplorerJson(output, file, explorerPage(page)));
    }
    return publishExplorerIndexes(output, identity, [...artifacts.values()]);
  };
  return { has: (file) => artifacts.has(file), write, finish, count: () => artifacts.size };
}
export async function publishExplorerIndexes(
  output: string,
  identity: { readonly repo: string; readonly snapshot: string },
  artifacts: readonly Artifact[],
): Promise<readonly ExplorerArtifactIndex[]> {
  const buckets = new Map<string, Artifact[]>();
  for (const artifact of artifacts) {
    const bucket = explorerBucket(artifact.file);
    if (bucket === null) throw new Error('Invalid corpus page name');
    const selected = buckets.get(bucket) ?? [];
    selected.push(artifact);
    buckets.set(bucket, selected);
  }
  const result: ExplorerArtifactIndex[] = [];
  for (const [bucket, selected] of buckets) {
    const file = `index-${sourceDigest(identity.repo).slice(0, 16)}-${bucket}.json`;
    const data = {
      format: 'service-explorer-index/v1',
      snapshot: identity.snapshot,
      artifacts: selected,
    };
    if (Buffer.byteLength(JSON.stringify(data)) > 2_097_152) {
      throw new Error('Corpus artifact index exceeds bound');
    }
    result.push({ bucket, ...(await writeExplorerJson(output, file, data)) });
  }
  return result;
}
