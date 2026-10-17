// Mutation-tests only what changed: the pure-layer files given, or those git sees as changed against a base.
// With --base <ref> (CI: the pull request's target) it compares against that ref; without, against HEAD plus new files.
// A changed test file brings in the file it tests, so adding tests is enough to rerun the code they cover.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const MUTATED = /^src\/(?:domain|application|shared)\/.+(?<!\.test|\.generated)\.ts$/u;

function git(args: readonly string[]): string[] {
  return spawnSync('git', args, { encoding: 'utf8' })
    .stdout.split('\n')
    .filter((line) => line !== '');
}

function changedFiles(base: string | undefined): string[] {
  if (base !== undefined) {
    return git(['diff', '--name-only', '--diff-filter=d', `${base}...HEAD`]);
  }
  return [
    ...git(['diff', '--name-only', '--diff-filter=d', 'HEAD']),
    ...git(['ls-files', '--others', '--exclude-standard']),
  ];
}

function baseOf(args: readonly string[]): string | undefined {
  const at = args.indexOf('--base');
  return at === -1 ? undefined : args[at + 1];
}

const args = process.argv.slice(2);
const base = baseOf(args);
const given = base === undefined ? args : [];
const files = (given.length > 0 ? given : changedFiles(base)).map((file) =>
  file.endsWith('.test.ts') ? `${file.slice(0, -'.test.ts'.length)}.ts` : file,
);
const targets = [...new Set(files.filter((file) => MUTATED.test(file) && existsSync(file)))];

if (targets.length === 0) {
  console.log('Nothing to mutate.');
} else {
  const stryker = spawnSync(
    process.execPath,
    ['node_modules/@stryker-mutator/core/bin/stryker.js', 'run', '--mutate', targets.join(',')],
    { stdio: 'inherit' },
  );
  process.exitCode = stryker.status ?? 1;
}
