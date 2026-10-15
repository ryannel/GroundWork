// Lints only what changed: the files given, or every file git sees as changed or new.
// A changed CSS module relints its component, because that is where its classes are checked.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const LINTED = /\.(ts|tsx|mts|mjs)$/;

function git(args: readonly string[]): string[] {
  return spawnSync('git', args, { encoding: 'utf8' })
    .stdout.split('\n')
    .filter((line) => line !== '');
}

function changedFiles(): string[] {
  return [
    ...git(['diff', '--name-only', '--diff-filter=d', 'HEAD']),
    ...git(['ls-files', '--others', '--exclude-standard']),
  ];
}

function componentsOf(css: string): string[] {
  const base = css.replace(/\.module\.css$/, '');
  return [`${base}.tsx`, `${base}.client.tsx`].filter((file) => existsSync(file));
}

const given = process.argv.slice(2);
const files = (given.length > 0 ? given : changedFiles()).flatMap((file) =>
  file.endsWith('.module.css') ? componentsOf(file) : [file],
);
const targets = [...new Set(files.filter((file) => LINTED.test(file) && existsSync(file)))];

const ESLINT_ARGS = [
  'node_modules/eslint/bin/eslint.js',
  '--cache',
  '--cache-strategy',
  'content',
  '--cache-location',
  'node_modules/.cache/eslint/',
  '--max-warnings',
  '0',
  '--no-warn-ignored',
];

if (targets.length === 0) {
  console.log('Nothing to lint.');
} else {
  const eslint = spawnSync(process.execPath, [...ESLINT_ARGS, ...targets], { stdio: 'inherit' });
  process.exitCode = eslint.status ?? 1;
}
