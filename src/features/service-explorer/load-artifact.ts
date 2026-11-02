import type { ExplorerManifest } from '@/domain/service-explorer';

import { loadPackPage } from './load-pack';

export async function loadExplorerArtifact(input: {
  readonly base: string;
  readonly artifact: ExplorerManifest['artifacts'][number];
  readonly signal: AbortSignal;
}): Promise<unknown> {
  const raw =
    input.artifact.pack === undefined
      ? await readArtifact(input)
      : await loadPackPage(
          {
            base: input.base,
            file: input.artifact.file,
            pack: input.artifact.pack,
            signal: input.signal,
          },
          async (artifact) => readArtifact({ ...input, artifact }),
        );
  await verifyBytes(raw, input.artifact);
  return JSON.parse(raw);
}
async function readArtifact(input: {
  readonly base: string;
  readonly artifact: ExplorerManifest['artifacts'][number];
  readonly signal: AbortSignal;
}): Promise<string> {
  const response = await fetch(`${input.base}${input.artifact.file}`, {
    signal: input.signal,
    cache: 'force-cache',
  });
  if (!response.ok) throw new Error(`Explorer page returned ${String(response.status)}`);
  const raw = await response.text();
  await verifyBytes(raw, input.artifact);
  return raw;
}
async function verifyBytes(
  raw: string,
  artifact: ExplorerManifest['artifacts'][number],
): Promise<void> {
  const bytes = new TextEncoder().encode(raw);
  if (bytes.byteLength !== artifact.bytes || bytes.byteLength > 2_097_152) {
    throw new Error('Explorer page byte bound changed');
  }
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
  if (digest !== artifact.sha256) throw new Error('Explorer page checksum changed');
}
