import * as fs from 'fs';
import * as path from 'path';
import { Ctx } from '../util/context';
import { capture, commandExists } from '../util/proc';
import { getAppServices, serviceDir } from '../util/services';
import { DEV_CLI_VERSION, stampedFrameworkVersion } from '../util/version';

interface Check {
  name: string;
  ok: boolean;
  hint?: string;
}

export async function doctor(ctx: Ctx): Promise<number> {
  const { r } = ctx;
  const json = ctx.json || ctx.args.includes('--json');
  const checks: Check[] = [];

  // System dependencies
  checks.push({ name: 'docker', ok: commandExists('docker'), hint: 'Install Docker Desktop or the docker engine.' });
  const compose = capture('docker', ['compose', 'version']);
  checks.push({ name: 'docker compose', ok: compose.status === 0, hint: 'Install the Docker Compose v2 plugin.' });

  // Service-driven dependencies
  let needsNode = false;
  let needsGo = false;
  let needsAir = false;
  let needsPython = false;
  for (const svc of getAppServices()) {
    const dir = serviceDir(svc);
    if (fs.existsSync(path.join(dir, 'package.json'))) needsNode = true;
    if (fs.existsSync(path.join(dir, 'go.mod'))) needsGo = true;
    if (fs.existsSync(path.join(dir, '.air.toml'))) needsAir = true;
    if (fs.existsSync(path.join(dir, 'pyproject.toml'))) needsPython = true;
  }
  if (needsNode) checks.push({ name: 'npm', ok: commandExists('npm'), hint: 'Install Node.js (includes npm).' });
  if (needsGo) checks.push({ name: 'go', ok: commandExists('go'), hint: 'Install the Go toolchain.' });
  if (needsAir) checks.push({ name: 'air', ok: commandExists('air'), hint: 'go install github.com/air-verse/air@latest' });
  if (needsPython)
    checks.push({
      name: 'python',
      ok: commandExists('python3') || commandExists('python'),
      hint: 'Install Python 3.',
    });

  // Framework alignment: a ./dev bundle that trails the install's framework stamp
  // means `npx groundwork-method update` ran from an older package or never ran —
  // the bundle is framework-owned and update refreshes it.
  const stamp = stampedFrameworkVersion();
  if (stamp && DEV_CLI_VERSION !== 'unknown') {
    checks.push({
      name: 'dev bundle version',
      ok: stamp === DEV_CLI_VERSION,
      hint: `bundle ${DEV_CLI_VERSION} trails framework ${stamp} — run npx groundwork-method update, then groundwork check for the full staleness report.`,
    });
  }

  const missing = checks.filter((c) => !c.ok);

  if (json) {
    process.stdout.write(
      JSON.stringify({ ok: missing.length === 0, checks }, null, 2) + '\n',
    );
    return 0; // doctor is an info command — always exits 0
  }

  r.logo('Environment Verification (Doctor)');
  r.table(
    'Dependencies',
    checks.map((c) => [c.name, c.ok ? 'ok' : 'MISSING', c.ok ? '' : (c.hint ?? '')] as [string, string, string]),
  );
  if (missing.length === 0) {
    r.success('Your environment is ready!');
  } else {
    r.errorCard(
      `Found ${missing.length} missing ${missing.length === 1 ? 'dependency' : 'dependencies'}.`,
      missing.map((c) => `${c.name}: ${c.hint ?? ''}`).join('  '),
    );
  }
  return 0; // always 0, even with missing deps
}
