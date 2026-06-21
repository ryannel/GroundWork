import * as fs from 'fs';
import * as path from 'path';
import { Ctx } from '../util/context';
import { capture, commandExists, dockerComposeCapture, httpProbe } from '../util/proc';
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

  // ── Runtime connectivity (FAIL LOUD) ──────────────────────────────────────
  // Beyond "is the binary installed", prove the running stack is actually
  // reachable. Uses compose SERVICE names (db/redis/jaeger), not container names.
  const cfg = dockerComposeCapture(['config', '--services']);
  const composeServices = new Set(
    cfg.status === 0 ? cfg.stdout.split('\n').map((s) => s.trim()).filter(Boolean) : [],
  );
  const stackUp = dockerComposeCapture(['ps', '-q']).stdout.trim().length > 0;
  const hasServices = getAppServices().length > 0;

  const connectivity: Check[] = [];
  if (hasServices && !stackUp) {
    connectivity.push({ name: 'stack', ok: false, hint: "down — run './dev start' (or './dev start --docker')." });
  }
  if (composeServices.has('db')) {
    const ok = stackUp && dockerComposeCapture(['exec', '-T', 'db', 'pg_isready', '-U', 'postgres']).status === 0;
    connectivity.push({ name: 'postgres (:5432)', ok, hint: ok ? undefined : 'db not accepting connections.' });
  }
  if (composeServices.has('redis')) {
    const ping = stackUp ? dockerComposeCapture(['exec', '-T', 'redis', 'redis-cli', 'ping']) : null;
    const ok = ping !== null && /PONG/i.test(ping.stdout);
    connectivity.push({ name: 'redis (:6379)', ok, hint: ok ? undefined : 'no PONG from redis.' });
  }
  if (composeServices.has('jaeger')) {
    const code = await httpProbe('http://localhost:16686/api/services');
    const ok = code === 200;
    connectivity.push({ name: 'jaeger (:16686)', ok, hint: ok ? undefined : `query API returned ${code}.` });
  }

  // Migration tooling: Python services apply schemas via pg-schema-diff, which
  // runs through the Go toolchain (same path Go services use).
  const tooling: Check[] = [];
  if (needsPython) {
    const ok = commandExists('go');
    tooling.push({
      name: 'go (pg-schema-diff)',
      ok,
      hint: ok ? undefined : "Python './dev migrate' needs the Go toolchain.",
    });
  }

  const depMissing = checks.filter((c) => !c.ok);
  // Runtime/tooling failures are genuine problems and gate the exit code; the
  // dependency checks above stay advisory (historical behaviour).
  const runtimeMissing = [...connectivity, ...tooling].filter((c) => !c.ok);
  const exitCode = runtimeMissing.length > 0 ? 1 : 0;

  if (json) {
    const allChecks = [...checks, ...connectivity, ...tooling];
    process.stdout.write(
      JSON.stringify({ ok: allChecks.every((c) => c.ok), checks: allChecks }, null, 2) + '\n',
    );
    return exitCode;
  }

  r.logo('Environment Verification (Doctor)');
  r.table(
    'Dependencies',
    checks.map((c) => [c.name, c.ok ? 'ok' : 'MISSING', c.ok ? '' : (c.hint ?? '')] as [string, string, string]),
  );
  r.table(
    'Runtime Connectivity',
    connectivity.map((c) => [c.name, c.ok ? 'ok' : 'FAIL', c.ok ? '' : (c.hint ?? '')] as [string, string, string]),
  );
  if (tooling.length > 0) {
    r.table(
      'Migration Tooling',
      tooling.map((c) => [c.name, c.ok ? 'ok' : 'MISSING', c.ok ? '' : (c.hint ?? '')] as [string, string, string]),
    );
  }

  const allMissing = [...depMissing, ...runtimeMissing];
  if (allMissing.length === 0) {
    r.success('Your environment is ready!');
  } else {
    r.errorCard(
      `Found ${allMissing.length} issue(s).`,
      allMissing.map((c) => `${c.name}: ${c.hint ?? ''}`).join('  '),
    );
  }
  return exitCode;
}
