import { execFile } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { assessFreshness, observeRef, parseRawDiff } from './freshness-git';
import { fixtureCommit, fixtureGit, fixtureRepository } from './freshness-git-fixture';

vi.mock(import('server-only'), () => ({}));
vi.mock(import('node:child_process'), { spy: true });

const repositories: string[] = [];
function repository(): string {
  const folder = fixtureRepository();
  repositories.push(folder);
  return folder;
}
afterEach(() => {
  vi.clearAllMocks();
  for (const folder of repositories.splice(0)) rmSync(folder, { recursive: true, force: true });
});

const checkedAt = '2026-10-24T12:00:00Z';

describe('pinned Git freshness', () => {
  it('ignores dirty and untracked files and makes no deployment claim', async () => {
    const folder = repository();
    const baseline = fixtureCommit(folder, { 'source.ts': 'original' });
    writeFileSync(path.join(folder, 'source.ts'), 'dirty');
    writeFileSync(path.join(folder, 'untracked.ts'), 'untracked');
    const metadataCalls = vi.mocked(execFile);
    const observation = await observeRef({ repository: folder, ref: 'HEAD', checkedAt });
    const result = await assessFreshness({
      repository: folder,
      baseline,
      current: baseline,
      observation,
      provenanceComplete: true,
    });
    expect(result).toMatchObject({
      state: 'unchanged',
      sourceCurrent: true,
      deploymentCurrent: 'unknown',
      changedFiles: [],
    });
    const commands = metadataCalls.mock.calls.map((call) => call[1]);
    expect(commands).toHaveLength(5);
    expect(
      commands.every(
        (args) => Array.isArray(args) && !args.includes('show') && !args.includes('cat-file'),
      ),
    ).toBe(true);
  });

  it('detects additions, changes, exact renames and deletions, including unusual paths', async () => {
    const folder = repository();
    const baseline = fixtureCommit(folder, {
      'old\nname.ts': 'rename',
      'delete.ts': 'delete',
      'change.ts': 'before',
    });
    fixtureGit(folder, ['mv', 'old\nname.ts', 'renamed\tname.ts']);
    fixtureGit(folder, ['rm', '-q', 'delete.ts']);
    const current = fixtureCommit(folder, { 'change.ts': 'after', 'added.ts': 'added' });
    const observation = await observeRef({ repository: folder, ref: 'HEAD', checkedAt });
    const result = await assessFreshness({
      repository: folder,
      baseline,
      current,
      observation,
      provenanceComplete: true,
    });
    expect(result.state).toBe('changed');
    expect(result.sourceCurrent).toBe(false);
    expect(result.changedFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'added.ts', status: 'added' }),
        expect.objectContaining({ path: 'change.ts', status: 'modified' }),
        expect.objectContaining({ path: 'delete.ts', status: 'deleted' }),
        expect.objectContaining({
          path: 'renamed\tname.ts',
          previousPath: 'old\nname.ts',
          status: 'renamed',
        }),
      ]),
    );
  });

  it('detects rewritten tips, missing baselines, unknown provenance and changed rule inputs', async () => {
    const folder = repository();
    const original = fixtureCommit(folder, { 'source.ts': 'original' });
    const baseline = fixtureCommit(folder, { 'source.ts': 'baseline' });
    fixtureGit(folder, ['reset', '--hard', original.commit]);
    const current = fixtureCommit(folder, { 'source.ts': 'rewrite' });
    const observation = await observeRef({ repository: folder, ref: 'HEAD', checkedAt });
    const input = { repository: folder, baseline, current, observation, provenanceComplete: true };
    await expect(assessFreshness(input)).resolves.toMatchObject({ state: 'ref-rewritten' });
    await expect(
      assessFreshness({ ...input, baseline: { ...baseline, commit: '0'.repeat(40) } }),
    ).resolves.toMatchObject({ state: 'baseline-unavailable' });
    await expect(assessFreshness({ ...input, provenanceComplete: false })).resolves.toMatchObject({
      sourceCurrent: false,
    });
    await expect(
      assessFreshness({
        ...input,
        baseline: current,
        current: { ...current, ruleDigest: 'new' },
      }),
    ).resolves.toMatchObject({ state: 'rules-changed' });
    await expect(
      assessFreshness({
        ...input,
        baseline: current,
        current: { ...current, configDigest: 'new' },
      }),
    ).resolves.toMatchObject({ state: 'configuration-changed' });
  });

  it('does not call a mismatched observation or ref current', async () => {
    const folder = repository();
    const baseline = fixtureCommit(folder, { 'binary.dat': '\0binary\0' });
    const observation = await observeRef({ repository: folder, ref: 'HEAD', checkedAt });
    const input = {
      repository: folder,
      baseline,
      current: baseline,
      observation,
      provenanceComplete: true,
    };
    const mismatch = await assessFreshness({
      ...input,
      observation: {
        checkedAt,
        ref: 'HEAD',
        source: 'local',
        status: 'observed',
        revision: 'a'.repeat(40),
      },
    });
    expect(mismatch).toMatchObject({ state: 'unknown-provenance', sourceCurrent: false });
    const unknown = await assessFreshness({ ...input, provenanceComplete: false });
    expect(unknown).toMatchObject({ state: 'unknown-provenance', sourceCurrent: false });
    const changedRef = await assessFreshness({ ...input, current: { ...baseline, ref: 'other' } });
    expect(changedRef).toMatchObject({ state: 'unknown-provenance', sourceCurrent: false });
  });

  it('never reports a failed remote check as current', async () => {
    const folder = repository();
    const baseline = fixtureCommit(folder, { 'source.ts': 'original' });
    const observation = await observeRef({
      repository: folder,
      ref: 'refs/heads/main',
      remote: path.join(folder, 'missing.git'),
      checkedAt,
    });
    expect(observation).toMatchObject({ status: 'unavailable', source: 'remote' });
    await expect(
      assessFreshness({
        repository: folder,
        baseline,
        current: baseline,
        observation,
        provenanceComplete: true,
      }),
    ).resolves.toMatchObject({ sourceCurrent: false });
  });

  it('parses gitlinks without reading blobs and rejects unsupported or malformed records', () => {
    expect(parseRawDiff(':160000 160000 old new M\0module\0')).toEqual([
      { status: 'modified', path: 'module', oldBlob: 'old', newBlob: 'new', gitlink: true },
    ]);
    expect(() => parseRawDiff(':100644 100644 old new C100\0name\0')).toThrow('Unsupported');
    expect(() => parseRawDiff('bad\0name\0')).toThrow('Invalid');
    expect(() => parseRawDiff('truncated')).toThrow('Incomplete');
    expect(() => parseRawDiff(':100644 100644 old new R100\0name\0')).toThrow('Incomplete');
  });
});
