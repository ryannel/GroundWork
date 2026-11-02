import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { fixtureCommit } from '@/infrastructure/scan/freshness-git-fixture';
import { readRepositoryPredecessor } from '@/infrastructure/scan/repository-predecessor';

import { repositoryDeltaScopes } from './scan-repository-delta';
import { repositoryInventory } from './scan-repository-inventory';
import { passFixture, passJson } from './scan-repository-pass-fixture';
import { prepareRepositoryPass } from './scan-repository-pass-plan';

vi.mock(import('server-only'), () => ({}));
const inputs: ReturnType<typeof passFixture>[] = [];
afterEach(() => {
  for (const input of inputs.splice(0)) input.dispose();
});
const fixturePath = '.storybook/mocks/data.ts';
function fixture() {
  const input = passFixture();
  inputs.push(input);
  mkdirSync(path.join(input.repository, '.storybook/mocks'), { recursive: true });
  const pin = fixtureCommit(input.repository, {
    '.storybook/main.ts':
      "import type {StorybookConfig} from '@storybook/react'; export default {};",
    [fixturePath]: 'export default {sample:[1,true,null]};',
  });
  return { ...input, pin };
}

describe('canonical fixture adapter routing through real planning contracts', () => {
  it('preserves inventory but routes no canonical data file to a native adapter', async () => {
    const input = fixture();
    const inventory = repositoryInventory(input.repository, input.pin.commit);
    expect(inventory.files).toHaveLength(4);
    expect(inventory.files.find((file) => file.path === fixturePath)).toMatchObject({
      category: 'test',
      language: null,
      selectedForParsing: false,
      canonicalData: { classification: 'canonical_data_fixture' },
    });
    const delta = repositoryDeltaScopes({
      inventory,
      repo: 'org/repo',
      workspace: 'org',
      shardSize: 2,
    });
    expect(delta.scopes.flatMap((scope) => scope.files).map((file) => file.path)).toEqual([
      '.storybook/main.ts',
      'a.ts',
      'b.ts',
    ]);
    const prepared = await prepareRepositoryPass({
      repo: 'org/repo',
      cloneRoot: input.root,
      output: input.output,
      commit: input.pin.commit,
      shardSize: 2,
    });
    expect(prepared.state.status).toBe('prepared');
    expect(prepared.plan.scopes).toHaveLength(2);
    expect(passJson(path.join(input.output, 'inventory.json'))).toMatchObject({
      denominator: 4,
      ancillary: { retainedTextFiles: 1 },
    });
  });
  it('keeps the existing native routing invariant strict against inconsistent metadata', () => {
    const input = fixture();
    const inventory = repositoryInventory(input.repository, input.pin.commit);
    const corrupted = {
      ...inventory,
      files: inventory.files.map((file) =>
        file.path === fixturePath ? { ...file, language: 'typescript' as const } : file,
      ),
    };
    expect(() =>
      repositoryDeltaScopes({
        inventory: corrupted,
        repo: 'org/repo',
        workspace: 'org',
        shardSize: 2,
      }),
    ).toThrow('Inconsistent source selection metadata');
  });
  it('round-trips canonical metadata through strict predecessor validation and delta planning', async () => {
    const input = fixture();
    const prepared = await prepareRepositoryPass({
      repo: 'org/repo',
      cloneRoot: input.root,
      output: input.output,
      commit: input.pin.commit,
      shardSize: 2,
    });
    const report = path.join(input.output, 'repository.json');
    writeFileSync(
      report,
      JSON.stringify({
        format: 'scan-repository/v1',
        repo: 'org/repo',
        commit: input.pin.commit,
        tree: input.pin.tree,
        inventory: 'inventory.json',
      }),
    );
    const previous = await readRepositoryPredecessor(report);
    const inventory = repositoryInventory(input.repository, input.pin.commit);
    expect(previous.files.find((file) => file.path === fixturePath)).toEqual(
      inventory.files.find((file) => file.path === fixturePath),
    );
    const delta = repositoryDeltaScopes({
      inventory,
      repo: 'org/repo',
      workspace: 'org',
      shardSize: 2,
      previousInventory: previous.files,
      previousScopes: previous.scopes,
    });
    expect(delta.scopes).toEqual(prepared.plan.scopes);
    expect(delta.changes.modified).toEqual([]);
    expect(delta.changes.unchanged).toHaveLength(4);
  });
});
