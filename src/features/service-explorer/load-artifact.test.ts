// @vitest-environment happy-dom
import { createHash, webcrypto } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadExplorerArtifact } from './load-artifact';

function reference(file: string, raw: string) {
  return {
    file,
    bytes: Buffer.byteLength(raw),
    sha256: createHash('sha256').update(raw).digest('hex'),
  };
}
function publication(suffix: string) {
  const first = JSON.stringify({ title: 'Pre-tax prices', fields: ['market', 'amount'] });
  const second = JSON.stringify({ title: 'Tax response' });
  const raw = JSON.stringify({
    format: 'service-explorer-pack/v1',
    pages: { 'first.json': first, 'second.json': second },
  });
  const pack = reference(`pack-${suffix}.json`, raw);
  const fetch = vi.fn<() => Promise<Response>>(
    async () => new Response(await Promise.resolve(raw)),
  );
  vi.stubGlobal('fetch', fetch);
  vi.stubGlobal('crypto', webcrypto);
  const input = { base: 'data/', signal: new AbortController().signal };
  return { input, pack, raw, first, second, fetch };
}
afterEach(() => vi.unstubAllGlobals());

describe('packed explorer evidence', () => {
  it('verifies the physical pack and logical members, reusing only the selected pack', async () => {
    const { input, pack, first, second, fetch } = publication('valid');
    await expect(
      loadExplorerArtifact({ ...input, artifact: { ...reference('first.json', first), pack } }),
    ).resolves.toEqual(JSON.parse(first));
    await expect(
      loadExplorerArtifact({ ...input, artifact: { ...reference('second.json', second), pack } }),
    ).resolves.toEqual(JSON.parse(second));
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      'data/pack-valid.json',
      expect.objectContaining({ cache: 'force-cache' }),
    );
  });
  it('rejects a changed physical pack before inspecting any of its members', async () => {
    const { input, pack, first, raw, fetch } = publication('changed');
    fetch.mockImplementation(
      async () => new Response(await Promise.resolve(raw.replace('Pre-tax', 'Posttax'))),
    );
    await expect(
      loadExplorerArtifact({ ...input, artifact: { ...reference('first.json', first), pack } }),
    ).rejects.toThrow('checksum');
  });
  it('rejects missing members and altered logical metadata even in a valid cached pack', async () => {
    const { input, pack, first } = publication('members');
    await expect(
      loadExplorerArtifact({ ...input, artifact: { ...reference('outside.json', first), pack } }),
    ).rejects.toThrow('outside');
    await expect(
      loadExplorerArtifact({
        ...input,
        artifact: { ...reference('first.json', first), sha256: 'a'.repeat(64), pack },
      }),
    ).rejects.toThrow('checksum');
  });
  it('honours cancellation even when the pack is cached', async () => {
    const { input, pack, first } = publication('cancel');
    const artifact = { ...reference('first.json', first), pack };
    await loadExplorerArtifact({ ...input, artifact });
    const controller = new AbortController();
    controller.abort();
    await expect(
      loadExplorerArtifact({ ...input, artifact, signal: controller.signal }),
    ).rejects.toThrow('cancelled');
  });
});
