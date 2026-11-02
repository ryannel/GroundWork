import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { parseRescanRoster } from '@/infrastructure/scan/rescan-preflight-input';

import { scanRescanPreflight } from './scan-rescan-preflight';

vi.mock(import('server-only'), () => ({}));
function git(folder: string, args: readonly string[]): string {
  return execFileSync('/usr/bin/git', ['-C', folder, ...args], { encoding: 'utf8' }).trim();
}
describe('offline corpus preflight', () => {
  it('uses alternate pinned clones, excludes dirty worktree bytes and never reports semantic readiness', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'rescan-preflight-'));
    try {
      const fallback = path.join(directory, 'fallback');
      const clone = path.join(fallback, 'app');
      await mkdir(clone, { recursive: true });
      git(clone, ['init', '-q']);
      git(clone, ['config', 'user.name', 'Fixture']);
      git(clone, ['config', 'user.email', 'fixture@example.test']);
      await writeFile(path.join(clone, 'app.py'), 'def run(): return 1\n');
      git(clone, ['add', '.']);
      git(clone, ['commit', '-qm', 'Fixture']);
      const commit = git(clone, ['rev-parse', 'HEAD']);
      await writeFile(path.join(clone, 'dirty.rs'), 'dirty untracked file');
      const manifest = path.join(directory, 'roster.json');
      await writeFile(
        manifest,
        JSON.stringify({
          repositories: [
            { repo: 'example/app', commit },
            { repo: 'example/missing', commit },
          ],
        }),
      );
      const output = path.join(directory, 'report.json');
      await scanRescanPreflight([manifest, path.join(directory, 'clones'), output, fallback]);
      const report: unknown = JSON.parse(await readFile(output, 'utf8'));
      expect(report).toMatchObject({
        repositoryCount: 2,
        acceptanceStatus: 'blocked',
        repositories: [
          {
            repo: 'example/app',
            status: 'metadata_available',
            trackedFiles: 1,
            clone,
            languages: [{ language: 'python', files: 1, semantics: 'not_assessed' }],
          },
          { repo: 'example/missing', status: 'metadata_unavailable' },
        ],
      });
      await expect(scanRescanPreflight([manifest, directory, output])).rejects.toThrow('EEXIST');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it('rejects traversal and duplicate identities before any Git access', () => {
    expect(() =>
      parseRescanRoster({ repositories: [{ repo: '../app', commit: 'a'.repeat(40) }] }),
    ).toThrow('Invalid string');
    const repository = { repo: 'example/app', commit: 'a'.repeat(40) };
    expect(() => parseRescanRoster({ repositories: [repository, repository] })).toThrow(
      'Duplicate',
    );
  });
});
