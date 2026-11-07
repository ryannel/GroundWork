import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, it, vi } from 'vitest';

import { modelAreaViewOf } from '@/application/model-area';
import { indexOf } from '@/application/model-index';
import { modelList, modelRecord } from '@/domain/workspace-model';
import { readModel } from '@/infrastructure/read-model';

import { factChecksums, indexedModelFacts, writeModelFacts } from './model-facts';
import { readSnapshot, writeSnapshot } from './snapshots';

vi.mock(import('server-only'), () => ({}));

it('captures native authored facts and derived execution without a legacy flow reader', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groundwork-model-facts-'));
  await cp(path.resolve('test/fixtures/model'), path.join(root, 'model'), { recursive: true });
  const model = await readModel('model-fixture', root);
  if (model === null) throw new Error('Fixture is not registered.');
  const index = indexOf(model);
  const facts = indexedModelFacts(index);
  expect(facts).toHaveProperty(
    'identities',
    expect.arrayContaining([
      expect.objectContaining({ id: 'h:confirm#tx/save', place: index.place('h:confirm#tx/save') }),
    ]),
  );
  expect(facts).toHaveProperty('componentEdges', index.edges());
  expect(facts).toHaveProperty('systemEdges', index.edges(undefined, { level: 'system' }));
  expect(facts).toHaveProperty(
    'callers',
    Object.fromEntries(index.entries().map((entry) => [entry.id, index.callers(entry.id)])),
  );
  expect(facts).toHaveProperty('gaps', index.gaps());
  const text = JSON.stringify(facts);
  const parsed: unknown = JSON.parse(text);
  expect(parsed).toEqual(facts);
});

function record(value: unknown): Readonly<Record<string, unknown>> {
  const valueRecord = modelRecord(value);
  if (valueRecord === null) throw new TypeError('Expected a fact object.');
  return valueRecord;
}

async function stored(out: string, ref: unknown): Promise<unknown> {
  const { file, sha256 } = record(ref);
  if (typeof file !== 'string' || typeof sha256 !== 'string') {
    throw new TypeError('Expected a stored fact reference.');
  }
  return readSnapshot(out, file, sha256);
}

it('captures actual frozen and revision facts without repeating identical evidence', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groundwork-model-shards-'));
  const folder = path.join(root, 'model');
  const original = path.resolve('test/fixtures/model');
  await cp(original, folder, { recursive: true });
  const plan = path.join(folder, 'plans/confirm');
  const frozen = path.join(plan, 'base');
  await cp(original, frozen, {
    recursive: true,
    filter: (file) => path.relative(original, file).split(path.sep)[0] !== 'plans',
  });
  await writeFile(
    path.join(plan, 'base.yaml'),
    'format: groundwork-model-base/v1\nlanded_on: 2026-11-05\n',
  );
  const source = await readFile(path.join(plan, 'plan.yaml'), 'utf8');
  const revisions = path.join(plan, 'revisions');
  await mkdir(revisions);
  await writeFile(
    path.join(revisions, 'v1.yaml'),
    source.replace('Explain confirmation', 'First version'),
  );
  await writeFile(path.join(plan, 'progress.yaml'), 'events: []\n');
  const workspace = path.join(folder, 'workspace.yaml');
  const before = await readFile(workspace, 'utf8');
  await writeFile(workspace, before.replace('Model contract fixture', 'Current model'));
  const model = await readModel('model-fixture', root);
  if (model === null) throw new Error('Fixture is not registered.');
  const index = indexOf(model);
  const out = await mkdtemp(path.join(tmpdir(), 'groundwork-capture-shards-'));
  const files = await writeModelFacts(out, index, root);
  const manifest = record(await readSnapshot(out, 'facts.json.gz'));
  const checksums = factChecksums(manifest);
  expect(files[0]).toBe('facts.json.gz');
  expect(new Set(files.slice(1))).toEqual(new Set(checksums.keys()));

  const current = record(manifest.current);
  const { evidence, ...authored } = model;
  await expect(stored(out, current.model)).resolves.toEqual(authored);
  await expect(stored(out, current.derived)).resolves.toEqual(indexedModelFacts(index));
  const currentEvidence = modelList(current.evidence);
  await expect(Promise.all(currentEvidence.map(async (ref) => stored(out, ref)))).resolves.toEqual(
    evidence,
  );
  await expect(stored(out, record(modelList(current.areas)[0]).view)).resolves.toEqual(
    modelAreaViewOf(index, 'area:orders'),
  );

  const capturedPlan = record(modelList(manifest.plans)[0]);
  expect(capturedPlan).toMatchObject({
    slug: 'confirm',
    base: { format: 'groundwork-model-base/v1', landed_on: '2026-11-05' },
    progress: { progress: { events: [] }, errors: [] },
  });
  const historicalBefore = record(capturedPlan.before);
  await expect(stored(out, historicalBefore.model)).resolves.toHaveProperty(
    'name',
    'Model contract fixture',
  );
  expect(historicalBefore.evidence).toEqual(currentEvidence);
  expect(record(capturedPlan.after).evidence).toEqual(currentEvidence);
  const revision = record(modelList(capturedPlan.revisions)[0]);
  expect(revision).toHaveProperty('version', 'v1');
  expect(revision).toHaveProperty('projection.plan.meta.title', 'First version');
  await expect(
    stored(out, record(record(revision.projection).before).model),
  ).resolves.toHaveProperty('name', 'Model contract fixture');

  const evidenceRef = record(currentEvidence[0]);
  if (typeof evidenceRef.file !== 'string') throw new Error('Missing evidence shard.');
  await writeSnapshot(out, evidenceRef.file, { edited: true });
  await expect(stored(out, evidenceRef)).rejects.toThrow('Snapshot checksum does not match');
});
