// @vitest-environment happy-dom
import { createHash, webcrypto } from 'node:crypto';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { explorerFixture, explorerManifestFixture } from '@/../test/service-explorer-kit';

import { loadExplorerPage } from './load-page';
import { ServiceExplorer } from './service-explorer.client';

function fixture() {
  const flow = explorerFixture();
  const data = {
    ...flow,
    title: 'Customer record',
    kind: 'data',
    nodes: [],
    links: [],
    fields: [
      {
        name: 'customerId',
        type: 'string',
        required: 'unknown',
        nullable: 'unknown',
        sourceIds: ['source:fixture'],
      },
    ],
  };
  const pages = new Map([
    ['flow.json', JSON.stringify(flow)],
    ['data.json', JSON.stringify(data)],
  ]);
  const artifacts = [...pages].map(([file, raw]) => ({
    file,
    bytes: Buffer.byteLength(raw),
    sha256: createHash('sha256').update(raw).digest('hex'),
  }));
  const manifest = explorerManifestFixture(artifacts);
  vi.stubGlobal('crypto', webcrypto);
  const fetch = vi.fn<(url: string) => Promise<Response>>(async (url) => {
    const body = await Promise.resolve(pages.get(url.replace('data/', '')) ?? '');
    return new Response(body, { status: 200 });
  });
  vi.stubGlobal('fetch', fetch);
  return { manifest, pages, fetch };
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  globalThis.history.replaceState(null, '', '/');
});

describe('service explorer evidence route', () => {
  it('takes a user from a branch through a write to schema fields and pinned source', async () => {
    const { manifest, fetch } = fixture();
    render(<ServiceExplorer base="data/" manifest={manifest} />);
    expect(screen.getByText(/Inferred purpose/u)).toBeDefined();
    const guard = await screen.findByRole('button', { name: 'branch: Known individual?' });
    fireEvent.keyDown(guard, { key: 'Enter' });
    expect(screen.getByText('Source guard')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'storage: Save customer' }));
    await expect(screen.findByText('customerId: string')).resolves.toBeDefined();
    expect(screen.getByRole('link', { name: 'Field source' }).getAttribute('href')).toContain(
      '/blob/fixture/',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Explore schema' }));
    await expect(screen.findByRole('heading', { name: 'Customer record' })).resolves.toBeDefined();
    expect(screen.getByRole('table')).toBeDefined();
    expect(screen.getByText('customerId: string')).toBeDefined();
    expect(fetch.mock.calls.map(([url]) => url)).toContain('data/data.json');
    expect(screen.getByText(/runtime and deployment unverified/u)).toBeDefined();
  });
  it('restores a published schema from its address and preserves selection through zoom', async () => {
    const { manifest } = fixture();
    globalThis.history.replaceState(null, '', '/?service=component%3Afixture&page=data.json');
    render(<ServiceExplorer base="data/" manifest={manifest} />);
    await expect(screen.findByRole('heading', { name: 'Customer record' })).resolves.toBeDefined();
    expect(screen.getByText('customerId: string')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Service map' }));
    const guard = await screen.findByRole('button', { name: 'branch: Known individual?' });
    fireEvent.click(guard);
    const drawing = screen.getByRole('group', { name: 'Update customer' });
    const before = Number(drawing.getAttribute('width'));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(Number(drawing.getAttribute('width'))).toBeLessThan(before);
    expect(guard.getAttribute('aria-pressed')).toBe('true');
    expect(globalThis.location.search).toContain('node=guard');
    fireEvent.click(screen.getByRole('button', { name: 'Close inspection' }));
    expect(screen.queryByText('Source guard')).toBeNull();
    expect(globalThis.location.search).not.toContain('node=');
  });
  it('refuses pages outside the manifest and rejects mutations before display', async () => {
    const { manifest, pages, fetch } = fixture();
    const signal = new AbortController().signal;
    await expect(
      loadExplorerPage({ manifest, base: 'data/', file: '../source.json', signal }),
    ).rejects.toThrow('outside');
    expect(fetch).not.toHaveBeenCalled();
    pages.set('flow.json', (pages.get('flow.json') ?? '').replace('Source guard', 'Other branch'));
    await expect(
      loadExplorerPage({ manifest, base: 'data/', file: 'flow.json', signal }),
    ).rejects.toThrow('checksum');
  });
  it('shows a missing-evidence state instead of a fabricated graph', async () => {
    const { manifest } = fixture();
    vi.stubGlobal(
      'fetch',
      vi.fn<() => Promise<Response>>().mockResolvedValue(new Response('', { status: 404 })),
    );
    render(<ServiceExplorer base="data/" manifest={manifest} />);
    await expect(screen.findByText('Explorer page returned 404')).resolves.toBeDefined();
    expect(screen.queryByRole('button', { name: 'branch: Known individual?' })).toBeNull();
  });
});
