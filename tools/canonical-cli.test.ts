import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseDocument } from 'yaml';

import { modelRecord } from '@/domain/workspace-model';

const home = process.cwd();
const fixture = path.join(home, 'test/fixtures/model');
let valid: string;
beforeAll(async () => {
  valid = await mkdtemp(path.join(tmpdir(), 'groundwork-canonical-cli-'));
  await cp(fixture, valid, { recursive: true });
  const system = path.join(valid, 'domains/orders/systems/ordering/system.yaml');
  const document = parseDocument(await readFile(system, 'utf8'));
  document.delete('connections');
  await writeFile(system, String(document));
  execFileSync('git', ['init', '--quiet', valid]);
  execFileSync('git', ['-C', valid, 'add', '.']);
});
afterAll(async () => rm(valid, { recursive: true, force: true }));
function run(tool: string, args: readonly string[], folder = fixture) {
  const env: NodeJS.ProcessEnv = { ...process.env, GROUNDWORK_WORKSPACES: folder };
  delete env.VITEST;
  return spawnSync(
    process.execPath,
    [
      '--import',
      path.join(home, 'tools/register.ts'),
      '--conditions=react-server',
      path.join(home, 'tools', `${tool}.ts`),
      ...args,
    ],
    { cwd: home, encoding: 'utf8', env },
  );
}
describe('canonical CLI boundaries', () => {
  it('checks current facts and every canonical plan without the legacy reader', () => {
    const result = run('workspace', ['check', valid], valid);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('model-fixture:');
    expect(result.stdout).toContain('1 of 1 plan read');
  });
  it('fails on the fixture’s deliberately unbacked connection through the native check', () => {
    const result = run('workspace', ['check', fixture]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('The stated connection has no recorded execution backing.');
    expect(result.stderr).not.toContain('origin must be');
    expect(result.stdout).toContain('1 of 1 plan read');
  });
  it('checks staged canonical plans without requiring a legacy base lock', () => {
    const result = run('workspace', ['precommit', valid], valid);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('1 of 1 plan read');
  });
  it('rejects a canonical plan whose op does not fit today', async () => {
    const file = path.join(valid, 'plans/confirm/plan.yaml');
    const before = await readFile(file, 'utf8');
    try {
      await writeFile(
        file,
        before.replace("modify: 'h:confirm#tx/save'", "modify: 'h:missing#tx/save'"),
      );
      const result = run('workspace', ['check', valid], valid);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('h:missing#tx/save');
      expect(result.stdout).toContain('0 of 1 plan read');
    } finally {
      await writeFile(file, before);
    }
  });
  it('rejects staged canonical plans whose checked text is not all staged', async () => {
    const file = path.join(valid, 'plans/confirm/plan.yaml');
    const before = await readFile(file, 'utf8');
    try {
      await writeFile(
        file,
        before.replace('title: Explain confirmation', 'title: Confirm the order'),
      );
      const result = run('workspace', ['precommit', valid], valid);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('stage the checked plan');
    } finally {
      await writeFile(file, before);
    }
  });
  it.each(['api:confirm', 'h:confirm#tx/save', 'ev:effect'])(
    'shows the ordinary canonical fact for %s',
    (id) => {
      const result = run('map', ['--workspace', 'model-fixture', 'show', id]);
      expect(result.status, result.stderr).toBe(0);
      const shown: unknown = JSON.parse(result.stdout);
      expect(modelRecord(modelRecord(shown)?.fact)?.id).toBe(id);
      expect(result.stderr).toContain(
        `Workspace: Model contract fixture (model-fixture) at ${fixture}`,
      );
    },
  );
});
