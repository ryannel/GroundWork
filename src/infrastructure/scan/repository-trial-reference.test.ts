import { describe, expect, it, vi } from 'vitest';

import type { RepositoryPassTask } from './repository-pass-state';
import { repositoryTrialReference } from './repository-trial-reference';

vi.mock(import('server-only'), () => ({}));
const digest = 'a'.repeat(64);
const generation = 'b'.repeat(64);
const prefix = `repository-0001/attempt-fixture/${generation}`;
const task: RepositoryPassTask = {
  scope: 'repository-0001',
  attempt: 'attempt-fixture',
  generation,
  metrics: 'repository-0001/attempt-fixture/completion.json',
  artifacts: [{ path: 'repository-0001/attempt-fixture/completion.json', digest }],
};
const baseline = {
  repo: 'fixture/repo',
  commit: 'a'.repeat(40),
  tree: 'b'.repeat(40),
  ref: 'HEAD',
  environmentDigest: digest,
  ruleDigest: digest,
  toolchainDigest: digest,
  configDigest: digest,
};
function metrics() {
  return {
    trial: 'first',
    scope: task.scope,
    generation,
    document: `${prefix}/document.json`,
    coverage: `${prefix}/coverage.json`,
    publicValidation: 'passed',
    extraction: {
      elapsedMs: 1,
      cpuMs: 1,
      stats: { blobReads: 0, parsedFiles: 0, indexHits: 1, reusedFiles: 1, sourceBytes: 0 },
    },
    freshness: {
      elapsedMs: 1,
      currentBaseline: baseline,
      verification: 'analysis',
      sourceUnchanged: true,
      rescanRequired: false,
      changedFileListKnown: true,
      freshness: {
        state: 'unchanged',
        baseline,
        sourceCurrent: true,
        deploymentCurrent: 'unknown',
        observation: {
          checkedAt: '2026-10-26T00:00:00Z',
          ref: 'HEAD',
          source: 'local',
          status: 'observed',
          revision: baseline.commit,
        },
        changedFiles: Array.from({ length: 1000 }, (_, i) => ({
          status: 'modified',
          path: `${String(i)}.ts`,
        })),
      },
    },
  };
}

describe('bounded repository trial references', () => {
  it('links complete committed metrics without duplicating or changing freshness detail', () => {
    const full = metrics();
    const before = JSON.stringify(full);
    const reference = repositoryTrialReference(task, full, digest);
    expect(reference).toMatchObject({
      scope: task.scope,
      metrics: task.metrics,
      metricsDigest: digest,
    });
    expect(JSON.stringify(reference).length).toBeLessThan(1000);
    expect(JSON.stringify(full)).toBe(before);
    expect(reference).not.toHaveProperty('freshness');
  });

  it.each([
    { scope: 'outside' },
    { generation: 'c'.repeat(64) },
    { document: '../outside/document.json' },
    { coverage: `${prefix}/wrong.json` },
    { publicValidation: 'failed' },
    { trial: 'warm' },
    { freshness: null },
    { freshness: {} },
    { freshness: { ...metrics().freshness, currentBaseline: {} } },
  ])('rejects unverified or mismatching trial identity %j', (change) => {
    expect(() => repositoryTrialReference(task, { ...metrics(), ...change }, digest)).toThrow(
      /checkpoint|Invalid/u,
    );
  });

  it('rejects a changed metrics digest and an uncommitted or traversing metrics path', () => {
    expect(() => repositoryTrialReference(task, metrics(), 'c'.repeat(64))).toThrow('checkpoint');
    expect(() =>
      repositoryTrialReference({ ...task, metrics: '../completion.json' }, metrics(), digest),
    ).toThrow('checkpoint');
    expect(() => repositoryTrialReference({ ...task, artifacts: [] }, metrics(), digest)).toThrow(
      'checkpoint',
    );
  });
  it('rejects a missing freshness record rather than silently publishing an unqualified reference', () => {
    const missing: Record<string, unknown> = { ...metrics() };
    delete missing.freshness;
    expect(() => repositoryTrialReference(task, missing, digest)).toThrow('freshness');
  });
  it('retains an explicit unavailable observation without pretending the source is current', () => {
    const full = metrics();
    const unavailable = {
      ...full,
      freshness: {
        ...full.freshness,
        currentBaseline: null,
        sourceUnchanged: false,
        rescanRequired: true,
        changedFileListKnown: false,
        freshness: {
          ...full.freshness.freshness,
          state: 'observation-unavailable',
          sourceCurrent: false,
          observation: {
            checkedAt: '2026-10-26T00:00:00Z',
            ref: 'HEAD',
            source: 'remote',
            status: 'unavailable',
            error: 'offline',
          },
          changedFiles: [],
        },
      },
    };
    expect(repositoryTrialReference(task, unavailable, digest).metricsDigest).toBe(digest);
  });
});
