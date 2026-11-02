import { symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseReadinessFiles } from '@/infrastructure/scan/readiness-input';
import {
  passArtifactDigest,
  readRepositoryPass,
  verifyRepositoryPassTask,
} from '@/infrastructure/scan/repository-pass-files';
import { readRepositoryPredecessor } from '@/infrastructure/scan/repository-predecessor';

import { scanRepositoryPass } from './scan-repository-pass';
import {
  overwritePassJson,
  passFileIdentity,
  passFixture,
  passPlan,
  passState,
} from './scan-repository-pass-fixture';

vi.mock(import('server-only'), () => ({}));
const FIXTURES: ReturnType<typeof passFixture>[] = [];
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {
    /* Assertions use persisted artifacts. */
  });
});
afterEach(() => {
  for (const fixture of FIXTURES.splice(0)) fixture.dispose();
  vi.restoreAllMocks();
});
async function completed() {
  const fixture = passFixture();
  FIXTURES.push(fixture);
  await scanRepositoryPass(fixture.args);
  return fixture;
}
function manifest() {
  return {
    format: 'scan-readiness-input/v1',
    repositoryReport: 'repository.json',
    benchmarkReport: 'benchmark.json',
    questionReview: 'questions.json',
    frozenQuestionReview: 'frozen.json',
    catalogue: 'catalogue.json',
    queries: ['http.json', 'schedule.json'],
    workflowTests: 'tests.json',
    regressionReceipt: 'regression.json',
    nativeReplay: 'native.json',
    interpretation: 'interpretation.json',
    interpretationInputs: 'inputs.json',
  };
}

describe('readiness source artifact input boundary', () => {
  it('accepts the closed readiness manifest and rejects unknown fields or missing query evidence', () => {
    expect(parseReadinessFiles(manifest()).queries).toHaveLength(2);
    expect(() => parseReadinessFiles({ ...manifest(), bypass: true })).toThrow(/Unrecognized/iu);
    expect(() => parseReadinessFiles({ ...manifest(), queries: ['only-one.json'] })).toThrow(
      /small|least|>=2/iu,
    );
  }, 30_000);
  it('reads a complete checkpoint and verifies the exact committed task artifact set', async () => {
    const fixture = await completed();
    const loaded = await readRepositoryPass(fixture.output);
    expect(loaded.state.status).toBe('source_complete');
    expect(loaded.state.completed).toHaveLength(loaded.plan.scopes.length);
    const task = loaded.state.completed[0];
    if (!task) throw new Error('Expected completed task');
    await expect(verifyRepositoryPassTask(fixture.output, task)).resolves.toBeUndefined();
    const artifact = task.artifacts[0];
    if (!artifact) throw new Error('Expected pinned artifact');
    await expect(passArtifactDigest(fixture.output, artifact.path)).resolves.toBe(
      passFileIdentity(path.join(fixture.output, artifact.path)).digest,
    );
  }, 30_000);
  it('rejects artifact traversal, missing files and symlinks before accepting a digest', async () => {
    const fixture = await completed();
    const outside = path.join(fixture.root, 'outside.json');
    writeFileSync(outside, '{}');
    await expect(passArtifactDigest(fixture.output, '../outside.json')).rejects.toThrow(
      'leaves its output directory',
    );
    await expect(passArtifactDigest(fixture.output, 'missing.json')).rejects.toThrow(/ENOENT/u);
    symlinkSync(outside, path.join(fixture.output, 'linked.json'));
    await expect(passArtifactDigest(fixture.output, 'linked.json')).rejects.toThrow(
      'bounded regular file',
    );
  }, 30_000);
  it('rejects incomplete or foreign task sets and changed checkpoint bytes', async () => {
    const fixture = await completed();
    const task = passState(fixture.output).completed[0];
    if (!task) throw new Error('Expected completed task');
    await expect(
      verifyRepositoryPassTask(fixture.output, { ...task, artifacts: task.artifacts.slice(1) }),
    ).rejects.toThrow('artifact set is incomplete');
    await expect(
      verifyRepositoryPassTask(fixture.output, { ...task, metrics: 'foreign/completion.json' }),
    ).rejects.toThrow('outside its pinned attempt');
    const artifact = task.artifacts[0];
    if (!artifact) throw new Error('Expected artifact');
    overwritePassJson(path.join(fixture.output, artifact.path), { corrupted: true });
    await expect(verifyRepositoryPassTask(fixture.output, task)).rejects.toThrow(
      'changed after checkpoint',
    );
  }, 30_000);
  it('rejects incomplete terminal checkpoints and missing prepared scopes', async () => {
    const fixture = await completed();
    const state = passState(fixture.output);
    overwritePassJson(path.join(fixture.output, 'run-state.json'), { ...state, completed: [] });
    await expect(readRepositoryPass(fixture.output)).rejects.toThrow(
      'Terminal source checkpoint is incomplete',
    );
    overwritePassJson(path.join(fixture.output, 'run-state.json'), state);
    const scope = passPlan(fixture.output).scopes[0];
    if (!scope) throw new Error('Expected prepared scope');
    unlinkSync(path.join(fixture.output, scope.id, 'scope.json'));
    await expect(readRepositoryPass(fixture.output)).rejects.toThrow(/ENOENT/u);
  }, 30_000);
  it('checks predecessor inventory and scope pins instead of trusting a publication label', async () => {
    const fixture = await completed();
    const filename = path.join(fixture.output, 'repository.json');
    const previous = await readRepositoryPredecessor(filename);
    expect(previous.repo).toBe('org/repo');
    expect(previous.scopes).toHaveLength(2);
    const scope = previous.scopes[0];
    if (!scope) throw new Error('Expected previous scope');
    overwritePassJson(path.join(fixture.output, scope.id, 'scope.json'), {
      ...scope,
      repo: 'foreign/repo',
    });
    await expect(readRepositoryPredecessor(filename)).rejects.toThrow(
      'do not belong to the previous repository',
    );
    overwritePassJson(path.join(fixture.output, scope.id, 'scope.json'), scope);
    overwritePassJson(path.join(fixture.output, 'inventory.json'), {
      repo: 'foreign/repo',
      commit: previous.commit,
      tree: previous.tree,
      files: previous.files,
    });
    await expect(readRepositoryPredecessor(filename)).rejects.toThrow('different pins');
    writeFileSync(filename, '{');
    await expect(readRepositoryPredecessor(filename)).rejects.toThrow(/JSON|property/iu);
  }, 30_000);
});
