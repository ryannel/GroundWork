import { readFile, readdir } from 'node:fs/promises';

import { sourceDigest } from '@/infrastructure/scan/source-index';

/** Query tooling is part of the interpretation; changing it invalidates persisted query plans. */
export async function entryCliDigest(): Promise<string> {
  const entries = await readdir(new URL('.', import.meta.url));
  const files = entries
    .filter(
      (file) =>
        (file === 'scan-bindings-pages.ts' ||
          /^scan-(?:entry-|spring-entry-).*\.ts$/u.test(file)) &&
        !file.includes('.test.'),
    )
    .toSorted((left, right) => left.localeCompare(right));
  const contents = await Promise.all(
    files.map(async (file) => [file, await readFile(new URL(file, import.meta.url), 'utf8')]),
  );
  return sourceDigest(JSON.stringify(contents));
}
