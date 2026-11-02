import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { repositoryGit, repositoryInventory } from './scan-repository-inventory';
import { springConfigurationResources, springGraphqlResources } from './scan-spring-resources';

vi.mock(import('server-only'), () => ({}));
let directory = '';
let repository = '';
let commit = '';
const resourcePath = 'core/src/main/resources/graphql-documents/partner.graphql';
const content = 'query Partner($id: ID!) { partner(id: $id) { name address { city } } }';
const options = () => ({
  capture: path.join(directory, 'capture'),
  cloneRoot: directory,
  baseline: { repo: 'fixture/repo', commit },
});

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'graphql-resources-'));
  repository = path.join(directory, 'fixture/repo');
  await mkdir(path.dirname(path.join(repository, resourcePath)), { recursive: true });
  await mkdir(path.join(directory, 'capture/ancillary'), { recursive: true });
  await writeFile(path.join(repository, resourcePath), content);
  await symlink(
    'partner.graphql',
    path.join(repository, path.dirname(resourcePath), 'alias.graphql'),
  );
  await writeFile(path.join(repository, 'ignored.graphql'), content);
  repositoryGit(repository, ['init', '-q']);
  repositoryGit(repository, ['add', '.']);
  repositoryGit(repository, [
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.com',
    'commit',
    '-qm',
    'fixture',
  ]);
  commit = repositoryGit(repository, ['rev-parse', 'HEAD']).toString('utf8').trim();
});
afterEach(async () => rm(directory, { recursive: true, force: true }));

describe('pinned Spring GraphQL resource loading', () => {
  it('reads only tracked regular resources at the pin and projects source variables and nested selections', async () => {
    await writeFile(path.join(repository, resourcePath), 'uncommitted replacement');
    const result = await springGraphqlResources(options());
    expect(result.bindings).toHaveLength(1);
    expect(result.bindings[0]).toMatchObject({
      document_name: 'partner',
      operation_type: 'query',
      operation_name: 'Partner',
    });
    expect(result.bindings[0]?.variables.map(({ name, type }) => ({ name, type }))).toEqual([
      { name: 'id', type: 'ID!' },
    ]);
    expect(result.bindings[0]?.selections.map((selection) => selection.path)).toEqual([
      'partner',
      'partner.name',
      'partner.address',
      'partner.address.city',
    ]);
    expect(result.bindings[0]?.selections[0]?.arguments[0]).toMatchObject({
      name: 'id',
      variable: 'id',
    });
    expect(
      result.sources.every((source) => source.commit === commit && source.path === resourcePath),
    ).toBe(true);
    expect(result.statistics).toEqual({ metadataSizeReads: 1, blobReads: 1, retainedCacheHits: 0 });
    expect(result.gaps).toEqual([]);
  });

  it('validates retained content against the actual Git tree and rejects a substituted cache', async () => {
    const file = repositoryInventory(repository, commit).files.find(
      (entry) => entry.path === resourcePath,
    );
    if (!file) throw new Error('Expected pinned resource');
    const retained = path.join(directory, 'capture/ancillary', `${file.blob}.txt`);
    await writeFile(retained, content);
    const result = await springGraphqlResources(options());
    expect(result.statistics).toEqual({ metadataSizeReads: 1, blobReads: 0, retainedCacheHits: 1 });
    await writeFile(retained, 'query Replaced { another }');
    await expect(springGraphqlResources(options())).rejects.toThrow(
      'does not match pinned Git blob',
    );
  });

  it('reports unsupported syntax and skips oversized Git blobs before a content read', async () => {
    await writeFile(
      path.join(repository, resourcePath),
      'query Unsupported { alias: partner { name } }',
    );
    await writeFile(
      path.join(repository, path.dirname(resourcePath), 'large.graphql'),
      'x'.repeat(1_048_577),
    );
    repositoryGit(repository, ['add', '.']);
    repositoryGit(repository, [
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.com',
      'commit',
      '-qm',
      'unsupported',
    ]);
    commit = repositoryGit(repository, ['rev-parse', 'HEAD']).toString('utf8').trim();
    const result = await springGraphqlResources(options());
    expect(result.bindings).toEqual([]);
    expect(result.gaps).toHaveLength(2);
    expect(result.statistics).toEqual({ metadataSizeReads: 2, blobReads: 1, retainedCacheHits: 0 });
    expect(result.sources).toHaveLength(1);
  });
});

describe('pinned Spring configuration resource loading', () => {
  it('reuses verified retained application YAML and excludes untracked and symbolic resources', async () => {
    const resource = 'core/src/main/resources/application.yml';
    const yaml = 'kafka:\n  customer-event:\n    topic-name: declared-topic\n    enabled: true\n';
    await writeFile(path.join(repository, resource), yaml);
    await symlink(
      'application.yml',
      path.join(repository, 'core/src/main/resources/application-alias.yml'),
    );
    repositoryGit(repository, ['add', '.']);
    repositoryGit(repository, [
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.com',
      'commit',
      '-qm',
      'configuration',
    ]);
    commit = repositoryGit(repository, ['rev-parse', 'HEAD']).toString('utf8').trim();
    const file = repositoryInventory(repository, commit).files.find(
      (entry) => entry.path === resource,
    );
    if (!file) throw new Error('Expected configuration resource.');
    await writeFile(path.join(directory, 'capture/ancillary', `${file.blob}.txt`), yaml);
    await writeFile(path.join(repository, resource), 'topic: worktree-decoy');
    await writeFile(
      path.join(repository, 'core/src/main/resources/application-untracked.yml'),
      'topic: untracked',
    );
    const result = await springConfigurationResources(options());
    expect(result.statistics).toEqual({ metadataSizeReads: 1, blobReads: 0, retainedCacheHits: 1 });
    expect(result.bindings).toHaveLength(1);
    expect(result.bindings[0]?.properties).toEqual([
      expect.objectContaining({ key: 'kafka.customer-event.topic-name', value: 'declared-topic' }),
      expect.objectContaining({ key: 'kafka.customer-event.enabled', value: true }),
    ]);
    expect(
      result.sources.every((source) => source.path === resource && source.commit === commit),
    ).toBe(true);
  });
});
