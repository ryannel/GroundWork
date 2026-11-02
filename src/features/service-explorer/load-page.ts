import { explorerArtifactIndex } from '@/domain/explorer-artifact-index';
import { checkedExplorerIndex } from '@/domain/explorer-publication-check';
import type { ExplorerManifest, ExplorerPage } from '@/domain/service-explorer';
import { explorerPage } from '@/domain/service-explorer-check';

import { loadExplorerArtifact } from './load-artifact';

export async function loadExplorerPage(input: {
  readonly manifest: ExplorerManifest;
  readonly base: string;
  readonly file: string;
  readonly signal: AbortSignal;
}): Promise<ExplorerPage> {
  let artifact = input.manifest.artifacts.find((item) => item.file === input.file);
  if (artifact === undefined) {
    const index = explorerArtifactIndex(input.manifest, input.file);
    if (index !== undefined) {
      const records = checkedExplorerIndex(
        await loadExplorerArtifact({ base: input.base, artifact: index, signal: input.signal }),
        input.manifest.snapshot,
      );
      artifact = records.find((item) => item.file === input.file);
    }
  }
  if (!artifact) throw new Error('Page is outside the selected explorer manifest');
  if (artifact.bytes > 65_536) throw new Error('Explorer page exceeds its byte bound');
  const page = explorerPage(
    await loadExplorerArtifact({ base: input.base, artifact, signal: input.signal }),
  );
  if (page.snapshot !== input.manifest.snapshot) throw new Error('Explorer snapshot changed');
  return page;
}
