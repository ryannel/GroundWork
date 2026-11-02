// @vitest-environment happy-dom
import { createHash, webcrypto } from 'node:crypto';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { explorerFixture, explorerManifestFixture } from '@/../test/service-explorer-kit';
import type { ExplorerCatalogue } from '@/domain/service-explorer';

import { ExplorerCorpus } from './explorer-corpus.client';
import { loadExplorerPage } from './load-page';

function reference(filename: string, raw: string) {
  return {
    file: filename,
    bytes: Buffer.byteLength(raw),
    sha256: createHash('sha256').update(raw).digest('hex'),
  };
}
function publication() {
  const file = `page-${'a'.repeat(24)}.json`;
  const body = JSON.stringify(explorerFixture());
  const fixture = explorerManifestFixture([]);
  const service = { ...fixture.services[0]!, overview: file, callers: file, entries: [] };
  const index = JSON.stringify({
    format: 'service-explorer-index/v1',
    snapshot: fixture.snapshot,
    artifacts: [reference(file, body)],
  });
  const manifest = {
    ...fixture,
    services: [service],
    artifactIndexes: [{ ...reference('index-aa.json', index), bucket: 'aa' }],
  };
  const manifestBytes = JSON.stringify(manifest);
  const catalogue: ExplorerCatalogue = {
    format: 'service-explorer-catalogue/v1',
    workspace: fixture.workspace,
    snapshot: fixture.snapshot,
    assetBase: 'data/',
    selections: [{ service, manifest: reference('manifest.json', manifestBytes) }],
  };
  const files = new Map([
    ['manifest.json', manifestBytes],
    ['index-aa.json', index],
    [file, body],
  ]);
  const fetch = vi.fn<(url: string) => Promise<Response>>(async (url) => {
    const responseBody = await Promise.resolve(files.get(url.replace('data/', '')) ?? '');
    return new Response(responseBody, { status: 200 });
  });
  vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('fetch', fetch);
  return { catalogue, manifest, files, fetch, file };
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  globalThis.history.replaceState(null, '', '/');
});

describe('full corpus explorer selection', () => {
  it('loads only the selected manifest, index bucket and evidence frame', async () => {
    const { catalogue, fetch, file } = publication();
    render(<ExplorerCorpus catalogue={catalogue} />);
    await expect(
      screen.findByRole('button', { name: 'branch: Known individual?' }),
    ).resolves.toBeDefined();
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      'data/manifest.json',
      'data/index-aa.json',
      `data/${file}`,
    ]);
  });
  it('does not render a selected manifest whose content changed', async () => {
    const { catalogue, files } = publication();
    files.set(
      'manifest.json',
      (files.get('manifest.json') ?? '').replace('component:fixture', 'different:fixture'),
    );
    render(<ExplorerCorpus catalogue={catalogue} />);
    await expect(screen.findByText('Explorer page checksum changed')).resolves.toBeDefined();
    expect(screen.queryByRole('button', { name: 'branch: Known individual?' })).toBeNull();
  });
  it('rejects unselected pages and altered index buckets before requesting their content', async () => {
    const { manifest, files, fetch, file } = publication();
    const signal = new AbortController().signal;
    const outside = `page-aa${'b'.repeat(22)}.json`;
    await expect(
      loadExplorerPage({ manifest, base: 'data/', file: outside, signal }),
    ).rejects.toThrow('outside');
    expect(fetch.mock.calls.map(([url]) => url)).not.toContain(`data/${outside}`);
    files.set('index-aa.json', (files.get('index-aa.json') ?? '').replace('a', 'b'));
    await expect(loadExplorerPage({ manifest, base: 'data/', file, signal })).rejects.toThrow(
      'checksum',
    );
  });
});
