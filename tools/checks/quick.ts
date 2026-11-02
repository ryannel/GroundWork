// A task checkpoint is independent of Git commits and preserves all existing uncommitted work.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

import {
  affectsConfiguration,
  changed,
  maintained,
  needsScanner,
  parseSnapshot,
  snapshot,
} from './scope';

const CACHE = 'node_modules/.cache/groundwork-checks';
const BASELINE = `${CACHE}/baseline.json`;

function filesInGit(): string[] {
  const result = spawnSync(
    'git',
    ['-c', 'core.fsmonitor=false', 'ls-files', '-co', '--exclude-standard', '-z'],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr === '' ? 'Cannot read the Git file list.' : result.stderr);
  }
  return [...new Set(result.stdout.split('\0').filter(Boolean))];
}

function scopeOf(args: readonly string[]): string[] {
  const files = filesInGit();
  if (args.length > 0) {
    return [
      ...new Set(
        args.flatMap((given) => {
          const prefix = given.replace(/\/$/u, '');
          const matches = files.filter((file) => file === prefix || file.startsWith(`${prefix}/`));
          if (matches.length === 0) throw new Error(`No files match ${given}.`);
          return matches;
        }),
      ),
    ].filter(maintained);
  }
  if (!existsSync(BASELINE)) {
    throw new Error(
      'Run npm run check:begin before editing, or pass the files/folders to check:quick.',
    );
  }
  const value: unknown = JSON.parse(readFileSync(BASELINE, 'utf8'));
  return changed(parseSnapshot(value), snapshot(files));
}

function run(label: string, args: readonly string[]): void {
  const start = performance.now();
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  console.log(`${label}: ${((performance.now() - start) / 1000).toFixed(1)}s`);
  if (result.status !== 0) {
    throw new Error(`${label} failed (${String(result.status ?? result.signal)}).`);
  }
}

function check(files: readonly string[]): void {
  if (files.length === 0) {
    console.log('No changes since the task checkpoint.');
    return;
  }
  console.log(`Checking ${String(files.length)} task files.`);
  const present = files.filter(existsSync);
  const code = files.filter((file) => /\.(?:ts|tsx|mts|mjs|css)$/u.test(file));
  if (present.length > 0) {
    run('Format', [
      'node_modules/prettier/bin/prettier.cjs',
      '--check',
      '--ignore-unknown',
      ...present,
    ]);
  }
  const configuration = affectsConfiguration(files);
  if (configuration) console.log('Configuration changed: also run npm run check before handover.');
  if (code.length === 0) return;
  run('Lint', ['tools/lint-changed.ts', ...code]);
  const css = present.filter((file) => file.endsWith('.css'));
  if (css.length > 0) run('Styles', ['node_modules/stylelint/bin/stylelint.mjs', ...css]);
  run('Types', [
    'node_modules/typescript/bin/tsc',
    '--noEmit',
    '--project',
    needsScanner(files) || configuration || files.some((file) => /\.test\.tsx?$/u.test(file))
      ? 'tsconfig.json'
      : 'tsconfig.web.json',
  ]);
  const projects = ['--project', 'unit', '--project', 'integration'];
  if (needsScanner(files) || configuration) projects.push('--project', 'scanner');
  run('Related tests', [
    'node_modules/vitest/vitest.mjs',
    'related',
    '--run',
    ...projects,
    '--passWithNoTests',
    ...code,
  ]);
}

try {
  const args = process.argv.slice(2);
  if (args[0] === '--begin') {
    if (args.length !== 1) {
      throw new Error('check:begin takes no paths. Pass paths to check:quick instead.');
    }
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(BASELINE, `${JSON.stringify(snapshot(filesInGit()))}\n`);
    console.log('Task checkpoint saved. Existing edits remain untouched.');
  } else {
    check(scopeOf(args));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
