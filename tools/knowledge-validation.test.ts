import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Evidence } from '@/domain/knowledge/knowledge.generated';

import { sourceChecker, sourceProblems } from './knowledge-source-check';
import { validateKnowledgeFiles } from './knowledge-validation';
import { validationOptions } from './knowledge-validation-args';
import { runtimeProofInput } from './runtime-proof-fixture';

vi.mock(import('server-only'), () => ({}));
const { bundle, manifest } = await runtimeProofInput('soft-offer');
const folders: string[] = [];
async function temporary(): Promise<string> {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'groundwork-validation-'));
  folders.push(folder);
  return folder;
}
afterEach(async () => {
  await Promise.all(
    folders.splice(0).map(async (folder) => rm(folder, { recursive: true, force: true })),
  );
});

function git(directory: string, args: readonly string[]): string {
  const result = spawnSync('git', ['-C', directory, ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

describe('canonical scan validation', () => {
  it('validates arbitrary paths and writes a snapshot that can be checked again', async () => {
    const folder = await temporary();
    const input = path.join(folder, 'new-repo.json');
    const snapshot = path.join(folder, 'snapshot.json');
    await writeFile(input, JSON.stringify(bundle));
    const result = await validateKnowledgeFiles({ files: [input], writeSnapshot: snapshot });
    expect(result).toMatchObject({
      snapshot: manifest.id,
      records: 602,
      bundles: 1,
      sourceRangesChecked: 0,
      sourceVerification: 'not_requested',
    });
    await expect(validateKnowledgeFiles({ files: [input], snapshot })).resolves.toEqual(result);
    const original = await readFile(snapshot, 'utf8');
    await expect(
      validateKnowledgeFiles({ files: [input], writeSnapshot: snapshot }),
    ).rejects.toThrow('EEXIST');
    await expect(readFile(snapshot, 'utf8')).resolves.toBe(original);
  });
  it('checks references across the selected bundles and rejects incomplete selections', async () => {
    const folder = await temporary();
    const files = [path.join(folder, 'first.json'), path.join(folder, 'second.json')];
    await Promise.all(
      files.map(async (file, index) =>
        writeFile(
          file,
          JSON.stringify({
            ...bundle,
            records: bundle.records.filter((_, position) => position % 2 === index),
          }),
        ),
      ),
    );
    await expect(validateKnowledgeFiles({ files })).resolves.toMatchObject({
      bundles: 2,
      records: 602,
    });
    await expect(validateKnowledgeFiles({ files: files.slice(0, 1) })).rejects.toThrow(
      'missing reference',
    );
  });
  it('rejects invalid v3 evidence before writing a snapshot', async () => {
    const folder = await temporary();
    const input = path.join(folder, 'invalid.json');
    const snapshot = path.join(folder, 'snapshot.json');
    await writeFile(
      input,
      JSON.stringify({
        ...bundle,
        records: bundle.records.map((record) => {
          if (record.kind !== 'evidence') return record;
          const { host, ...withoutHost } = record;
          expect(host).toBe('github.com');
          return withoutHost;
        }),
      }),
    );
    await expect(
      validateKnowledgeFiles({ files: [input], writeSnapshot: snapshot }),
    ).rejects.toThrow(/.+/u);
    await expect(readFile(snapshot)).rejects.toThrow('ENOENT');
  });
  it('runs as a standalone CLI against the current schema', () => {
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        './tools/register.ts',
        '--conditions=react-server',
        'tools/validate-knowledge.ts',
        'docs/scan-trials/soft-offer-proof/runtime/bundle.json',
        '--snapshot',
        'docs/scan-trials/soft-offer-proof/runtime/snapshot.json',
      ],
      { encoding: 'utf8' },
    );
    expect(result.status, result.stderr).toBe(0);
    const output: unknown = JSON.parse(result.stdout);
    expect(output).toMatchObject({ snapshot: manifest.id, records: 602 });
  });
});

describe('canonical validation arguments', () => {
  it('accepts multiple bundles with explicit snapshot and source roots', () => {
    expect(
      validationOptions([
        'one.json',
        '--sources',
        '/clones',
        'two.json',
        '--snapshot',
        'selected.json',
      ]),
    ).toMatchObject({
      files: ['one.json', 'two.json'],
      sources: '/clones',
      snapshot: 'selected.json',
    });
  });
  it.each([
    [],
    ['one.json', '--unknown', 'x'],
    ['one.json', '--sources'],
    ['one.json', '--sources', '--snapshot', 'x'],
    ['one.json', '--snapshot', 'x', '--snapshot', 'y'],
    ['one.json', '--snapshot', 'x', '--write-snapshot', 'y'],
  ])('rejects ambiguous or incomplete arguments %j', (...args) => {
    expect(() => validationOptions(args)).toThrow(/.+/u);
  });
});

describe('pinned source verification', () => {
  it('reads committed content, checks real line bounds, and reports unavailable sources', async () => {
    const root = await temporary();
    const clone = path.join(root, 'owner', 'repo');
    await mkdir(clone, { recursive: true });
    git(clone, ['init', '--quiet']);
    await writeFile(path.join(clone, 'source.txt'), 'one\ntwo\n');
    git(clone, ['add', 'source.txt']);
    git(clone, [
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.invalid',
      'commit',
      '--quiet',
      '-m',
      'fixture',
    ]);
    const commit = git(clone, ['rev-parse', 'HEAD']);
    const original = bundle.records.find((record) => record.kind === 'evidence');
    if (original?.kind !== 'evidence') throw new Error('Missing evidence');
    const evidence: Evidence = {
      ...original,
      repo: 'owner/repo',
      path: 'source.txt',
      commit,
      lines: [1, 2],
    };
    await writeFile(path.join(clone, 'source.txt'), 'dirty working tree\n');
    expect(sourceProblems(root, evidence)).toEqual([]);
    expect(sourceProblems(root, { ...evidence, lines: [1, 3] })).toContain(
      `${evidence.id}: source range outside pinned file`,
    );
    expect(sourceProblems(root, { ...evidence, path: 'missing.txt' })).toContain(
      `${evidence.id}: pinned file unavailable in local clone`,
    );
    expect(() => sourceProblems(root, { ...evidence, repo: '../../escape' })).toThrow(
      'escapes source root',
    );
  });
  it('checks large pinned files, binary markers and exact trailing line bounds', async () => {
    const root = await temporary();
    const clone = path.join(root, 'owner', 'repo');
    await mkdir(clone, { recursive: true });
    git(clone, ['init', '--quiet']);
    const prefix = 'x'.repeat(5 * 1024 * 1024);
    await writeFile(path.join(clone, 'large.txt'), `${prefix}\r\nlast`);
    await writeFile(path.join(clone, 'binary.txt'), `${prefix}\0\n`);
    await writeFile(path.join(clone, 'empty.txt'), '');
    git(clone, ['add', '.']);
    git(clone, [
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.invalid',
      'commit',
      '-qm',
      'large',
    ]);
    const original = bundle.records.find((record) => record.kind === 'evidence');
    if (original?.kind !== 'evidence') throw new Error('Missing evidence');
    const evidence: Evidence = {
      ...original,
      repo: 'owner/repo',
      path: 'large.txt',
      commit: git(clone, ['rev-parse', 'HEAD']),
      lines: [1, 2],
    };
    const check = sourceChecker(root);
    expect(check(evidence)).toEqual([]);
    expect(check({ ...evidence, lines: [1, 3] })).toEqual([
      `${evidence.id}: source range outside pinned file`,
    ]);
    expect(check({ ...evidence, path: 'binary.txt', lines: [1, 1] })).toEqual([
      `${evidence.id}: source file is not text`,
    ]);
    expect(check({ ...evidence, path: 'empty.txt', lines: [1, 1] })).toEqual([
      `${evidence.id}: source range outside pinned file`,
    ]);
    const blob = git(clone, ['rev-parse', `${evidence.commit}:large.txt`]);
    await rm(path.join(clone, '.git', 'objects', blob.slice(0, 2), blob.slice(2)));
    expect(check(evidence)).toEqual([]);
    expect(sourceProblems(root, evidence)).toEqual([
      `${evidence.id}: pinned file unavailable in local clone`,
    ]);
  });
});
