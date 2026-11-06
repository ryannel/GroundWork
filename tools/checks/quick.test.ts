import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it } from 'vitest';

const repo = path.resolve(import.meta.dirname, '../..');
const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});
it('records a complete checkpoint and checks it when the Git listing exceeds 1 MB', () => {
  const folder = mkdtempSync(path.join(tmpdir(), 'groundwork-checkpoint-'));
  folders.push(folder);
  mkdirSync(path.join(folder, 'src'));
  mkdirSync(path.join(folder, 'bin'));
  const source = 'export const example = 1;\n';
  writeFileSync(path.join(folder, 'src/example.ts'), source);
  writeFileSync(path.join(folder, 'src/final.ts'), `${source}// Final entry\n`);
  const capture = path.join(folder, 'git-output.mjs');
  writeFileSync(
    capture,
    "import { writeFileSync } from 'node:fs'; writeFileSync(1, 'src/example.ts\\0' + 'artifacts/recorded-response.json.gz\\0'.repeat(50_000) + 'src/final.ts\\0');\n",
  );
  writeFileSync(path.join(folder, 'bin/git'), '#!/bin/sh\nexec "$CHECK_NODE" "$CHECK_GIT"\n', {
    mode: 0o755,
  });
  const run = (argument: string) =>
    spawnSync(
      process.execPath,
      [
        '--import',
        path.join(repo, 'tools/register.ts'),
        path.join(repo, 'tools/checks/quick.ts'),
        ...(argument === '' ? [] : [argument]),
      ],
      {
        cwd: folder,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${path.join(folder, 'bin')}${path.delimiter}${process.env.PATH ?? ''}`,
          CHECK_NODE: process.execPath,
          CHECK_GIT: capture,
        },
        timeout: 10_000,
      },
    );
  const begin = run('--begin');
  expect(begin.status, begin.stdout + begin.stderr).toBe(0);
  const checkpoint: unknown = JSON.parse(
    readFileSync(path.join(folder, 'node_modules/.cache/groundwork-checks/baseline.json'), 'utf8'),
  );
  expect(checkpoint).toEqual({
    'src/example.ts': createHash('sha256').update(source).digest('hex'),
    'src/final.ts': createHash('sha256').update(`${source}// Final entry\n`).digest('hex'),
  });
  const quick = run('');
  expect(quick.status, quick.stdout + quick.stderr).toBe(0);
  expect(quick.stdout).toContain('No changes since the task checkpoint.');
});
