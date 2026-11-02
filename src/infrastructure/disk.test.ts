import { appendFile, mkdir, open, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';

import { tempDir } from '@/../test/workspace-kit';

import {
  entryAt,
  listFolder,
  readBoundedBytes,
  readBytesIfAny,
  readTextIfAny,
  statOf,
} from './disk';

vi.mock(import('server-only'), () => ({}));
vi.mock(import('node:fs/promises'), async (original) => {
  const actual = await original();
  return { ...actual, open: vi.fn<typeof actual.open>(actual.open) };
});

const root = await tempDir('disk-');
afterAll(async () => rm(root, { recursive: true, force: true }));
const file = path.join(root, 'data.txt');
await writeFile(file, 'evidence');
const folder = path.join(root, 'folder');
await mkdir(folder);

describe('optional disk reads', () => {
  it('returns empty values only for missing paths', async () => {
    const missing = path.join(root, 'missing');
    await expect(readTextIfAny(missing)).resolves.toBeNull();
    await expect(readBytesIfAny(missing)).resolves.toBeNull();
    await expect(listFolder(missing)).resolves.toEqual([]);
    await expect(statOf(missing)).resolves.toBeNull();
    await expect(entryAt(missing)).resolves.toBeNull();
  });

  describe('bounded disk reads', () => {
    it('reads at the exact byte bound, including an empty file', async () => {
      await expect(readBoundedBytes(file, 8)).resolves.toEqual(Buffer.from('evidence'));
      await expect(readBoundedBytes(file, 100)).resolves.toEqual(Buffer.from('evidence'));
      const empty = path.join(root, 'empty');
      await writeFile(empty, '');
      await expect(readBoundedBytes(empty, 0)).resolves.toEqual(Buffer.alloc(0));
      await expect(readBoundedBytes(path.join(root, 'absent'), 8)).resolves.toBeNull();
    });

    it('rejects oversized files, directories, links and invalid bounds', async () => {
      await expect(readBoundedBytes(file, 7)).rejects.toThrow('regular-file byte bound');
      await expect(readBoundedBytes(folder, 100)).rejects.toThrow('regular-file byte bound');
      const link = path.join(root, 'linked-data');
      await symlink(file, link);
      await expect(readBoundedBytes(link, 100)).rejects.toThrow('regular-file byte bound');
      for (const maximum of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        await expect(readBoundedBytes(file, maximum)).rejects.toThrow('non-negative safe integer');
      }
    });

    it('bounds actual bytes even when a file grows after its size was checked, and closes it', async () => {
      const growing = path.join(root, 'growing');
      await writeFile(growing, 'small');
      const handle = await open(growing, 'r');
      const info = await handle.stat();
      const close = vi.spyOn(handle, 'close');
      vi.spyOn(handle, 'stat').mockImplementationOnce(async () => {
        await appendFile(growing, ' more bytes');
        return info;
      });
      vi.mocked(open).mockResolvedValueOnce(handle);
      await expect(readBoundedBytes(growing, 5)).rejects.toThrow('regular-file byte bound');
      expect(close).toHaveBeenCalled();
      await expect(handle.stat()).rejects.toMatchObject({ code: 'EBADF' });
    });
  });

  it('reads existing text, bytes and directory entries', async () => {
    await expect(readTextIfAny(file)).resolves.toBe('evidence');
    await expect(readBytesIfAny(file)).resolves.toEqual(Buffer.from('evidence'));
    const entries = await listFolder(root);
    const stats = await statOf(file);
    expect(entries.map((entry) => entry.name)).toContain('data.txt');
    expect(stats?.isFile()).toBe(true);
  });

  it('does not hide malformed paths as absent data', async () => {
    const invalid = path.join(file, 'child');
    await expect(readTextIfAny(invalid)).rejects.toMatchObject({ code: 'ENOTDIR' });
    await expect(readBytesIfAny(invalid)).rejects.toMatchObject({ code: 'ENOTDIR' });
    await expect(listFolder(file)).rejects.toMatchObject({ code: 'ENOTDIR' });
    await expect(statOf(invalid)).rejects.toMatchObject({ code: 'ENOTDIR' });
    await expect(entryAt(invalid)).rejects.toMatchObject({ code: 'ENOTDIR' });
  });
});
