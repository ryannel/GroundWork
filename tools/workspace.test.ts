import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

const home = process.cwd();
const scratch = path.join(home, 'node_modules', '.cache');
await mkdir(scratch, { recursive: true });
const root = await mkdtemp(path.join(scratch, 'workspace-command-'));
afterAll(async () => rm(root, { recursive: true, force: true }));

function run(
  tool: string,
  args: readonly string[],
  cwd: string,
  env = '',
  extraEnvironment: Readonly<Record<string, string>> = {},
) {
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    ...extraEnvironment,
    GROUNDWORK_WORKSPACES: env,
  };
  delete environment.VITEST;
  return spawnSync(
    process.execPath,
    [
      '--import',
      path.join(home, 'tools/register.ts'),
      '--conditions=react-server',
      path.join(home, 'tools', `${tool}.ts`),
      ...args,
    ],
    {
      cwd,
      encoding: 'utf8',
      env: environment,
    },
  );
}

async function fixture(name: string): Promise<{ cwd: string; company: string }> {
  const cwd = path.join(root, name, 'groundwork');
  const company = path.join(root, name, 'company-model');
  await Promise.all([
    mkdir(path.join(cwd, 'workspaces/personal'), { recursive: true }),
    mkdir(company, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(
      path.join(cwd, 'workspaces/personal/workspace.yaml'),
      'id: personal\nname: Personal\n',
    ),
    writeFile(path.join(company, 'workspace.yaml'), 'id: company\nname: Company\n'),
    writeFile(path.join(cwd, 'groundwork.local.yaml'), 'workspaces: [../company-model]\n'),
  ]);
  return { cwd, company };
}

describe('workspace commands', () => {
  it('lists linked workspace identity and provenance as JSON, without npm or logging mixed in', async () => {
    const { cwd, company } = await fixture('json');
    const result = run('workspace', ['list', '--json'], cwd);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual([
      {
        id: 'personal',
        name: 'Personal',
        folder: path.join(cwd, 'workspaces/personal'),
        source: 'example',
        isExample: true,
        repo: null,
        href: '/personal/',
      },
      {
        id: 'company',
        name: 'Company',
        folder: company,
        source: 'local',
        isExample: false,
        repo: null,
        href: '/company/',
      },
    ]);
  });

  it('shows environment override provenance and excludes other registrations', async () => {
    const { cwd, company } = await fixture('override');
    const json = run('workspace', ['list', '--json'], cwd, company);
    expect(JSON.parse(json.stdout)).toEqual([
      {
        id: 'company',
        name: 'Company',
        folder: company,
        source: 'environment',
        isExample: false,
        repo: null,
        href: '/company/',
      },
    ]);
    const text = run('workspace', ['list'], cwd, company);
    expect(text.stdout).toContain('GROUNDWORK_WORKSPACES overrides');
    expect(text.stdout).toContain('Company (company)');
    expect(text.stdout).not.toContain('Personal');
  });

  it('does not silently choose the bundled example for map or plan commands', async () => {
    const { cwd } = await fixture('selection');
    for (const [tool, args] of [
      ['map', ['repos']],
      ['plan-base', ['check', 'delivery']],
    ] as const) {
      const result = run(tool, args, cwd);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('Choose a workspace with --workspace <id>');
      expect(result.stderr).toContain('Company (company)');
      expect(result.stdout).toBe('');
    }
  });

  it('prints the selected context on stderr and keeps map results as JSON', async () => {
    const { cwd, company } = await fixture('explicit');
    const result = run('map', ['repos', '--workspace', 'company'], cwd);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([]);
    expect(result.stderr).toContain(`Workspace: Company (company) at ${company}`);
  });

  it('leaves registration untouched when add would duplicate a workspace id', async () => {
    const { cwd } = await fixture('duplicate');
    const copy = path.join(cwd, '..', 'copy');
    await mkdir(copy, { recursive: true });
    await writeFile(path.join(copy, 'workspace.yaml'), 'id: company\nname: Copy\n');
    const config = path.join(cwd, 'groundwork.local.yaml');
    const before = await readFile(config, 'utf8');
    const result = run('workspace', ['add', copy], cwd);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('link not changed');
    await expect(readFile(config, 'utf8')).resolves.toBe(before);
  });

  it('does not turn an existing example into a duplicate local registration', async () => {
    const { cwd } = await fixture('example');
    const config = path.join(cwd, 'groundwork.local.yaml');
    const before = await readFile(config, 'utf8');
    const result = run('workspace', ['add', path.join(cwd, 'workspaces/personal')], cwd);
    expect(result.status).toBe(0);
    await expect(readFile(config, 'utf8')).resolves.toBe(before);
    expect(result.stdout).toContain('reload the page');
  });

  it('validates the id and web origin before trying to open a browser', async () => {
    const { cwd } = await fixture('open');
    const missing = run('workspace', ['open', 'company-model'], cwd);
    expect(missing.status).not.toBe(0);
    expect(missing.stderr).toContain('run npm run workspace -- list');
    const invalid = run('workspace', ['open', 'company', '--origin', 'file:///tmp/'], cwd);
    expect(invalid.status).not.toBe(0);
    expect(invalid.stderr).toContain('--origin must be an HTTP or HTTPS origin');
  });

  it.skipIf(process.platform === 'win32')(
    'opens the registered id at the requested server origin',
    async () => {
      const { cwd } = await fixture('browser');
      const bin = path.join(cwd, 'bin');
      await mkdir(bin);
      const launcher = process.platform === 'darwin' ? 'open' : 'xdg-open';
      await writeFile(path.join(bin, launcher), '#!/bin/sh\nprintf \'%s\\n\' "$@"\n', {
        mode: 0o755,
      });
      const result = run(
        'workspace',
        ['open', 'company', '--origin', 'http://127.0.0.1:4567'],
        cwd,
        '',
        {
          PATH: [bin, process.env.PATH ?? ''].join(path.delimiter),
        },
      );
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout.trim().split('\n').at(-1)).toBe('http://127.0.0.1:4567/company/');
    },
  );
});
