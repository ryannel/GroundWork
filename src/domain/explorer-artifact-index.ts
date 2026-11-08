import type { ExplorerArtifactIndex, ExplorerManifest } from './service-explorer';

function explorerBucket(file: string): string | null {
  return /^page-[a-f\d]{24}\.json$/u.test(file) ? file.slice(5, 7) : null;
}

export function explorerArtifactIndex(
  manifest: ExplorerManifest,
  file: string,
): ExplorerArtifactIndex | undefined {
  const bucket = explorerBucket(file);
  return manifest.artifactIndexes?.find((index) => index.bucket === bucket);
}
