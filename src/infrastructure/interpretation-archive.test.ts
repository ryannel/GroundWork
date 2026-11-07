import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { archiveRepositories, readArchive, readArchiveArtifact } from './interpretation-archive';

vi.mock(import('server-only'), () => ({}));

const FORMAT = 'groundwork-interpretation-archive/v1';
const scope = { repo: 'acme/orders', commit: 'a'.repeat(40) };
const context = 'What the reviewers examined.\n';
const json = (value: unknown): string => `${JSON.stringify(value)}\n`;
const receipt = (value: string) => ({
  sha256: createHash('sha256').update(value).digest('hex'),
  bytes: Buffer.byteLength(value),
});
const original = json({
  claims: [
    {
      id: 'purpose',
      kind: 'purpose',
      statement: 'Supports order confirmation.',
      confidence: 'medium',
      reasoning: 'The entry is documented.',
      limitations: ['Runtime activation is unknown.'],
    },
    {
      id: 'actor',
      kind: 'actor',
      statement: 'An order clerk may trigger it.',
      confidence: 'low',
      reasoning: 'The context describes that role.',
      limitations: [],
    },
  ],
});
let folder: string;
let archive: string;
beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), 'groundwork-interpretations-'));
  vi.stubEnv('GROUNDWORK_WORKSPACES', folder);
  await writeFile(path.join(folder, 'workspace.yaml'), 'format: 2\nid: acme\nname: Acme\n');
  archive = path.join(folder, 'evidence-archive', 'explorer');
  const selected = path.join(archive, 'orders');
  await mkdir(path.join(selected, 'contexts'), { recursive: true });
  const contextReceipt = receipt(context);
  const manifest = json({
    format: FORMAT,
    ...scope,
    artifacts: { interpretation: receipt(original), review: receipt('{}'), inputs: receipt('{}') },
    contexts: [{ id: 'pinned-context', ...contextReceipt }],
    claims: [
      { id: 'purpose', canonicalId: 'ev:purpose' },
      { id: 'actor', canonicalId: null },
    ],
  });
  await Promise.all([
    writeFile(
      path.join(archive, 'index.json'),
      json({
        format: FORMAT,
        repositories: [{ name: 'orders', ...scope, ...receipt(manifest) }],
      }),
    ),
    writeFile(path.join(selected, 'manifest.json'), manifest),
    writeFile(path.join(selected, 'interpretation.json'), original),
    writeFile(path.join(selected, 'contexts', `${contextReceipt.sha256}.txt`), context),
  ]);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(folder, { recursive: true, force: true });
});

it('keeps canonical and context-only claims distinct at the exact repository pin', async () => {
  await expect(archiveRepositories('acme')).resolves.toEqual([scope]);
  await expect(readArchive('acme', scope)).resolves.toMatchObject({
    claims: [
      { id: 'purpose', canonicalId: 'ev:purpose', confidence: 'medium' },
      { id: 'actor', canonicalId: null, confidence: 'low' },
    ],
  });
  await expect(readArchive('acme', { ...scope, commit: 'b'.repeat(40) })).resolves.toBeNull();
});

it('returns the original bytes only for selected archive artefacts', async () => {
  await expect(readArchiveArtifact('acme', scope, 'interpretation')).resolves.toEqual(
    Buffer.from(original),
  );
  await expect(readArchiveArtifact('acme', scope, receipt(context).sha256)).resolves.toEqual(
    Buffer.from(context),
  );
  await expect(readArchiveArtifact('acme', scope, '../workspace.yaml')).resolves.toBeNull();
});

it('rejects changed bytes before presenting a reviewed interpretation', async () => {
  await writeFile(
    path.join(archive, 'orders', 'interpretation.json'),
    original.replace('medium', 'medium'.toUpperCase()),
  );
  await expect(readArchive('acme', scope)).rejects.toThrow(
    'Interpretation archive checksum changed.',
  );
});
