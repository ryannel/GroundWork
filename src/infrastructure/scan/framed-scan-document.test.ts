import { mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';

import { readFramedScanJson, writeFramedScanDocument } from './framed-scan-document';
import {
  framedLogicalLimit,
  framedScanManifest,
  SCAN_FRAGMENT_LIMIT,
  SCAN_SOURCE_LIMIT,
} from './framed-scan-format';

vi.mock(import('server-only'), () => ({}));
const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});
function target(): string {
  const folder = mkdtempSync(path.join(tmpdir(), 'scan-framing-'));
  folders.push(folder);
  return path.join(folder, 'document.json');
}
function manifest(filename: string) {
  return framedScanManifest.parse(JSON.parse(readFileSync(filename, 'utf8')));
}
function rewrite(filename: string, value: unknown): void {
  writeFileSync(filename, JSON.stringify(value));
}
async function framed() {
  const filename = target();
  await writeFramedScanDocument(filename, scanFixture(), { forceFraming: true });
  return { filename, value: manifest(filename) };
}

describe('lossless bounded scan storage framing', () => {
  it('keeps ordinary publication bytes unchanged', async () => {
    const filename = target();
    const document = scanFixture();
    await writeFramedScanDocument(filename, document);
    expect(readFileSync(filename, 'utf8')).toBe(`${JSON.stringify(document, null, 2)}\n`);
    await expect(readFramedScanJson(filename)).resolves.toEqual(document);
  });
  it('preserves every collection, key, record and byte order after framing', async () => {
    const { filename } = await framed();
    expect(JSON.stringify(await readFramedScanJson(filename))).toBe(JSON.stringify(scanFixture()));
  });
  it('splits a single record over16MiB without losing split Unicode sequences', async () => {
    const filename = target();
    const document = scanFixture();
    const description = '😀é'.repeat(4_000_000);
    const large = { ...document, gaps: document.gaps.map((gap) => ({ ...gap, description })) };
    await writeFramedScanDocument(filename, large, { forceFraming: true });
    const stored = manifest(filename);
    const collection = stored.entries.find((entry) => entry.key === 'gaps');
    if (collection?.kind !== 'collection') throw new Error('Missing record pages');
    expect(collection.pages.length).toBeGreaterThan(1);
    expect(collection.pages.every((page) => page.decodedBytes <= SCAN_FRAGMENT_LIMIT)).toBe(true);
    expect(JSON.stringify(await readFramedScanJson(filename))).toBe(JSON.stringify(large));
  });
  it('rejects changed page bytes before accepting any assembled source', async () => {
    const { filename, value } = await framed();
    const collection = value.entries.find((entry) => entry.kind === 'collection');
    if (collection?.kind !== 'collection' || collection.pages[0] === undefined) {
      throw new Error('Missing page');
    }
    const page = path.join(path.dirname(filename), collection.pages[0].path);
    writeFileSync(page, '{}');
    await expect(readFramedScanJson(filename)).rejects.toThrow('byte/hash mismatch');
  });
  it.each([
    'path',
    'records',
    'decodedBytes',
    'logicalSha256',
    'duplicateKey',
    'pageCount',
    'unknownField',
    'unknownKey',
    'reservedKey',
    'protoKey',
    'prototypeKey',
    'payloadCap',
  ])('rejects forged %s metadata', async (change) => {
    const { filename, value } = await framed();
    const collection = value.entries.find((entry) => entry.kind === 'collection');
    if (collection?.kind !== 'collection' || collection.pages[0] === undefined) {
      throw new Error('Missing page');
    }
    if (change === 'path') collection.pages[0].path = '../outside.json';
    if (change === 'records') collection.records += 1;
    if (change === 'decodedBytes') collection.pages[0].decodedBytes += 1;
    if (change === 'logicalSha256') value.logicalSha256 = '0'.repeat(64);
    if (change === 'unknownKey') collection.key = 'unknownCollection';
    if (change === 'reservedKey') collection.key = 'constructor';
    if (change === 'protoKey') collection.key = '__proto__';
    if (change === 'prototypeKey') collection.key = 'prototype';
    if (change === 'payloadCap') collection.pages[0].decodedBytes = SCAN_FRAGMENT_LIMIT + 1;
    if (change === 'duplicateKey') value.entries.push(value.entries[0]!);
    if (change === 'pageCount') {
      collection.pages = Array.from({ length: 65 }, () => collection.pages[0]!);
    }
    rewrite(filename, change === 'unknownField' ? { ...value, unexpected: true } : value);
    await expect(readFramedScanJson(filename)).rejects.toThrow(/.+/u);
  });
  it('takes programme limits from caller context only', async () => {
    const { filename, value } = await framed();
    value.logicalBytes = SCAN_SOURCE_LIMIT + 1;
    rewrite(filename, { ...value, kind: 'program' });
    await expect(readFramedScanJson(filename)).rejects.toThrow(/.+/u);
    rewrite(filename, value);
    await expect(readFramedScanJson(filename)).rejects.toThrow('caller bound');
    expect(framedLogicalLimit({ kind: 'program' })).toBe(512 * 1024 * 1024);
  });
  it('rejects symlink pages and missing pages', async () => {
    const { filename, value } = await framed();
    const collection = value.entries.find((entry) => entry.kind === 'collection');
    if (collection?.kind !== 'collection' || collection.pages[0] === undefined) {
      throw new Error('Missing page');
    }
    const page = path.join(path.dirname(filename), collection.pages[0].path);
    unlinkSync(page);
    await expect(readFramedScanJson(filename)).rejects.toThrow(/.+/u);
    symlinkSync(filename, page);
    await expect(readFramedScanJson(filename)).rejects.toThrow('bounded regular file');
  });
  it('runs complete role/schema validation on the assembled logical graph', async () => {
    const filename = target();
    const document = scanFixture();
    const invalid = {
      ...document,
      sources: document.sources.map((source) => ({ ...source, host: 'host:missing' })),
    };
    await writeFramedScanDocument(filename, invalid, { forceFraming: true });
    await expect(readFramedScanJson(filename)).rejects.toThrow('ScanDocument');
  });
});
