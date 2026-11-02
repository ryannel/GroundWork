import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { readAncillaryBlob } from '@/infrastructure/scan/ancillary-blob-cache';
import { fixtureCommit, fixtureGit } from '@/infrastructure/scan/freshness-git-fixture';

import { retainAncillary } from './scan-repository-ancillary';
import { repositoryInventory, repositoryGit } from './scan-repository-inventory';

vi.mock(import('server-only'), () => ({}));
vi.mock(import('@/infrastructure/scan/ancillary-blob-cache'), async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    readAncillaryBlob: vi.fn<typeof original.readAncillaryBlob>(original.readAncillaryBlob),
  };
});
vi.mock(import('./scan-repository-inventory'), async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    repositoryGit: vi.fn<typeof original.repositoryGit>(original.repositoryGit),
  };
});
const folders: string[] = [];
afterEach(() => {
  vi.clearAllMocks();
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'ancillary-retention-'));
  folders.push(root);
  const repository = path.join(root, 'repo');
  mkdirSync(repository);
  fixtureGit(repository, ['init', '-q']);
  fixtureGit(repository, ['config', 'user.email', 'fixture@example.test']);
  fixtureGit(repository, ['config', 'user.name', 'Fixture']);
  fixtureCommit(repository, { 'settings.yml': 'enabled: true\n' });
  writeFileSync(path.join(repository, 'binary.jar'), Buffer.from([0, 255, 1]));
  fixtureGit(repository, ['add', '--all']);
  fixtureGit(repository, ['commit', '-qm', 'Binary fixture']);
  return { root, repository, cacheDirectory: path.join(root, 'cache') };
}
async function retain(input: ReturnType<typeof fixture>, name: string, cached = true) {
  const output = path.join(input.root, name);
  mkdirSync(output);
  return retainAncillary({
    repository: input.repository,
    output,
    files: repositoryInventory(input.repository).files,
    ...(cached ? { cacheDirectory: input.cacheDirectory } : {}),
  });
}
function rawReads(): number {
  return vi
    .mocked(repositoryGit)
    .mock.calls.filter(([, args]) => args[0] === 'cat-file' && args[1] === 'blob').length;
}

describe('optional ancillary cache retention', () => {
  it('reuses unchanged text and binary bytes without another Git blob read', async () => {
    const input = fixture();
    const first = await retain(input, 'first');
    expect(first).toMatchObject({
      blobReads: 2,
      cacheHits: 0,
      retainedTextFiles: 1,
      excludedFiles: 1,
    });
    vi.mocked(repositoryGit).mockClear();
    const warm = await retain(input, 'warm');
    expect(warm).toMatchObject({
      metadataSizeReads: 2,
      blobReads: 0,
      cacheHits: 2,
      retainedTextFiles: 1,
      excludedFiles: 1,
    });
    expect(rawReads()).toBe(0);
    expect(warm.files.find((file) => file.path === 'binary.jar')).toMatchObject({
      origin: 'cache',
      state: 'excluded',
      evidence: null,
    });
  });
  it('reuses renamed identical bytes and reads only modified blobs', async () => {
    const input = fixture();
    await retain(input, 'first');
    renameSync(
      path.join(input.repository, 'settings.yml'),
      path.join(input.repository, 'renamed.xml'),
    );
    fixtureGit(input.repository, ['add', '--all']);
    fixtureGit(input.repository, ['commit', '-qm', 'Rename']);
    vi.mocked(repositoryGit).mockClear();
    const moved = await retain(input, 'renamed');
    expect(moved).toMatchObject({ blobReads: 0, cacheHits: 2 });
    expect(rawReads()).toBe(0);
    fixtureCommit(input.repository, { 'renamed.xml': '<changed/>' });
    vi.mocked(repositoryGit).mockClear();
    await expect(retain(input, 'modified')).resolves.toMatchObject({ blobReads: 1, cacheHits: 1 });
    expect(rawReads()).toBe(1);
  });
  it('rebuilds corrupt cache bytes from pinned Git and leaves legacy no-cache behaviour unchanged', async () => {
    const input = fixture();
    const first = await retain(input, 'first');
    const text = first.files.find((file) => file.path === 'settings.yml');
    if (!text) throw new Error('Missing text fixture');
    writeFileSync(path.join(input.cacheDirectory, `${text.blob}.json`), '{broken');
    vi.mocked(repositoryGit).mockClear();
    await expect(retain(input, 'repaired')).resolves.toMatchObject({ blobReads: 1, cacheHits: 1 });
    expect(rawReads()).toBe(1);
    vi.mocked(repositoryGit).mockClear();
    await expect(retain(input, 'legacy', false)).resolves.toMatchObject({
      blobReads: 2,
      cacheHits: 0,
    });
    expect(rawReads()).toBe(2);
  });
  it('checks the 1MiB metadata limit before cache or Git blob reads', async () => {
    const input = fixture();
    fixtureCommit(input.repository, { 'large.xml': ' '.repeat(1_048_577) });
    const files = repositoryInventory(input.repository).files.filter(
      (file) => file.path === 'large.xml',
    );
    const output = path.join(input.root, 'oversize');
    mkdirSync(output);
    vi.mocked(repositoryGit).mockClear();
    vi.mocked(readAncillaryBlob).mockClear();
    const result = await retainAncillary({
      repository: input.repository,
      output,
      files,
      cacheDirectory: input.cacheDirectory,
    });
    expect(result).toMatchObject({
      metadataSizeReads: 1,
      blobReads: 0,
      cacheHits: 0,
      excludedFiles: 1,
      files: [{ origin: 'none', state: 'excluded', bytes: 1_048_577 }],
    });
    expect(vi.mocked(readAncillaryBlob)).not.toHaveBeenCalled();
    expect(rawReads()).toBe(0);
  });
});

describe('positively proved canonical data retention', () => {
  it('retains full proven data over1MiB while leaving default text limit unchanged', async () => {
    const input = fixture();
    const fixturePath = 'apps/site/.storybook/mocks/data.ts';
    mkdirSync(path.dirname(path.join(input.repository, fixturePath)), { recursive: true });
    fixtureCommit(input.repository, {
      'apps/site/.storybook/main.ts':
        "import type {StorybookConfig} from '@storybook/react'; export default {};",
      [fixturePath]: `export default {text: "${'x'.repeat(1_048_576)}"};`,
    });
    const files = repositoryInventory(input.repository).files;
    const data = files.find((file) => file.path === fixturePath);
    expect(data).toMatchObject({
      category: 'test',
      selectedForParsing: false,
      canonicalData: { classification: 'canonical_data_fixture' },
    });
    const output = path.join(input.root, 'canonical');
    mkdirSync(output);
    const result = await retainAncillary({
      repository: input.repository,
      output,
      files,
      cacheDirectory: input.cacheDirectory,
    });
    expect(result.textLimitBytes).toBe(1_048_576);
    expect(result.files.find((file) => file.path === fixturePath)).toMatchObject({
      state: 'retained_unparsed',
    });
  });
  it('rechecks literal purity rather than trusting a forged canonical tag and correct hash', async () => {
    const input = fixture();
    const fixturePath = 'apps/site/.storybook/mocks/data.ts';
    mkdirSync(path.dirname(path.join(input.repository, fixturePath)), { recursive: true });
    const runtime = 'export default factory();';
    fixtureCommit(input.repository, {
      'apps/site/.storybook/main.ts':
        "import type {StorybookConfig} from '@storybook/react'; export default {};",
      [fixturePath]: 'export default {};',
      'runtime.ts': runtime,
    });
    const files = repositoryInventory(input.repository).files;
    const data = files.find((file) => file.path === fixturePath);
    const other = files.find((file) => file.path === 'runtime.ts');
    if (data?.canonicalData === undefined || other === undefined) {
      throw new Error('Missing canonical fixture');
    }
    const forged = {
      ...data,
      blob: other.blob,
      canonicalData: {
        ...data.canonicalData,
        sha256: createHash('sha256').update(runtime).digest('hex'),
      },
    };
    const output = path.join(input.root, 'forged');
    mkdirSync(output);
    await expect(
      retainAncillary({ repository: input.repository, output, files: [forged] }),
    ).rejects.toThrow('Canonical data fixture proof or source digest changed');
  });
});
