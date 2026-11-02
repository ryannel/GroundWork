import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { interpretationFixture } from '@/../test/scan-interpretation-kit';
import type { CurrentRecord } from '@/domain/scan-explorer/current-contracts';
import { scanValidator } from '@/infrastructure/scan/scan-format';

import { visualPurpose } from './visual-interpretation';
import { uniqueVisualRecords, visualContentSnapshot } from './visual-selection';

vi.mock(import('server-only'), () => ({}));
const folders: string[] = [];
afterEach(async () => {
  await Promise.all(
    folders.splice(0).map(async (folder) => rm(folder, { recursive: true, force: true })),
  );
});

describe('visual selection provenance', () => {
  it('hashes content even when the selected document and record identities are unchanged', () => {
    const before = { id: 'same', records: [{ id: 'same-source', path: 'old.ts' }] };
    const after = { ...before, records: [{ id: 'same-source', path: 'changed.ts' }] };
    expect(visualContentSnapshot(before)).not.toBe(visualContentSnapshot(after));
  });
  it('rejects contradictory duplicate facts and accepts equivalent key orders', () => {
    const first = {
      kind: 'java_value_binding',
      id: 'value',
      relation: 'reference',
      from: 'first',
      to: 'second',
      call: null,
      guards: [],
    } satisfies CurrentRecord;
    const same = {
      id: 'value',
      kind: 'java_value_binding',
      to: 'second',
      from: 'first',
      relation: 'reference',
      call: null,
      guards: [],
    } satisfies CurrentRecord;
    expect(uniqueVisualRecords([first, same])).toEqual([same]);
    expect(() => uniqueVisualRecords([first, { ...first, to: 'other' }])).toThrow(
      'Conflicting selected native record',
    );
  });
  it('rejects old inferred purpose against mutated metadata bytes with the same scan id', async () => {
    const fixture = interpretationFixture();
    const source = fixture.inputs.find((input) => input.kind === 'scan_snapshot');
    if (source === undefined) throw new Error('Missing interpretation source fixture');
    const folder = await mkdtemp(path.join(os.tmpdir(), 'visual-purpose-'));
    folders.push(folder);
    const sourceFile = path.join(folder, 'source.json');
    const interpretation = path.join(folder, 'interpretation.json');
    const inputs = path.join(folder, 'inputs.json');
    await Promise.all([
      writeFile(sourceFile, source.bytes),
      writeFile(interpretation, JSON.stringify(fixture.document)),
      writeFile(
        inputs,
        JSON.stringify({ inputs: [{ kind: 'scan_snapshot', id: source.id, path: 'source.json' }] }),
      ),
    ]);
    const parse = await scanValidator();
    const target = parse(JSON.parse(source.bytes));
    const purpose = await visualPurpose({
      interpretation,
      inputs,
      target,
      targetBytes: source.bytes,
    });
    expect(purpose.label).toBe('Inferred');
    const changed = {
      ...target,
      sources: target.sources.map((record) => ({ ...record, path: 'changed.ts' })),
    };
    await expect(
      visualPurpose({
        interpretation,
        inputs,
        target: changed,
        targetBytes: JSON.stringify(changed),
      }),
    ).rejects.toThrow('exact metadata snapshot');
  });
});
