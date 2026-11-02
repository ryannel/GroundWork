import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { scanRescanObjects } from './scan-rescan-objects';

vi.mock(import('server-only'), () => ({}));
function git(folder: string, args: readonly string[]): string {
  return execFileSync('/usr/bin/git', ['-C', folder, ...args], { encoding: 'utf8' }).trim();
}
describe('pinned object-header preflight', () => {
  it('checks parent commit/tree/blob headers and reports a missing blob without fetching or reading bodies', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'rescan-objects-'));
    try {
      const clone = path.join(directory, 'example', 'app');
      await mkdir(clone, { recursive: true });
      git(clone, ['init', '-q']);
      git(clone, ['config', 'user.name', 'Fixture']);
      git(clone, ['config', 'user.email', 'fixture@example.test']);
      await writeFile(path.join(clone, 'source.py'), 'raise RuntimeError("must never execute")\n');
      git(clone, ['add', '.']);
      git(clone, ['commit', '-qm', 'Fixture']);
      const commit = git(clone, ['rev-parse', 'HEAD']);
      const blob = git(clone, ['rev-parse', 'HEAD:source.py']);
      const roster = path.join(directory, 'roster.json');
      await writeFile(roster, JSON.stringify({ repositories: [{ repo: 'example/app', commit }] }));
      const first = path.join(directory, 'first.json');
      await scanRescanObjects([roster, directory, first]);
      const available: unknown = JSON.parse(await readFile(first, 'utf8'));
      expect(available).toMatchObject({
        status: 'all_declared_parent_repository_object_headers_available',
        repositories: [{ trackedBlobPaths: 1, checkedUniqueHeaders: 3, failures: [] }],
      });
      await rm(path.join(clone, '.git', 'objects', blob.slice(0, 2), blob.slice(2)));
      const second = path.join(directory, 'second.json');
      await scanRescanObjects([roster, directory, second]);
      const missing: unknown = JSON.parse(await readFile(second, 'utf8'));
      expect(missing).toMatchObject({
        status: 'local_object_availability_blocked',
        repositories: [
          {
            status: 'missing_or_invalid_local_objects',
            failures: [{ id: blob, type: 'missing', size: null, paths: ['source.py'] }],
          },
        ],
      });
      await expect(scanRescanObjects([roster, directory, second])).rejects.toThrow('EEXIST');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
