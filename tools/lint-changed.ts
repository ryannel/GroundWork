// Lints only what changed: the files given, or every file git sees as changed or new.
// A changed CSS module relints its component, because that is where its classes are checked.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const LINTED = /\.(?:ts|tsx|mts|mjs)$/u;

function git(args: readonly string[]): string[] {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(
      result.error?.message ??
        (result.stderr === '' ? 'Cannot read changed Git files.' : result.stderr),
    );
  }
  return result.stdout.split('\0').filter((file) => file !== '');
}

function changedFiles(): string[] {
  return [
    ...git(['diff', '--name-only', '--diff-filter=d', '-z', 'HEAD']),
    ...git(['ls-files', '--others', '--exclude-standard', '-z']),
  ];
}

function componentsOf(css: string): string[] {
  const base = css.replace(/\.module\.css$/u, '');
  return [`${base}.tsx`, `${base}.client.tsx`].filter((file) => existsSync(file));
}

const ESLINT_ARGS = [
  'node_modules/eslint/bin/eslint.js',
  '--concurrency',
  'off',
  '--max-warnings',
  '0',
  '--no-warn-ignored',
];

function lint(): void {
  const given = process.argv.slice(2);
  const changed = given.length > 0 ? given : changedFiles();
  const policy = changed.some((file) =>
    /^(?:eslint\.config\.mjs|eslint\/.*|tsconfig[^/]*\.json|package(?:-lock)?\.json)$/u.test(file),
  );
  const files = changed.flatMap((file) =>
    file.endsWith('.module.css') ? componentsOf(file) : [file],
  );
  const targets = policy
    ? ['.']
    : [...new Set(files.filter((file) => LINTED.test(file) && existsSync(file)))];
  if (targets.length === 0) {
    console.log('Nothing to lint.');
    return;
  }
  // ESLint's file cache cannot see a component's imported CSS or changes to its type dependencies.
  const cache =
    policy || changed.some((file) => file.endsWith('.module.css'))
      ? ['--no-cache']
      : [
          '--cache',
          '--cache-strategy',
          'content',
          '--cache-location',
          'node_modules/.cache/eslint/',
        ];
  const eslint = spawnSync(process.execPath, [...ESLINT_ARGS, ...cache, '--', ...targets], {
    stdio: 'inherit',
  });
  if (eslint.error !== undefined) throw eslint.error;
  process.exitCode = eslint.status ?? 1;
}

try {
  lint();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
