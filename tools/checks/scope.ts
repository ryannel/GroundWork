import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readlinkSync } from 'node:fs';

export type Snapshot = Readonly<Record<string, string>>;

/** Generated evidence stays on disk, but is not part of the source verification loop. */
export function maintained(file: string): boolean {
  return !file.startsWith('docs/scan-trials/') && !file.startsWith('artifacts/');
}

export function snapshot(files: readonly string[]): Snapshot {
  return Object.fromEntries(
    files
      .filter(maintained)
      .filter(existsSync)
      .map((file) => [
        file,
        createHash('sha256')
          .update(lstatSync(file).isSymbolicLink() ? readlinkSync(file) : readFileSync(file))
          .digest('hex'),
      ]),
  );
}

/** Include removals, so related tests and type checking can catch dangling imports. */
export function changed(before: Snapshot, after: Snapshot): string[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (file) => before[file] !== after[file],
  );
}

export function needsScanner(files: readonly string[]): boolean {
  return files.some((file) =>
    /^(?:tools\/|src\/(?:application|domain|shared|infrastructure)\/)/u.test(file),
  );
}

const CONFIGURATION_FILES = new Set([
  'package.json',
  'package-lock.json',
  'AGENTS.md',
  'lefthook.yml',
]);
const CONFIGURATION_PATTERNS = [
  /^tsconfig.*\.json$/u,
  /\.config\.(?:ts|mjs|js|json)$/u,
  /^vitest\..+\.ts$/u,
  /^\.[^/]+$/u,
  /^(?:eslint|test|\.github)\//u,
];

export function affectsConfiguration(files: readonly string[]): boolean {
  return files.some(
    (file) =>
      CONFIGURATION_FILES.has(file) || CONFIGURATION_PATTERNS.some((pattern) => pattern.test(file)),
  );
}

export function parseSnapshot(value: unknown): Snapshot {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Invalid task checkpoint.');
  }
  const entries: [string, unknown][] = Object.entries(value);
  const strings = entries.filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );
  if (strings.length !== entries.length) throw new Error('Invalid task checkpoint.');
  return Object.fromEntries(strings);
}
