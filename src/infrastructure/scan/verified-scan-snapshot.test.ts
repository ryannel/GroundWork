import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';

import { writeFramedScanDocument } from './framed-scan-document';
import { loadVerifiedScanSnapshot, verifiedSnapshotDocument } from './verified-scan-snapshot';

vi.mock(import('server-only'), () => ({}));
const folders: string[] = [];
afterEach(() => {
  for (const cleanupFolder of folders.splice(0)) {
    rmSync(cleanupFolder, { recursive: true, force: true });
  }
});
function folder(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'verified-scan-'));
  folders.push(root);
  return root;
}
it('binds logical input to exact hashed manifest bytes and rejects substitution or mutation', async () => {
  const filename = path.join(folder(), 'document.json');
  await writeFramedScanDocument(filename, scanFixture(), { forceFraming: true });
  const snapshot = await loadVerifiedScanSnapshot(filename);
  expect(verifiedSnapshotDocument(snapshot, snapshot.bytes)).toEqual(scanFixture());
  expect(() => verifiedSnapshotDocument({ bytes: snapshot.bytes }, snapshot.bytes)).toThrow(
    'not bound',
  );
  expect(() => verifiedSnapshotDocument(snapshot, `${snapshot.bytes} `)).toThrow('not bound');
  const logical = verifiedSnapshotDocument(snapshot, snapshot.bytes);
  if (typeof logical !== 'object' || logical === null) throw new Error('Missing verified scan');
  Reflect.set(logical, 'id', 'scan:changed');
  expect(() => verifiedSnapshotDocument(snapshot, snapshot.bytes)).toThrow('mutated');
});
