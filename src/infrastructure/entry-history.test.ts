import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import type { HistoricalScope } from '@/application/entry-history';

import { readEntryHistory } from './entry-history';

vi.mock(import('server-only'), () => ({}));

const format = 'groundwork-entry-history/v1';
const repo = 'acme/orders';
const live = 'a'.repeat(40);
const old = 'b'.repeat(40);
const oldPage = `page-${'b'.repeat(24)}.json`;
const livePage = `page-${'a'.repeat(24)}.json`;
const record = (raw: string | Buffer) => ({
  bytes: Buffer.byteLength(raw),
  sha256: createHash('sha256').update(raw).digest('hex'),
});
let workspace: string;
let archive: string;
let oldPack: string;

async function scopeOf(publication: HistoricalScope['publication'], file: string, commit: string) {
  const key = commit.slice(0, 32);
  const node = {
    id: 'component:orders',
    label: 'Orders',
    detail: '',
    kind: 'component',
    sourceIds: [],
    target: null,
  };
  const identity = { publication, service: 'orders', name: 'Orders', repo, commit };
  const content = JSON.stringify({
    format: 'service-explorer-page/v1',
    kind: 'overview',
    snapshot: commit,
    title: 'Published orders',
    description: '',
    nodes: [node],
    fields: [],
    sources: [],
    links: [],
    gaps: [],
    completeSelection: false,
  });
  const page = record(content);
  const bucket = page.sha256.slice(0, 2);
  const pack = gzipSync(JSON.stringify({ [page.sha256]: content }));
  const packFile = path.join(archive, 'objects', `${bucket}.json.gz`);
  await writeFile(packFile, pack);
  const manifest = JSON.stringify({
    ...identity,
    format,
    overview: file,
    callers: file,
    entries: [{ id: 'published-order', file, label: 'Open orders', native: 'api:orders' }],
    pages: [{ file, kind: 'overview', ...page }],
    retired: [],
  });
  await writeFile(path.join(archive, 'scopes', `${key}.json`), manifest);
  return {
    scope: { ...identity, key, ...record(manifest) },
    pack: { bucket, ...record(pack) },
    packFile,
  };
}

beforeEach(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), 'groundwork-entry-history-'));
  vi.stubEnv('GROUNDWORK_WORKSPACES', workspace);
  archive = path.join(workspace, 'evidence-archive', 'entries');
  await mkdir(path.join(archive, 'objects'), { recursive: true });
  await mkdir(path.join(archive, 'scopes'), { recursive: true });
  await writeFile(path.join(workspace, 'workspace.yaml'), 'format: 2\nid: acme\nname: Acme\n');
  const first = await scopeOf('live', livePage, live);
  const fallback = await scopeOf('fallback', oldPage, old);
  oldPack = fallback.packFile;
  await writeFile(
    path.join(archive, 'index.json'),
    JSON.stringify({
      format,
      scopes: [first.scope, fallback.scope],
      packs: [first.pack, fallback.pack],
    }),
  );
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(workspace, { recursive: true, force: true });
});

it('selects the exact old page and generated entry node at its historical pin', async () => {
  await expect(
    readEntryHistory('acme', { service: 'orders', page: oldPage, node: 'published-order' }),
  ).resolves.toMatchObject({
    kind: 'snapshot',
    file: oldPage,
    selected: 'published-order',
    scope: { commit: old, publication: 'fallback' },
  });
  await expect(
    readEntryHistory('acme', { service: 'orders', node: 'published-order' }),
  ).resolves.toMatchObject({
    kind: 'snapshot',
    file: livePage,
    selected: null,
    scope: { commit: live },
  });
});

it('rejects a changed packed object before presenting it as the published entry', async () => {
  await writeFile(oldPack, gzipSync('{}'));
  await expect(readEntryHistory('acme', { service: 'orders', page: oldPage })).rejects.toThrow(
    /archive checksum changed|regular-file byte bound/u,
  );
});
