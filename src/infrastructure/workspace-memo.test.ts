import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';

import { tempDir } from '@/../test/workspace-kit';

import { untilEdited } from './workspace-memo';

vi.mock(import('server-only'), () => ({}));

const root = await tempDir('workspace-memo-');
afterAll(async () => rm(root, { recursive: true, force: true }));
await mkdir(path.join(root, 'acme', '.git'), { recursive: true });
await writeFile(path.join(root, 'acme', 'workspace.yaml'), 'id: acme\n');

function counted(): { readonly reads: () => number; readonly read: () => Promise<string> } {
  let reads = 0;
  return {
    reads: () => reads,
    read: async () => {
      reads += 1;
      const answer = `read ${String(reads)}`;
      return await Promise.resolve(answer);
    },
  };
}

async function broken(): Promise<string> {
  await Promise.resolve();
  throw new Error('broken');
}

describe('untilEdited', () => {
  it('reads once while nothing changes', async () => {
    const remember = untilEdited<string>();
    const { reads, read } = counted();
    await expect(remember(root, 'k', read)).resolves.toBe('read 1');
    await expect(remember(root, 'k', read)).resolves.toBe('read 1');
    expect(reads()).toBe(1);
  });

  it('keeps each key apart', async () => {
    const remember = untilEdited<string>();
    const { reads, read } = counted();
    await remember(root, 'a', read);
    await remember(root, 'b', read);
    expect(reads()).toBe(2);
  });

  it('reads again once a file is edited or added', async () => {
    const remember = untilEdited<string>();
    const { reads, read } = counted();
    await remember(root, 'k', read);
    await writeFile(path.join(root, 'acme', 'workspace.yaml'), 'id: acme\nname: Acme\n');
    await expect(remember(root, 'k', read)).resolves.toBe('read 2');
    await writeFile(path.join(root, 'acme', 'flow.yaml'), 'id: f\n');
    await expect(remember(root, 'k', read)).resolves.toBe('read 3');
    expect(reads()).toBe(3);
  });

  it('ignores hidden folders such as .git', async () => {
    const remember = untilEdited<string>();
    const { reads, read } = counted();
    await remember(root, 'k', read);
    await writeFile(path.join(root, 'acme', '.git', 'HEAD'), 'ref: main\n');
    await remember(root, 'k', read);
    expect(reads()).toBe(1);
  });

  it('tries again after a read fails', async () => {
    const remember = untilEdited<string>();
    await expect(remember(root, 'k', broken)).rejects.toThrow('broken');
    await expect(remember(root, 'k', async () => await Promise.resolve('fixed'))).resolves.toBe(
      'fixed',
    );
  });
});
