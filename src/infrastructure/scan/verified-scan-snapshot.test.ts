import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import { interpretationFixture } from '@/../test/scan-interpretation-kit';
import { scanFixture } from '@/../test/scan-kit';
import { readInterpretation } from '@/../tools/scan-interpretation';

import { writeFramedScanDocument } from './framed-scan-document';
import { interpretationDigest } from './interpretation-format';
import { loadVerifiedScanSnapshot, verifiedSnapshotDocument } from './verified-scan-snapshot';

vi.mock(import('server-only'), () => ({}));
vi.mock(import('node:fs/promises'), { spy: true });
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
it('validates CLI inference against manifestSHA while using complete assembled source records', async () => {
  const root = folder();
  const fixture = interpretationFixture();
  const input = fixture.inputs.find((candidate) => candidate.kind === 'scan_snapshot');
  if (input === undefined) throw new Error('Missing source fixture');
  const filename = path.join(root, 'document.json');
  await writeFramedScanDocument(filename, JSON.parse(input.bytes), { forceFraming: true });
  const bytes = readFileSync(filename, 'utf8');
  const document = {
    ...fixture.document,
    contexts: fixture.document.contexts.map((context) =>
      context.id === input.id ? { ...context, sha256: interpretationDigest(bytes) } : context,
    ),
  };
  const sidecar = path.join(root, 'interpretation.json');
  const manifest = path.join(root, 'inputs.json');
  writeFileSync(sidecar, JSON.stringify(document));
  writeFileSync(
    manifest,
    JSON.stringify({
      format: 'scan-interpretation-inputs/v1',
      inputs: [{ kind: 'scan_snapshot', id: input.id, path: 'document.json' }],
    }),
  );
  vi.mocked(readFile).mockClear();
  await expect(readInterpretation(sidecar, manifest)).resolves.toMatchObject({ state: 'complete' });
  writeFileSync(sidecar, JSON.stringify(fixture.document));
  await expect(readInterpretation(sidecar, manifest)).rejects.toThrow('ScanInterpretation');
});
