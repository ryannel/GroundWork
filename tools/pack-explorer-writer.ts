import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ExplorerArtifact } from '@/domain/service-explorer';
import { sourceDigest } from '@/infrastructure/scan/source-index';

interface PackMember {
  readonly artifact: ExplorerArtifact;
  readonly raw: string;
}
interface PackWriter {
  readonly add: (artifact: ExplorerArtifact, raw: string) => Promise<void>;
  readonly finish: () => Promise<ReadonlyMap<string, ExplorerArtifact>>;
}
export function explorerPackWriter(output: string): PackWriter {
  const members: PackMember[] = [];
  const selected = new Map<string, ExplorerArtifact>();
  let bytes = 128;
  const flush = async () => {
    if (members.length === 0) return;
    const pending = members.splice(0);
    bytes = 128;
    for (const artifact of await writePack(output, pending)) selected.set(artifact.file, artifact);
  };
  const add = async (artifact: ExplorerArtifact, raw: string) => {
    const size = Buffer.byteLength(JSON.stringify([artifact.file, raw])) + 8;
    if (bytes + size > 900_000 || members.length >= 512) await flush();
    members.push({ artifact, raw });
    bytes += size;
  };
  const finish = async () => {
    await flush();
    return selected;
  };
  return { add, finish };
}
async function writePack(
  output: string,
  members: readonly PackMember[],
): Promise<readonly ExplorerArtifact[]> {
  const raw = JSON.stringify({
    format: 'service-explorer-pack/v1',
    pages: Object.fromEntries(members.map((member) => [member.artifact.file, member.raw])),
  });
  if (Buffer.byteLength(raw) > 2_097_152) throw new Error('Explorer pack exceeds byte bound');
  const sha256 = sourceDigest(raw);
  const pack = { file: `pack-${sha256}.json`, bytes: Buffer.byteLength(raw), sha256 };
  const filename = path.join(output, pack.file);
  await writeFile(filename, raw, { flag: 'wx' }).catch(async (error: unknown) => {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
    if (sourceDigest(await readFile(filename, 'utf8')) !== sha256) {
      throw new Error('Immutable explorer pack changed');
    }
  });
  return members.map((member) => ({ ...member.artifact, pack }));
}
