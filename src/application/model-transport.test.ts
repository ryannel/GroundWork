import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, expect, it, vi } from 'vitest';

import { transportParityOf } from '@/../test/fixtures/model-transport-parity';
import type { WorkspaceModel } from '@/domain/workspace-model';
import { readModel } from '@/infrastructure/read-model';

import { indexOf } from './model-index';
import { currentModelPayload, modelContextOf, selectedPlanPayload } from './model-reader';
import { evidenceTransportOf } from './model-transport';
import { plansIndex } from './plans-index';

vi.mock(import('server-only'), () => ({}));
let root: string;
let model: WorkspaceModel;
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'groundwork-transport-'));
  await cp(path.resolve('test/fixtures/model'), path.join(root, 'model'), { recursive: true });
  const found = await readModel('model-fixture', root);
  if (found === null) throw new Error('Missing native transport fixture');
  model = found;
});
afterAll(async () => rm(root, { recursive: true }));

it('retains authored facts and every ordinary query while disclosing unloaded evidence', () => {
  const before = structuredClone(model);
  const payload = currentModelPayload(model);
  const scoped = modelContextOf(payload);
  const parity = transportParityOf(indexOf(model), scoped.afterIndex);
  expect(parity.problems).toEqual([]);
  expect(parity.unloadedEvidence).toBeGreaterThan(0);
  expect(parity.operations).toBeGreaterThan(0);
  expect(payload.profile?.current?.omitted).toBeGreaterThan(0);
  expect(payload.profile?.current?.total).toBe(
    (payload.profile?.current?.loaded ?? 0) + (payload.profile?.current?.omitted ?? 0),
  );
  expect(scoped.profile).toBe(payload.profile);
  expect(model).toEqual(before);
  expect(scoped.afterIndex.get('ev:document')).not.toBeNull();
  expect(scoped.afterIndex.get('ev:source')).not.toBeNull();
  expect(scoped.afterIndex.get('ev:file')).not.toBeNull();
});

it('includes exact references in arbitrary values and text links without rewriting them', () => {
  const candidate = model.evidence
    .flatMap((repo) => repo.records)
    .find((record) => record.data.id === 'ev:binding');
  if (candidate === undefined) throw new Error('Missing evidence closure fixture');
  const raw = {
    arbitraryBusinessData: { 'ev:derivation': 'Keep ev:unknown untouched' },
    prose: '**See [[ev:binding]]**',
  };
  const scoped = evidenceTransportOf([model], [raw]).scope(model);
  expect(scoped.model.evidence.flatMap((repo) => repo.records)).toContain(candidate);
  const index = indexOf(scoped.model);
  expect(index.get('ev:rule')).not.toBeNull();
  expect(index.get('ev:dependency')).not.toBeNull();
  expect(index.get('ev:call')).toBeNull();
  expect(raw.arbitraryBusinessData['ev:derivation']).toBe('Keep ev:unknown untouched');
  expect(raw.prose).toBe('**See [[ev:binding]]**');
});

it('uses both model versions and plan-only references with correct lookup metadata', () => {
  const plan = {
    meta: { id: 'plan:transport', title: 'Scope a proposal' },
    problem: { summary: 'The review cites [[ev:binding]].' },
    changes: [{ id: 'chg:transport', title: 'Qualify the order', ops: [] }],
  };
  const selected = plansIndex([plan], model).plans[0];
  if (selected === undefined) throw new Error('Missing transport projection');
  const payload = selectedPlanPayload(selected, '../../evidence.json');
  expect(payload.profile?.lookup).toBe('../../evidence.json');
  expect(indexOf(payload.before).get('ev:binding')).not.toBeNull();
  expect(indexOf(payload.after).get('ev:binding')).not.toBeNull();
  expect(transportParityOf(selected.beforeIndex, indexOf(payload.before)).problems).toEqual([]);
  expect(transportParityOf(selected.afterIndex, indexOf(payload.after)).problems).toEqual([]);
});
