import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import { afterEach, expect, it, vi } from 'vitest';

import { retainedExplorerReader } from './retained-capture';

vi.mock(import('server-only'), () => ({}));
const folders: string[] = [];
afterEach(async () => {
  await Promise.all(
    folders.splice(0).map(async (folder) => rm(folder, { recursive: true, force: true })),
  );
});

it('keeps the canonical snapshot immutable when callers mutate delivered supporting records', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'retained-explorer-'));
  folders.push(folder);
  const fixture = 'test/fixtures/knowledge/notification';
  const bundlePath = path.join(folder, 'bundle.json.gz');
  await writeFile(bundlePath, gzipSync(await readFile(path.join(fixture, 'bundle.json'))));
  const reader = await retainedExplorerReader({
    bundlePath,
    snapshotPath: path.join(fixture, 'snapshot.json'),
  });
  const selected = reader.select('kind', 'evidence');
  const evidence = selected.find((record) => record.kind === 'evidence');
  if (evidence === undefined) throw new Error('Missing fixture evidence');
  const original = reader.get(evidence.id);
  evidence.path = 'mutated-by-consumer.ts';
  evidence.lines[0] = 999;
  expect(reader.get(evidence.id)).toEqual(original);
  const delivered = reader.get(evidence.id);
  if (delivered?.kind !== 'evidence') throw new Error('Missing delivered evidence');
  delivered.lines[1] = 1000;
  expect(reader.select('kind', 'evidence').find((record) => record.id === evidence.id)).toEqual(
    original,
  );
  expect(reader.get('missing')).toBeUndefined();
});
