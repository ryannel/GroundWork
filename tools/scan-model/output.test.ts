import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, it, vi } from 'vitest';

import { readModelFolder } from '@/infrastructure/read-model';

import { publishScan } from './output';

vi.mock(import('server-only'), () => ({}));

it('rejects a copied symlink without altering its target or publishing a partial candidate', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'scan-output-'));
  const model = await readModelFolder('test/fixtures/model', 'model-fixture');
  try {
    const folder = path.join(root, 'source');
    const out = path.join(root, 'candidate');
    const outside = path.join(root, 'original.jsonl');
    await mkdir(folder);
    await writeFile(outside, 'original contents\n');
    await symlink(outside, path.join(folder, 'sources.jsonl'));
    const writes = new Map([['sources.jsonl', 'changed contents\n']]);
    await expect(publishScan({ folder, out, before: model, writes })).rejects.toThrow(
      /not a regular file/u,
    );
    await expect(readFile(outside, 'utf8')).resolves.toBe('original contents\n');
    await expect(readFile(path.join(out, 'sources.jsonl'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
