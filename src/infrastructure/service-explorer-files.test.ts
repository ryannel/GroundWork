import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { explorerFixture, explorerManifestFixture } from '@/../test/service-explorer-kit';

import { readExplorerManifest, readExplorerPage } from './service-explorer-files';
import { parseExplorerManifest } from './service-explorer-format';

vi.mock(import('server-only'), () => ({}));
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map(async (folder) => rm(folder, { recursive: true, force: true })),
  );
});
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'explorer-files-'));
  directories.push(root);
  const folder = path.join(root, 'acme');
  const output = path.join(folder, 'explorer');
  await mkdir(output, { recursive: true });
  await writeFile(path.join(folder, 'workspace.yaml'), 'id: acme\n');
  const raw = JSON.stringify(explorerFixture());
  const artifact = {
    file: 'flow.json',
    bytes: Buffer.byteLength(raw),
    sha256: createHash('sha256').update(raw).digest('hex'),
  };
  const manifest = explorerManifestFixture([artifact]);
  await writeFile(path.join(output, 'flow.json'), raw);
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest));
  return { root, output, raw, manifest };
}
describe('immutable explorer publication', () => {
  it('serves only bounded manifest-selected pages for the requested workspace', async () => {
    const item = await fixture();
    await expect(readExplorerManifest('acme', item.root)).resolves.toEqual(item.manifest);
    const page = await readExplorerPage('acme', 'flow.json', item.root);
    expect(page?.toString()).toBe(item.raw);
    await expect(readExplorerPage('acme', 'other.json', item.root)).resolves.toBeNull();
    await expect(readExplorerManifest('absent', item.root)).resolves.toBeNull();
  });
  it('rejects checksum mutations, symlinks and path traversal', async () => {
    const item = await fixture();
    await writeFile(
      path.join(item.output, 'flow.json'),
      item.raw.replace('Source guard', 'Other branch'),
    );
    await expect(readExplorerPage('acme', 'flow.json', item.root)).rejects.toThrow('checksum');
    await rm(path.join(item.output, 'flow.json'));
    await symlink(path.join(item.output, 'manifest.json'), path.join(item.output, 'flow.json'));
    await expect(readExplorerPage('acme', 'flow.json', item.root)).rejects.toThrow('regular-file');
    await expect(readExplorerPage('acme', '../manifest.json', item.root)).rejects.toThrow(
      /Invalid/u,
    );
  });
  it('rejects extra keys, missing selected artifacts and duplicate components', () => {
    const manifest = explorerManifestFixture([]);
    expect(() => parseExplorerManifest(manifest)).toThrow('missing');
    expect(() => parseExplorerManifest({ ...manifest, extra: true })).toThrow(/Unrecognized/u);
    expect(() =>
      parseExplorerManifest({
        ...manifest,
        artifacts: [{ file: 'flow.json', bytes: 10, sha256: 'a'.repeat(64) }],
        services: [...manifest.services, ...manifest.services],
      }),
    ).toThrow('Duplicate');
  });
});
