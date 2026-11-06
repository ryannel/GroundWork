import { execFileSync, spawn } from 'node:child_process';
import { mkdir, open, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { withSite } from '../../../../tools/rebuild/site.ts';

const proof = 'artifacts/rebuild/verification/pr6';
const { values } = parseArgs({ options: { recorded: { type: 'string', default: `${proof}/recorded-production` } } });
await mkdir(`${proof}/comparison`, { recursive: true });
await withSite(undefined, async (upstream) => {
  const proxy = spawn('/usr/bin/python3', [`${proof}/capture-proxy.py`, '--upstream', upstream, '--out', values.recorded], { stdio: ['ignore', 'pipe', 'inherit'] });
  try {
    const origin = await new Promise((resolve, reject) => {
      proxy.once('error', reject);
      proxy.stdout.once('data', (chunk) => resolve(JSON.parse(chunk.toString()).origin));
    });
    const results = {};
    for (const workspace of ['personal', 'acme', 'volvo-cars']) {
      const log = await open(`.workspaces/rebuild/pr6/compare-${workspace}.log`, 'w');
      try {
        execFileSync(process.execPath, ['--import', './tools/register.ts', '--conditions=react-server', 'tools/rebuild/compare.ts', '--before', `artifacts/rebuild/baseline/${workspace}`, '--workspace', workspace, '--out', `${proof}/comparison/${workspace}`, '--origin', origin], { stdio: ['ignore', log.fd, log.fd] });
        results[workspace] = { captured: true, exit: 0 };
      } catch (error) {
        if (error.status !== 1) throw error;
        results[workspace] = { captured: true, exit: 1, note: 'Inspect exact unexplained differences before allowing any change.' };
      } finally {
        await log.close();
      }
      process.stdout.write(JSON.stringify({ workspace, ...results[workspace] }) + '\n');
    }
    await writeFile(`${proof}/capture-result.json`, JSON.stringify(results, null, 2) + '\n');
  } finally {
    proxy.kill();
    if (proxy.exitCode === null) await new Promise((resolve) => proxy.once('exit', resolve));
  }
});
