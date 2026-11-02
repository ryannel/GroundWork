import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { interpretationFixture } from '@/../test/scan-interpretation-kit';
import type { ScanInterpretation } from '@/domain/scan/interpretation.generated';
import { interpretationDigest } from '@/infrastructure/scan/interpretation-format';

import { readReadinessInterpretation } from './scan-readiness-interpretation';

vi.mock(import('server-only'), () => ({}));
const DIRECTORIES: string[] = [];
afterEach(async () => {
  await Promise.all(
    DIRECTORIES.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })),
  );
});
async function fixture(): Promise<{
  readonly document: ScanInterpretation;
  readonly directory: string;
  readonly sidecar: string;
  readonly manifest: string;
  readonly metadata: string;
  readonly bytes: string;
}> {
  const value = interpretationFixture();
  const input = value.inputs[0];
  if (!input) throw new Error('Expected observed context');
  const directory = await mkdtemp(path.join(tmpdir(), 'groundwork-readiness-interpretation-'));
  DIRECTORIES.push(directory);
  const sidecar = path.join(directory, 'interpretation.json');
  const manifest = path.join(directory, 'inputs.json');
  const metadata = path.join(directory, 'metadata.json');
  await writeFile(metadata, input.bytes);
  await writeFile(sidecar, JSON.stringify(value.document));
  await writeFile(
    manifest,
    JSON.stringify({
      format: 'scan-interpretation-inputs/v1',
      inputs: [{ kind: 'scan_snapshot', id: input.id, path: 'metadata.json' }],
    }),
  );
  return { document: value.document, directory, sidecar, manifest, metadata, bytes: input.bytes };
}

describe('readiness interpretation input files', () => {
  it('returns verified snapshots for a completed interpretation of this exact catalogue', async () => {
    const value = await fixture();
    const result = await readReadinessInterpretation(value.sidecar, value.manifest, value.metadata);
    expect(result.document.state).toBe('complete');
    expect(result.snapshots[0]?.sha256).toBe(interpretationDigest(value.bytes));
    expect(result.snapshots[0]?.kind).toBe('scan_snapshot');
  });
  it('rejects a historical snapshot even when repository, commit, scan ID and parsed records match', async () => {
    const value = await fixture();
    const current = path.join(value.directory, 'current.json');
    await writeFile(current, `${value.bytes}\n`);
    await expect(
      readReadinessInterpretation(value.sidecar, value.manifest, current),
    ).rejects.toThrow('exact current catalogue metadata');
  });
  it('rejects an attached current context which no completed area run actually received', async () => {
    const value = await fixture();
    const bytes = `${value.bytes}\n`;
    const current = path.join(value.directory, 'current.json');
    await writeFile(current, bytes);
    value.document.contexts.push({
      ...value.document.contexts[0],
      id: 'context:current',
      sha256: interpretationDigest(bytes),
    });
    await writeFile(value.sidecar, JSON.stringify(value.document));
    await writeFile(
      value.manifest,
      JSON.stringify({
        format: 'scan-interpretation-inputs/v1',
        inputs: [
          { kind: 'scan_snapshot', id: 'context:source', path: 'metadata.json' },
          { kind: 'scan_snapshot', id: 'context:current', path: 'current.json' },
        ],
      }),
    );
    await expect(
      readReadinessInterpretation(value.sidecar, value.manifest, current),
    ).rejects.toThrow('every completed area attempt');
  });
  it('rejects a changed context file and a partial model phase', async () => {
    const value = await fixture();
    value.document.state = 'partial';
    await writeFile(value.sidecar, JSON.stringify(value.document));
    await expect(
      readReadinessInterpretation(value.sidecar, value.manifest, value.metadata),
    ).rejects.toThrow('not complete');
    value.document.state = 'complete';
    await writeFile(value.sidecar, JSON.stringify(value.document));
    await writeFile(value.metadata, `${value.bytes}\n`);
    await expect(
      readReadinessInterpretation(value.sidecar, value.manifest, value.metadata),
    ).rejects.toThrow('digest');
  });
  it('returns contextual text verified against its digest, revision and declared URI', async () => {
    const value = await fixture();
    const bytes = 'Existing product note\nCustomer care may use this capability.\n';
    await writeFile(path.join(value.directory, 'note.md'), bytes);
    value.document.contexts.push({
      kind: 'context_snapshot',
      id: 'context:note',
      sha256: interpretationDigest(bytes),
      role: 'surrounding',
      uri: 'workspace:note',
      title: 'Product note',
      revision: 'note-r1',
      authority: 'team_note',
      input_provenance: {
        provided_by: 'workspace',
        retrieved_at: '2026-10-25T12:00:00Z',
        description: 'Existing contextual note',
      },
      pins: [],
    });
    value.document.runs[0]!.input_context_ids.push('context:note');
    value.document.claims[0]!.support.push({
      kind: 'context_snapshot',
      context_id: 'context:note',
      locator: 'Care paragraph',
      lines: [2, 2],
    });
    await writeFile(value.sidecar, JSON.stringify(value.document));
    await writeFile(
      value.manifest,
      JSON.stringify({
        format: 'scan-interpretation-inputs/v1',
        inputs: [
          { kind: 'scan_snapshot', id: 'context:source', path: 'metadata.json' },
          {
            kind: 'context_snapshot',
            id: 'context:note',
            path: 'note.md',
            uri: 'workspace:note',
            revision: 'note-r1',
          },
        ],
      }),
    );
    const result = await readReadinessInterpretation(value.sidecar, value.manifest, value.metadata);
    expect(result.snapshots[1]).toEqual({
      kind: 'context_snapshot',
      id: 'context:note',
      sha256: interpretationDigest(bytes),
      text: bytes,
      uri: 'workspace:note',
      revision: 'note-r1',
    });
  });
});
