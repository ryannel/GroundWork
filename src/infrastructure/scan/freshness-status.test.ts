import { beforeEach, describe, expect, it, vi } from 'vitest';

import { assessFreshness, observeRef, resolveCommitTree } from './freshness-git';
import { checkFreshness } from './freshness-status';

vi.mock(import('server-only'), () => ({}));
vi.mock(import('./freshness-git'), () => ({
  assessFreshness: vi.fn<typeof assessFreshness>(),
  observeRef: vi.fn<typeof observeRef>(),
  resolveCommitTree: vi.fn<typeof resolveCommitTree>(),
}));

const baseline = {
  repo: 'test',
  ref: 'refs/heads/main',
  commit: 'a'.repeat(40),
  tree: 'b'.repeat(40),
  environmentDigest: 'env',
  configDigest: 'config',
  toolchainDigest: 'tools',
  ruleDigest: 'rules',
};
const observation = {
  status: 'observed',
  source: 'local',
  ref: baseline.ref,
  revision: baseline.commit,
  checkedAt: '2026-10-24T12:00:00Z',
} as const;
const input = { repository: '/fixture', baseline, checkedAt: observation.checkedAt };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(observeRef).mockResolvedValue(observation);
  vi.mocked(resolveCommitTree).mockResolvedValue(baseline.tree);
  vi.mocked(assessFreshness).mockResolvedValue({
    baseline,
    observation,
    state: 'unknown-provenance',
    sourceCurrent: false,
    deploymentCurrent: 'unknown',
    changedFiles: [],
  });
});

describe('freshness status orchestration', () => {
  it('labels source-only checks and never claims unchanged analysis when provenance was not recomputed', async () => {
    const result = await checkFreshness(input);
    expect(result).toMatchObject({
      verification: 'source-only',
      sourceUnchanged: true,
      rescanRequired: true,
      changedFileListKnown: true,
      currentBaseline: baseline,
    });
    expect(observeRef).toHaveBeenCalledWith({
      repository: input.repository,
      ref: baseline.ref,
      checkedAt: input.checkedAt,
    });
    expect(assessFreshness).toHaveBeenCalledWith(
      expect.objectContaining({ provenanceComplete: false }),
    );
  });

  it('accepts explicit current analysis provenance and a remote observation', async () => {
    vi.mocked(observeRef).mockResolvedValue({ ...observation, source: 'remote' });
    vi.mocked(assessFreshness).mockResolvedValue({
      baseline,
      observation,
      state: 'unchanged',
      sourceCurrent: true,
      deploymentCurrent: 'unknown',
      changedFiles: [],
    });
    const result = await checkFreshness({
      ...input,
      remote: 'origin',
      ref: baseline.ref,
      provenance: baseline,
    });
    expect(result).toMatchObject({ verification: 'analysis', rescanRequired: false });
    expect(observeRef).toHaveBeenCalledWith(expect.objectContaining({ remote: 'origin' }));
    expect(assessFreshness).toHaveBeenCalledWith(
      expect.objectContaining({ provenanceComplete: true }),
    );
  });

  it('requires a rescan with unknown changed files when remote objects are unavailable locally', async () => {
    vi.mocked(observeRef).mockResolvedValue({
      ...observation,
      source: 'remote',
      revision: 'c'.repeat(40),
    });
    vi.mocked(resolveCommitTree).mockResolvedValue(null);
    vi.mocked(assessFreshness).mockResolvedValue({
      baseline,
      observation,
      state: 'baseline-unavailable',
      sourceCurrent: false,
      deploymentCurrent: 'unknown',
      changedFiles: [],
    });
    const result = await checkFreshness({ ...input, remote: 'origin' });
    expect(result).toMatchObject({
      currentBaseline: null,
      sourceUnchanged: false,
      rescanRequired: true,
      changedFileListKnown: false,
    });
  });

  it('does not resolve objects after an unavailable observation', async () => {
    vi.mocked(observeRef).mockResolvedValue({
      ...observation,
      status: 'unavailable',
      error: 'offline',
    });
    const result = await checkFreshness({ ...input, remote: 'origin' });
    expect(result).toMatchObject({
      currentBaseline: null,
      sourceUnchanged: false,
      changedFileListKnown: false,
      rescanRequired: true,
    });
    expect(resolveCommitTree).not.toHaveBeenCalled();
  });
});
