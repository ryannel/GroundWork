// Stable, lossless snapshots. Arrays retain order because order can be part of what a view says.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';

import { isRecord } from '@/application/plan/ids';

const isMap = (value: unknown): value is ReadonlyMap<string, unknown> => value instanceof Map;
const isSet = (value: unknown): value is ReadonlySet<unknown> => value instanceof Set;

function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (isMap(value)) return ordered(Object.fromEntries(value));
  if (isSet(value)) return [...value].map(ordered);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .toSorted((a, b) => a.localeCompare(b))
      .map((key) => [key, ordered(value[key])]),
  );
}

export function serialise(value: unknown): string {
  const text = JSON.stringify(ordered(value), null, 2);
  return `${text}\n`;
}

export function digest(value: unknown): string {
  return createHash('sha256').update(serialise(value)).digest('hex');
}

export async function writeSnapshot(folder: string, file: string, value: unknown): Promise<string> {
  if (!/^[\w-]+\.json(?:\.gz)?$/u.test(file)) {
    throw new Error('A snapshot must use a JSON data file name inside its output folder.');
  }
  await mkdir(folder, { recursive: true });
  const body = serialise(value);
  await writeFile(path.join(folder, file), file.endsWith('.gz') ? gzipSync(body) : body);
  return createHash('sha256').update(body).digest('hex');
}

export async function readSnapshot(
  folder: string,
  file: string,
  expectedSha256?: string,
): Promise<unknown> {
  const body = await readFile(path.join(folder, file));
  const contents = file.endsWith('.gz') ? gunzipSync(body) : body;
  if (
    expectedSha256 !== undefined &&
    createHash('sha256').update(contents).digest('hex') !== expectedSha256
  ) {
    throw new Error(`Snapshot checksum does not match: ${file}`);
  }
  return JSON.parse(contents.toString('utf8'));
}

export interface Difference {
  readonly file: string;
  readonly path: string;
  readonly before: string;
  readonly after: string;
}

const pointer = (key: string): string => key.replaceAll('~', '~0').replaceAll('/', '~1');

const valueHash = (value: unknown): string =>
  digest({ present: value !== undefined, value: value ?? null });

/** Each changed JSON pointer is exact: approvals cannot conceal later, different changes. */
export function differences(file: string, before: unknown, after: unknown, at = ''): Difference[] {
  if (before === after) return [];
  if (before !== undefined && after !== undefined && serialise(before) === serialise(after)) {
    return [];
  }
  if (isRecord(before) && isRecord(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    return [...keys]
      .toSorted((a, b) => a.localeCompare(b))
      .flatMap((key) => differences(file, before[key], after[key], `${at}/${pointer(key)}`));
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const length = Math.max(before.length, after.length);
    return Array.from({ length }, (_, index) => index).flatMap((index) =>
      differences(file, before[index], after[index], `${at}/${String(index)}`),
    );
  }
  // Distinguish a missing value from null and from a literal string.
  return valueHash(before) === valueHash(after)
    ? []
    : [{ file, path: at, before: valueHash(before), after: valueHash(after) }];
}
