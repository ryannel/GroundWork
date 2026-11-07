import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

async function execute(
  file: string,
  args: readonly string[],
  options: { readonly env: NodeJS.ProcessEnv },
): Promise<{ readonly stdout: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { ...options, encoding: 'utf8' }, (error, stdout) => {
      if (error !== null) {
        reject(Object.assign(new Error(error.message), { code: error.code }));
        return;
      }
      resolve({ stdout });
    });
  });
}

/** Real CLI processes use the production readers; the HTTP fixture isolates comparison from Next streaming. */
describe('rebuild commands', () => {
  it('captures, detects real drift and accepts only the exact explained differences', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'groundwork-rebuild-test-'));
    const workspace = path.join(root, 'workspace');
    const { mkdir } = await import('node:fs/promises');
    await mkdir(workspace);
    await writeFile(path.join(workspace, 'workspace.yaml'), 'format: 2\nid: probe\nname: Probe\n');
    const before = path.join(root, 'before');
    const after = path.join(root, 'after');
    const allowed = path.join(root, 'allowed.yaml');
    await writeFile(allowed, 'format: 1\ndifferences: []\n');
    let message = 'Original wording';
    const server = createServer((request, response) => {
      const json = request.url?.endsWith('model.json') === true;
      response.setHeader('content-type', json ? 'application/json' : 'text/html');
      response.end(
        json
          ? '{"workspace":"probe"}'
          : `<h1>${message}</h1><a href="/probe/">Probe</a><button data-inspect="svc:probe">Inspect</button>`,
      );
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('No HTTP fixture port.');
    const origin = `http://127.0.0.1:${String(address.port)}`;
    const run = async (command: string, args: readonly string[]) =>
      execute(
        process.execPath,
        [
          '--import',
          './tools/register.ts',
          '--conditions=react-server',
          `tools/rebuild/${command}.ts`,
          '--workspace',
          'probe',
          '--origin',
          origin,
          ...args,
        ],
        { env: { ...process.env, GROUNDWORK_WORKSPACES: workspace } },
      );
    const compare = async () =>
      run('compare', ['--before', before, '--out', after, '--allowed', allowed]);
    try {
      await run('baseline', ['--out', before, '--as-of', '2026-11-05']);
      await expect(run('baseline', ['--out', before])).rejects.toHaveProperty(
        'message',
        expect.stringContaining('baseline already exists'),
      );
      await expect(
        run('compare', ['--before', before, '--out', before, '--allowed', allowed]),
      ).rejects.toHaveProperty('message', expect.stringContaining('must not overwrite'));

      await expect(compare()).resolves.toHaveProperty(
        'stdout',
        expect.stringContaining('0 unexplained'),
      );
      const facts = path.join(root, 'facts-only');
      await run('facts-only', ['--before', before, '--out', facts]);
      const authored = path.join(workspace, 'workspace.yaml');
      await writeFile(authored, 'format: 2\nid: probe\nname: Changed after fact capture\n');
      await expect(
        run('compare', [
          '--before',
          before,
          '--facts',
          facts,
          '--out',
          after,
          '--allowed',
          allowed,
        ]),
      ).resolves.toHaveProperty('stdout', expect.stringContaining('0 unexplained'));
      await writeFile(authored, 'format: 2\nid: probe\nname: Probe\n');
      message = 'Changed wording with a different size';
      await expect(compare()).rejects.toHaveProperty('code', 1);
      const report = JSON.parse(await readFile(path.join(after, 'comparison.json'), 'utf8')) as {
        changes: Record<string, unknown>[];
      };
      expect(report.changes.map((row) => row.path)).toContain('/payload/text');
      await writeFile(
        allowed,
        JSON.stringify({
          format: 1,
          differences: report.changes.map((row) => ({
            ...row,
            workspace: 'probe',
            reason: 'Reviewed wording change.',
          })),
        }),
      );
      const replay = async () =>
        run('compare', ['--before', before, '--candidate', after, '--allowed', allowed]);
      message = 'Live site changed after the candidate was captured';
      await expect(replay()).resolves.toHaveProperty(
        'stdout',
        expect.stringContaining('0 unexplained'),
      );
      message = 'A later unreviewed change';
      await expect(compare()).rejects.toHaveProperty('code', 1);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  });
});
