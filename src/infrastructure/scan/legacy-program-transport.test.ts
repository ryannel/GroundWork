import { mkdtempSync, readFileSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';

import { readFramedScanJson } from './framed-scan-document';
import { framedLogicalLimit } from './framed-scan-format';
import { framedDigest } from './framed-scan-storage';
import { scanValidator } from './scan-format';
import { loadVerifiedScanSnapshot, verifiedSnapshotDocument } from './verified-scan-snapshot';

vi.mock(import('server-only'), () => ({}));
vi.mock(import('node:fs/promises'), { spy: true });
vi.mock(import('./framed-scan-format'), async (importOriginal) => ({
  ...(await importOriginal()),
  // Exercise the legacy physical boundary with small real files, not huge fake payloads.
  SCAN_PHYSICAL_LIMIT: 4096,
}));

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});
function legacy() {
  const folder = mkdtempSync(path.join(tmpdir(), 'legacy-program-'));
  folders.push(folder);
  const filename = path.join(folder, 'document.json');
  const fixture = scanFixture();
  const document = {
    ...fixture,
    id: `scan:csharp-program:${'a'.repeat(64)}`,
    gaps: fixture.gaps.map((gap) => ({ ...gap, description: 'retained source '.repeat(1024) })),
  };
  const bytes = `${JSON.stringify(document, null, 2)}\n`;
  writeFileSync(filename, bytes);
  const receipt = {
    format: 'scan-csharp-program-publication/v1',
    document: document.id,
    documentSha256: framedDigest(bytes),
  };
  return { filename, document, bytes, receipt };
}
function publishReceipt(filename: string, receipt: unknown): void {
  writeFileSync(path.join(path.dirname(filename), 'receipt.json'), JSON.stringify(receipt));
}

it('keeps receipt-bound historical bytes and validates the complete programme after one document read', async () => {
  const { filename, bytes, document, receipt } = legacy();
  publishReceipt(filename, receipt);
  vi.mocked(open).mockClear();
  const snapshot = await loadVerifiedScanSnapshot(filename, { kind: 'program' });
  expect(snapshot.bytes).toBe(bytes);
  expect(readFileSync(filename, 'utf8')).toBe(bytes);
  expect(vi.mocked(open).mock.calls.filter(([opened]) => opened === filename)).toHaveLength(1);
  const parse = await scanValidator();
  expect(parse(verifiedSnapshotDocument(snapshot, snapshot.bytes))).toEqual(document);
  await expect(readFramedScanJson(filename, { kind: 'program' })).resolves.toEqual(document);
});

it('never grants programme bytes from a receipt or a source document field', async () => {
  const { filename, document, receipt } = legacy();
  publishReceipt(filename, receipt);
  await expect(loadVerifiedScanSnapshot(filename)).rejects.toThrow('caller byte bound');
  await expect(readFramedScanJson(filename, { kind: 'source' })).rejects.toThrow(
    'caller byte bound',
  );
  writeFileSync(
    filename,
    JSON.stringify({ ...document, kind: 'program', maxBytes: 512 * 1024 * 1024 }),
  );
  await expect(readFramedScanJson(filename)).rejects.toThrow('caller byte bound');
});

it('preserves a UTF-8 BOM in the exact receipt and snapshot identity', async () => {
  const { filename, bytes, document, receipt } = legacy();
  const original = `\uFEFF${bytes}`;
  writeFileSync(filename, original);
  publishReceipt(filename, { ...receipt, documentSha256: framedDigest(original) });
  const snapshot = await loadVerifiedScanSnapshot(filename, { kind: 'program' });
  expect(snapshot.bytes).toBe(original);
  expect(verifiedSnapshotDocument(snapshot, snapshot.bytes)).toEqual(document);
});

it('requires the historical publication receipt for oversized unframed programmes', async () => {
  const { filename } = legacy();
  await expect(readFramedScanJson(filename, { kind: 'program' })).rejects.toThrow('ENOENT');
});

it.each(['receipt-role', 'document-id', 'hash', 'document-role', 'framed-manifest'])(
  'rejects an oversized programme with forged %s',
  async (change) => {
    const { filename, document, receipt } = legacy();
    if (change === 'receipt-role') receipt.format = 'scan-source-publication/v1';
    if (change === 'document-id') receipt.document = 'scan:csharp-program:wrong';
    if (change === 'hash') receipt.documentSha256 = '0'.repeat(64);
    if (change === 'document-role') {
      document.id = 'scan:source';
      const bytes = JSON.stringify(document);
      writeFileSync(filename, bytes);
      receipt.document = document.id;
      receipt.documentSha256 = framedDigest(bytes);
    }
    if (change === 'framed-manifest') {
      const bytes = JSON.stringify({ ...document, format: 'scan-framed/v1' });
      writeFileSync(filename, bytes);
      receipt.documentSha256 = framedDigest(bytes);
    }
    publishReceipt(filename, receipt);
    await expect(loadVerifiedScanSnapshot(filename, { kind: 'program' })).rejects.toThrow(
      /legacy C# programme|publication receipt/iu,
    );
  },
);

it('rejects an over-512MiB programme from file metadata before reading its sparse body', async () => {
  const { filename } = legacy();
  truncateSync(filename, framedLogicalLimit({ kind: 'program' }) + 1);
  await expect(readFramedScanJson(filename, { kind: 'program' })).rejects.toThrow(
    'caller byte bound',
  );
});
