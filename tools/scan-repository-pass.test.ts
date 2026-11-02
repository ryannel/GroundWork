import { existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { fixtureCommit, fixtureGit } from '@/infrastructure/scan/freshness-git-fixture';
import type {
  scopedFingerprint,
  scopedProvenance,
  scopedProvenances,
} from '@/infrastructure/scan/scoped-source-provenance';
import { runScopedSources } from '@/infrastructure/scan/scoped-source-store';

import { scanRepositoryPass } from './scan-repository-pass';
import {
  overwritePassJson,
  passFileIdentity,
  passFixture,
  passJson,
  passPlan,
  passState,
} from './scan-repository-pass-fixture';

vi.mock(import('server-only'), () => ({}));
const provenance = vi.hoisted(() => ({ rule: 'f'.repeat(64) }));
vi.mock(import('@/infrastructure/scan/scoped-source-provenance'), async (importOriginal) => {
  const original = await importOriginal();
  const fingerprint: typeof scopedFingerprint = (scope, options) => {
    const actual = original.scopedFingerprint(scope, options);
    return { ...actual, provenance: { ...actual.provenance, ruleDigest: provenance.rule } };
  };
  const current: typeof scopedProvenance = (scope, options) => ({
    ...original.scopedProvenance(scope, options),
    ruleDigest: provenance.rule,
  });
  const currentBatch: typeof scopedProvenances = (scopes, options) =>
    original.scopedProvenances(scopes, options).map((item) => ({
      ...item,
      ruleDigest: provenance.rule,
    }));
  return {
    ...original,
    scopedFingerprint: fingerprint,
    scopedProvenance: current,
    scopedProvenances: currentBatch,
  };
});
vi.mock(import('@/infrastructure/scan/scoped-source-store'), async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    runScopedSources: vi.fn<typeof original.runScopedSources>(original.runScopedSources),
  };
});
const inputs: ReturnType<typeof passFixture>[] = [];
function fixture(files?: Readonly<Record<string, string>>) {
  const input = passFixture(files);
  inputs.push(input);
  return input;
}
afterEach(() => {
  for (const input of inputs.splice(0)) input.dispose();
  provenance.rule = 'f'.repeat(64);
  vi.clearAllMocks();
  vi.restoreAllMocks();
});
async function stopped() {
  const input = fixture();
  await scanRepositoryPass([...input.args, '--stop-after', '1']);
  vi.mocked(runScopedSources).mockClear();
  return input;
}

describe('repository source checkpoint and resume', () => {
  it('resumes only pending tasks, preserves committed files, and ignores unfinished attempts', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {
      /* Progress is asserted through saved checkpoint artefacts. */
    });
    const input = await stopped();
    const state = passState(input.output);
    expect(state).toMatchObject({ status: 'stopped', completed: [{ scope: 'repository-0001' }] });
    expect(existsSync(path.join(input.output, 'repository.json'))).toBe(false);
    const task = state.completed[0];
    if (!task) throw new Error('Missing completed fixture task');
    const before = task.artifacts.map((artifact) =>
      passFileIdentity(path.join(input.output, artifact.path)),
    );
    const abandoned = path.join(input.output, 'repository-0002', 'attempt-deadbeef');
    mkdirSync(abandoned);
    writeFileSync(path.join(abandoned, 'partial.json'), '{}');
    await scanRepositoryPass([...input.args, '--resume']);
    const completed = passState(input.output);
    expect(completed.status).toBe('source_complete');
    expect(completed.completed).toHaveLength(2);
    expect(completed.completed[1]?.attempt).not.toBe('attempt-deadbeef');
    expect(vi.mocked(runScopedSources)).toHaveBeenCalledTimes(1);
    expect(
      task.artifacts.map((artifact) => passFileIdentity(path.join(input.output, artifact.path))),
    ).toEqual(before);
    expect(passJson(path.join(input.output, 'repository.json'))).toMatchObject({
      status: 'partial',
      runStatus: 'source_complete',
      semanticAcceptance: 'not_established',
      widerScans: 'stopped',
      modelCalls: 0,
      modelUsageScope: 'deterministic_source_phase',
      interpretation: { status: 'pending', required: true },
    });
  }, 30_000);
  it('honours STOP between tasks without selecting an aggregate', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {
      /* Progress is asserted through saved checkpoint artefacts. */
    });
    const input = await stopped();
    writeFileSync(path.join(input.output, 'STOP'), 'Stop requested');
    await scanRepositoryPass([...input.args, '--resume']);
    expect(passState(input.output).status).toBe('stopped');
    expect(vi.mocked(runScopedSources)).not.toHaveBeenCalled();
    expect(existsSync(path.join(input.output, 'repository.json'))).toBe(false);
    unlinkSync(path.join(input.output, 'STOP'));
    await scanRepositoryPass([...input.args, '--resume']);
    expect(passState(input.output).status).toBe('source_complete');
  }, 30_000);
  it('rejects corrupted completed artifacts before any pending source work', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {
      /* Progress is asserted through saved checkpoint artefacts. */
    });
    const input = await stopped();
    const artifact = passState(input.output).completed[0]?.artifacts[0];
    if (!artifact) throw new Error('Missing completed fixture artifact');
    overwritePassJson(path.join(input.output, artifact.path), { corrupted: true });
    await expect(scanRepositoryPass([...input.args, '--resume'])).rejects.toThrow(
      'artifact changed',
    );
    expect(vi.mocked(runScopedSources)).not.toHaveBeenCalled();
  }, 30_000);
  it('rejects pin, source policy and analysis changes before any pending source work', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {
      /* Progress is asserted through saved checkpoint artefacts. */
    });
    const input = await stopped();
    const differentPin = input.args.map((argument, index) =>
      input.args[index - 1] === '--commit' ? 'a'.repeat(40) : argument,
    );
    await expect(scanRepositoryPass([...differentPin, '--resume'])).rejects.toThrow('changed');
    await expect(
      scanRepositoryPass([...input.args, '--resume', '--max-source-bytes', '16']),
    ).rejects.toThrow('changed');
    provenance.rule = 'e'.repeat(64);
    await expect(scanRepositoryPass([...input.args, '--resume'])).rejects.toThrow(
      'analysis changed',
    );
    expect(vi.mocked(runScopedSources)).not.toHaveBeenCalled();
  }, 30_000);
  it('rejects a corrupted prepared scope before any pending source work', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {
      /* Progress is asserted through saved checkpoint artefacts. */
    });
    const input = await stopped();
    const scope = passPlan(input.output).scopes[1];
    if (!scope) throw new Error('Missing pending fixture scope');
    overwritePassJson(path.join(input.output, scope.id, 'scope.json'), {
      ...scope,
      commit: 'a'.repeat(40),
    });
    await expect(scanRepositoryPass([...input.args, '--resume'])).rejects.toThrow(
      /scope|checkpoint|task|complete/iu,
    );
    expect(vi.mocked(runScopedSources)).not.toHaveBeenCalled();
  }, 30_000);
  it('never accepts a terminal checkpoint with a missing task', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {
      /* Progress is asserted through saved checkpoint artefacts. */
    });
    const input = fixture();
    await scanRepositoryPass(input.args);
    const state = passState(input.output);
    overwritePassJson(path.join(input.output, 'run-state.json'), { ...state, completed: [] });
    vi.mocked(runScopedSources).mockClear();
    await expect(scanRepositoryPass([...input.args, '--resume'])).rejects.toThrow(
      /scope|checkpoint|task|complete/iu,
    );
    expect(vi.mocked(runScopedSources)).not.toHaveBeenCalled();
  }, 30_000);
  it('uses a predecessor inventory without rechunking unchanged or renamed source', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {
      /* Progress is asserted through saved checkpoint artefacts. */
    });
    const input = fixture();
    await scanRepositoryPass(input.args);
    renameSync(path.join(input.repository, 'b.ts'), path.join(input.repository, 'z.ts'));
    fixtureGit(input.repository, ['add', '--all']);
    const revision = fixtureCommit(input.repository, {
      '0.ts': 'export function added() { return 3; }',
    });
    const output = path.join(input.root, 'next-output');
    const next = input.args.map((argument, index) => {
      if (index === 2) return output;
      return input.args[index - 1] === '--commit' ? revision.commit : argument;
    });
    await scanRepositoryPass([...next, '--previous', path.join(input.output, 'repository.json')]);
    const plan = passPlan(output);
    expect(plan.scopes.map((scope) => [scope.id, scope.files[0]?.path])).toEqual([
      ['repository-0001', 'a.ts'],
      ['repository-0002', 'z.ts'],
      ['repository-0003', '0.ts'],
    ]);
    expect(passJson(path.join(output, 'repository.json'))).toMatchObject({
      runStatus: 'source_complete',
      changes: { added: ['0.ts'], renamed: [{ previousPath: 'b.ts', path: 'z.ts' }] },
      trials: [
        {
          scope: 'repository-0001',
          extraction: { stats: { blobReads: 0, parsedFiles: 0, indexHits: 1 } },
        },
        {
          scope: 'repository-0002',
          extraction: { stats: { blobReads: 0, parsedFiles: 0, indexHits: 1 } },
        },
        {
          scope: 'repository-0003',
          extraction: { stats: { blobReads: 1, parsedFiles: 1, indexHits: 0 } },
        },
      ],
    });
  }, 30_000);
  it('records typed source-budget failure and publishes no aggregate', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {
      /* Progress is asserted through saved checkpoint artefacts. */
    });
    const input = fixture({ 'large.ts': 'export function tooLarge() { return 1; }' });
    await expect(
      scanRepositoryPass([...input.args, '--max-source-bytes', '8']),
    ).rejects.toMatchObject({ code: 'SOURCE_BUDGET_EXCEEDED', path: 'large.ts', limit: 8 });
    expect(passState(input.output)).toMatchObject({
      status: 'failed',
      completed: [],
      failure: { scope: 'repository-0001', code: 'SOURCE_BUDGET_EXCEEDED' },
    });
    expect(existsSync(path.join(input.output, 'repository.json'))).toBe(false);
  }, 30_000);
});
