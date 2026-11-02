import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { sourceDigest } from '@/infrastructure/scan/source-index';

import { explorerPackWriter } from './pack-explorer-writer';

vi.mock(import('server-only'), () => ({}));

describe('immutable explorer packs', () => {
  it('bounds physical files, retains every logical member and reuses identical content', async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), 'explorer-packs-'));
    try {
      const writer = explorerPackWriter(folder);
      const raw = JSON.stringify({ content: 'x'.repeat(50_000) });
      for (let index = 0; index < 20; index += 1) {
        await writer.add(
          {
            file: `page-${String(index)}.json`,
            bytes: Buffer.byteLength(raw),
            sha256: sourceDigest(raw),
          },
          raw,
        );
      }
      const selected = await writer.finish();
      expect(selected.size).toBe(20);
      const files = await readdir(folder);
      expect(files).toHaveLength(2);
      for (const filename of files) {
        const bytes = await readFile(path.join(folder, filename));
        expect(bytes.length).toBeLessThanOrEqual(2_097_152);
        expect(filename).toBe(`pack-${sourceDigest(bytes.toString('utf8'))}.json`);
      }
      const repeated = explorerPackWriter(folder);
      for (const artifact of selected.values()) await repeated.add(artifact, raw);
      await expect(repeated.finish()).resolves.toEqual(selected);
      await expect(readdir(folder)).resolves.toEqual(files);
      expect(
        [...selected.values()].every(
          (artifact) => artifact.bytes === Buffer.byteLength(raw) && artifact.pack !== undefined,
        ),
      ).toBe(true);
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });
});
