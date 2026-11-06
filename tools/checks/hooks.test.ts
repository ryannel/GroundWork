// Run the actual Lefthook configuration against staged files in an isolated Git repository.
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const repo = path.resolve(import.meta.dirname, '../..');
const folders: string[] = [];
const GIT_ENV = new Set([
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_COMMON_DIR',
  'GIT_PREFIX',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_IMPLICIT_WORK_TREE',
  'GIT_CONFIG_PARAMETERS',
]);
interface Fixture {
  readonly folder: string;
  readonly log: string;
  readonly env: NodeJS.ProcessEnv;
}
function fixture(fail = ''): Fixture {
  const folder = mkdtempSync(path.join(tmpdir(), 'groundwork-hooks-'));
  folders.push(folder);
  const bin = path.join(folder, 'bin');
  const log = path.join(folder, 'commands.jsonl');
  const capture = path.join(folder, 'capture.mjs');
  mkdirSync(bin);
  copyFileSync(path.join(repo, 'lefthook.yml'), path.join(folder, 'lefthook.yml'));
  writeFileSync(
    capture,
    String.raw`import { appendFileSync } from 'node:fs';
const args = process.argv.slice(2);
appendFileSync(process.env.HOOK_LOG, JSON.stringify(args) + '\n');
process.exitCode = args[0] === process.env.HOOK_FAIL ? 11 : 0;
`,
  );
  for (const name of ['node', 'npx', 'npm']) {
    writeFileSync(
      path.join(bin, name),
      `#!/bin/sh\nexec "$HOOK_NODE" "$HOOK_CAPTURE" ${name} "$@"\n`,
      { mode: 0o755 },
    );
  }
  const env: NodeJS.ProcessEnv = {
    ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !GIT_ENV.has(name))),
    NODE_ENV: process.env.NODE_ENV,
    PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`,
    HOOK_NODE: process.execPath,
    HOOK_CAPTURE: capture,
    HOOK_LOG: log,
    HOOK_FAIL: fail,
    LEFTHOOK: '1',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'core.fsmonitor',
    GIT_CONFIG_VALUE_0: 'false',
  };
  for (const args of [
    ['init', '--quiet'],
    ['add', '--', 'README.md'],
    [
      '-c',
      'user.name=Hook checks',
      '-c',
      'user.email=hooks@example.invalid',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '--quiet',
      '-m',
      'Initial fixture',
    ],
    ['add', '--', 'src', 'README.md'],
  ]) {
    if (args[0] === 'add') {
      mkdirSync(path.join(folder, 'src/ui'), { recursive: true });
      writeFileSync(path.join(folder, 'src/ui/example.ts'), 'export const example = 1;\n');
      writeFileSync(
        path.join(folder, 'src/ui/example.module.css'),
        '.example { display: block; }\n',
      );
      writeFileSync(
        path.join(folder, 'README.md'),
        args.length === 3 ? '# Initial\n' : '# Example\n',
      );
    }
    const result = spawnSync(
      'git',
      ['-c', `core.hooksPath=${path.join(folder, '.git/hooks')}`, ...args],
      { cwd: folder, env, encoding: 'utf8' },
    );
    if (result.status !== 0) throw new Error(result.stderr);
  }
  return { folder, log, env };
}
function runHook(
  files: Fixture,
  hook: string,
): { readonly status: number | null; readonly output: string } {
  const result = spawnSync(
    process.execPath,
    [path.join(repo, 'node_modules/lefthook/bin/index.js'), 'run', hook, '--no-auto-install'],
    {
      cwd: files.folder,
      env: files.env,
      encoding: 'utf8',
      timeout: 10_000,
    },
  );
  if (result.error !== undefined) throw result.error;
  return { status: result.status, output: result.stdout + result.stderr };
}
function commands(file: string): readonly (readonly string[])[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .trim()
    .split('\n')
    .map((line) => {
      const value: unknown = JSON.parse(line);
      if (!Array.isArray(value) || !value.every((arg: unknown) => typeof arg === 'string')) {
        throw new Error('Invalid captured command.');
      }
      return value;
    });
}
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

describe('the commit and push checks', () => {
  it('runs staged lint, styles and formatting without repeating types or tests at commit time', () => {
    const files = fixture();
    const run = runHook(files, 'pre-commit');
    expect(run.status, run.output).toBe(0);
    const called = commands(files.log);
    expect(called).toHaveLength(3);
    expect(
      called.some(
        (args) => args.includes('tools/lint-changed.ts') && args.includes('src/ui/example.ts'),
      ),
    ).toBe(true);
    expect(
      called.some(
        (args) => args.includes('stylelint') && args.includes('src/ui/example.module.css'),
      ),
    ).toBe(true);
    expect(called.some((args) => args.includes('prettier') && args.includes('README.md'))).toBe(
      true,
    );
  });
  it('still blocks a commit when a staged check fails', () => {
    const files = fixture('node');
    expect(runHook(files, 'pre-commit').status).not.toBe(0);
    expect(commands(files.log).some((args) => args.includes('tools/lint-changed.ts'))).toBe(true);
  });
  it('runs the complete existing check before push', () => {
    const files = fixture();
    const run = runHook(files, 'pre-push');
    expect(run.status, run.output).toBe(0);
    expect(commands(files.log)).toEqual([['npm', 'run', 'check']]);
  });
  it('blocks a push when the full check fails', () => {
    const files = fixture('npm');
    expect(runHook(files, 'pre-push').status).not.toBe(0);
    expect(commands(files.log)).toEqual([['npm', 'run', 'check']]);
  });
});
