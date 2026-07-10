import * as fs from 'fs';
import { Ctx, CliError, elapsedSince } from '../util/context';
import {
  capture,
  dockerComposeRun,
  dockerComposeCapture,
  httpProbe,
  run,
  sleep,
  spawnBackground,
} from '../util/proc';
import {
  getAppServices,
  getInfraServices,
  isRunning,
  isDead,
  readPid,
  removePid,
  killTree,
  bootCommand,
  writePid,
  serviceDir,
  servicePort,
  serviceHealthPath,
} from '../util/services';
import { ensureDirs, logFile, PID_DIR, LOG_DIR, ROOT } from '../util/paths';
import { Runner } from '../util/runners';
import { findDocsRunner } from '../util/docs-runner';
import { renderBetPanel, betPanelJson } from './bet-panel';
import { Renderer } from '../theme/render';
import * as path from 'path';

/** Boot a single declared runner: spawn detached from its cwd/env, write its
 *  pid, and verify it didn't exit immediately. This is the spawn/pid/log path
 *  shared by `start()`'s Phase C (autostart runners) and `./dev docs`'s
 *  on-demand boot (C1) — one code path, so the two never drift. Returns the
 *  pid once verified alive, or null if it died immediately (an error card has
 *  already been rendered, matching start()'s prior inline behavior). */
export async function bootRunner(r: Renderer, runner: Runner): Promise<number | null> {
  ensureDirs();
  r.startSpinner(`Booting ${runner.name}`);
  const fd = fs.openSync(logFile(runner.name), 'a');
  const env = runner.env ? { ...process.env, ...runner.env } : process.env;
  const cwd = runner.cwd ? path.join(ROOT, runner.cwd) : ROOT;
  const pid = spawnBackground(runner.cmd, fd, { cwd, env });
  fs.closeSync(fd);
  writePid(runner.name, pid);
  await sleep(500);
  if (readPid(runner.name) !== null && !isRunning(runner.name)) {
    r.failSpinner(`${runner.name} failed to start`);
    r.errorCard(`${runner.name} exited immediately`, `Check .dev/logs/${runner.name}.log for the cause.`);
    return null;
  }
  r.stopSpinner(`${runner.name} started natively (PID ${pid})`);
  return pid;
}

export async function start(ctx: Ctx): Promise<number> {
  const { r } = ctx;
  const docker = ctx.args.includes('--docker');
  ensureDirs();
  const startMs = Date.now();

  if (docker) {
    r.startSpinner('Starting ALL services via Docker');
    // --build so the running containers always reflect the current source. Without
    // it `compose up` silently reuses a stale cached image, so code changes (and
    // CI, which builds fresh on a clean runner) diverge from local runs.
    if (dockerComposeRun(['up', '-d', '--build']) !== 0) {
      r.failSpinner('Failed to start services');
      throw new CliError('docker compose up failed', "Run './dev doctor' to verify Docker is running.");
    }
    r.stopSpinner('All services started via Docker', elapsedSince(startMs));
    return 0;
  }

  const infra = getInfraServices();
  const services = getAppServices();
  const autostartRunners = ctx.runners.filter((x) => x.autostart !== false);

  // Tell the truth: a workspace with no containers, no app services, and no
  // runners has nothing to start. Report that plainly — and point at the fix —
  // rather than printing a success card for an empty stack (no empty capabilities).
  if (infra.length === 0 && services.length === 0 && autostartRunners.length === 0) {
    r.warn('Nothing to start: no containerized services, native services, or runners are registered.');
    r.info('Wire this app into ./dev so `start` runs it: register a runner in .dev/dev.config.json');
    r.info('(name + launch command), or add a project command under .dev/commands/. See docs/architecture/infrastructure.md.');
    return 0;
  }

  // Phase A: infrastructure in Docker
  if (infra.length > 0) {
    r.startSpinner('Starting Infrastructure (Docker)');
    if (dockerComposeRun(['up', '-d', ...infra]) !== 0) {
      r.failSpinner('Failed to start infrastructure');
      throw new CliError('docker compose up failed', "Run './dev doctor' to verify Docker is running.");
    }
    r.stopSpinner('Infrastructure started');
  }

  // Phase B: app services natively
  for (const svc of services) {
    if (isRunning(svc)) {
      r.substep(`${svc} is already running`);
      continue;
    }
    const cmd = bootCommand(svc);
    if (!cmd) {
      r.warn(`Unknown service type for ${svc}. Skipping.`);
      continue;
    }
    r.startSpinner(`Booting ${svc}`);
    const fd = fs.openSync(logFile(svc), 'a');
    const pid = spawnBackground(cmd, fd);
    fs.closeSync(fd);
    writePid(svc, pid);
    await sleep(500);
    if (readPid(svc) !== null && !isRunning(svc)) {
      r.failSpinner(`${svc} failed to start`);
      r.errorCard(`${svc} exited immediately`, `Check .dev/logs/${svc}.log for the cause.`);
    } else {
      r.stopSpinner(`${svc} started natively (PID ${pid})`);
    }
  }

  // Phase C: declared native runners (surfaces, sidecars)
  for (const runner of autostartRunners) {
    if (isRunning(runner.name)) {
      r.substep(`${runner.name} is already running`);
      continue;
    }
    await bootRunner(r, runner);
  }

  const parts: string[] = [];
  if (infra.length) parts.push(`${infra.length} infra`);
  if (services.length) parts.push(`${services.length} service${services.length > 1 ? 's' : ''}`);
  if (autostartRunners.length) parts.push(`${autostartRunners.length} runner${autostartRunners.length > 1 ? 's' : ''}`);
  r.success(`Development environment started — ${parts.join(', ')}. (${elapsedSince(startMs)})`);
  r.info("Run './dev logs' to read service output.");
  return 0;
}

export async function stop(ctx: Ctx): Promise<number> {
  const { r } = ctx;
  const startMs = Date.now();
  r.startSpinner('Stopping environment');
  for (const svc of getAppServices()) {
    const pid = readPid(svc);
    if (pid !== null && isRunning(svc)) {
      await killTree(pid);
    }
    removePid(svc);
  }
  for (const runner of ctx.runners) {
    const pid = readPid(runner.name);
    if (pid !== null && isRunning(runner.name)) {
      await killTree(pid);
    }
    removePid(runner.name);
  }
  if (dockerComposeRun(['down']) !== 0) {
    // down is best-effort; continue
  }
  r.stopSpinner('Environment stopped', elapsedSince(startMs));
  return 0;
}

export async function clean(ctx: Ctx): Promise<number> {
  const { r } = ctx;
  const hard = ctx.args.includes('--hard');
  const startMs = Date.now();
  r.startSpinner('Stopping services & wiping native state');
  for (const svc of getAppServices()) {
    const pid = readPid(svc);
    if (pid !== null && isRunning(svc)) {
      await killTree(pid);
    }
  }
  for (const runner of ctx.runners) {
    const pid = readPid(runner.name);
    if (pid !== null && isRunning(runner.name)) {
      await killTree(pid);
    }
  }
  fs.rmSync(PID_DIR, { recursive: true, force: true });
  fs.rmSync(LOG_DIR, { recursive: true, force: true });
  ensureDirs();
  r.stopSpinner('Wiped native state (.dev/pids, .dev/logs)');

  r.startSpinner('Cleaning Docker environment');
  if (hard) {
    dockerComposeRun(['down', '-v', '--remove-orphans']);
    r.stopSpinner('Docker environment destroyed (volumes wiped)');
  } else {
    dockerComposeRun(['down', '--remove-orphans']);
    r.stopSpinner('Docker environment stopped (volumes preserved)');
  }
  r.success(`Workspace clean complete. (${elapsedSince(startMs)})`);
  return 0;
}

/** Full-cycle recycle: stop everything → wipe volumes → start fresh → migrate.
 *  Forwards `--docker` to `start` so `./dev reset --docker` cleanly rebuilds the
 *  Docker topology. Reuses the existing lifecycle steps rather than reimplementing
 *  teardown/wipe. */
export async function reset(ctx: Ctx): Promise<number> {
  const { r } = ctx;
  r.logo('Resetting Environment');
  r.info('Full cycle: stop → clean (wipe volumes) → start → migrate.');

  await stop(ctx);
  // clean reads --hard from ctx.args; force a volume wipe regardless of how
  // reset was invoked, while leaving start's view of --docker intact.
  await clean({ ...ctx, args: ['--hard'] });
  await start(ctx);
  await migrate(ctx);

  r.success('Environment reset complete.');
  return 0;
}

interface HealthRow {
  service: string;
  port: number | null;
  status: 'healthy' | 'down' | 'unknown';
  code: number;
}

async function probeService(svc: string): Promise<HealthRow> {
  const port = servicePort(svc);
  if (port === null) return { service: svc, port: null, status: 'unknown', code: 0 };
  const code = await httpProbe(`http://localhost:${port}${serviceHealthPath(svc)}`);
  return { service: svc, port, status: code === 200 ? 'healthy' : 'down', code };
}

function healthLabel(row: HealthRow): [string, string, string] {
  if (row.status === 'unknown') return [row.service, 'unknown port', 'skipped'];
  if (row.status === 'healthy') return [row.service, 'healthy', row.port ? `:${row.port}` : ''];
  const detail = row.code ? `down (${row.code})` : 'down';
  return [row.service, detail, row.port ? `:${row.port}` : ''];
}

/** Actively HTTP-poll every app service's health endpoint plus Jaeger's query
 *  API. A down endpoint is a row, never a crash; exits 1 if anything is unhealthy. */
export async function health(ctx: Ctx): Promise<number> {
  const { r } = ctx;
  const json = ctx.json || ctx.args.includes('--json');

  const services = await Promise.all(getAppServices().map(probeService));
  const jcode = await httpProbe('http://localhost:16686/api/services');
  const jaeger: HealthRow = {
    service: 'jaeger',
    port: 16686,
    status: jcode === 200 ? 'healthy' : 'down',
    code: jcode,
  };

  const unhealthy = [...services, jaeger].filter((row) => row.status !== 'healthy').length;

  if (json) {
    process.stdout.write(
      JSON.stringify({ ok: unhealthy === 0, services, observability: [jaeger] }, null, 2) + '\n',
    );
    return unhealthy === 0 ? 0 : 1;
  }

  r.logo('Service Health');
  r.table('App Services', services.length ? services.map(healthLabel) : []);
  r.table('Observability', [healthLabel(jaeger)]);

  if (unhealthy === 0) {
    r.success('All services healthy.');
    return 0;
  }
  r.errorCard(
    `${unhealthy} endpoint(s) unhealthy.`,
    "Run './dev start' (or './dev start --docker') and retry.",
  );
  return 1;
}

export async function migrate(ctx: Ctx): Promise<number> {
  const { r } = ctx;

  // No database in this workspace → nothing to migrate. A local-first or
  // surface-only project provisions no `db` service; don't wait 120s for a
  // container that will never appear.
  const composeServices = capture('docker', ['compose', 'config', '--services']);
  const hasDb =
    composeServices.status === 0 &&
    composeServices.stdout
      .split('\n')
      .map((s) => s.trim())
      .includes('db');
  if (!hasDb) {
    r.info('No database in this workspace; nothing to migrate.');
    return 0;
  }

  const db = `${ctx.projectPrefix}-db`;
  r.startSpinner(`Waiting for database (${db})`);
  let ready = false;
  for (let i = 0; i < 120; i += 1) {
    const res = capture('docker', ['inspect', "--format={{.State.Health.Status}}", db]);
    if (res.status === 0 && res.stdout.trim() === 'healthy') {
      ready = true;
      break;
    }
    await sleep(1000);
  }
  if (!ready) {
    r.failSpinner('Database did not become healthy');
    throw new CliError(`Database ${db} not healthy after 120s`, "Run './dev start' and check 'docker compose ps'.");
  }
  r.stopSpinner('Database ready');

  for (const svc of getAppServices()) {
    const dbName = svc;
    r.step(`Migrating ${svc} (db: ${dbName})`);
    const exists = capture('docker', [
      'exec',
      db,
      'psql',
      '-U',
      'postgres',
      '-tc',
      `SELECT 1 FROM pg_database WHERE datname='${dbName}'`,
    ]);
    if (exists.status === 0 && /\b1\b/.test(exists.stdout)) {
      r.substep(`Database '${dbName}' already exists.`);
    } else {
      const created = capture('docker', ['exec', db, 'psql', '-U', 'postgres', '-c', `CREATE DATABASE "${dbName}";`]);
      if (created.status === 0) {
        r.substep(`Created database '${dbName}'.`);
      } else {
        r.warn(`Could not create database '${dbName}' (continuing).`);
      }
    }

    const schemaScript = path.join(serviceDir(svc), 'scripts', 'apply-schema.sh');
    if (fs.existsSync(schemaScript)) {
      r.startSpinner(`Applying schema for ${svc}`);
      const url = `postgres://postgres:postgres@localhost:5432/${dbName}?sslmode=disable`;
      const applied = run('bash', ['scripts/apply-schema.sh'], {
        cwd: serviceDir(svc),
        env: { ...process.env, DATABASE_URL: url },
      });
      if (applied === 0) {
        r.stopSpinner(`Schema applied for ${svc}`);
      } else {
        r.failSpinner(`Schema failed for ${svc}`);
        throw new CliError(`apply-schema.sh failed for ${svc}`, 'Check the schema script and database connectivity.');
      }
    } else {
      r.substep(`No apply-schema.sh for ${svc}; database created only.`);
    }
  }
  r.success('Migrations complete.');
  return 0;
}

/** True if `name` is a known docker-compose service in this workspace. */
function composeServiceExists(name: string): boolean {
  const res = dockerComposeCapture(['config', '--services']);
  if (res.status !== 0) return false;
  return res.stdout
    .split('\n')
    .map((s) => s.trim())
    .includes(name);
}

export async function logs(ctx: Ctx): Promise<number> {
  const { r } = ctx;
  const follow = ctx.args.includes('--follow') || ctx.args.includes('-f');
  const target = ctx.args.find((a) => !a.startsWith('-'));

  if (target) {
    // Prefer a native log file if the service has one; otherwise treat it as a
    // docker-compose container. Unknown names fail loud rather than streaming
    // everything (the surprising alternative).
    const f = logFile(target);
    if (fs.existsSync(f)) {
      if (follow) {
        if (!r.painter.caps.isTTY) {
          throw new CliError(
            'logs --follow requires an interactive terminal',
            `Omit --follow to print recent logs, or read .dev/logs/${target}.log directly.`,
          );
        }
        r.info(`Streaming logs: ${target} (Ctrl+C to stop)...`);
        return run('tail', ['-f', f]);
      }
      const tail = fs.readFileSync(f, 'utf8').split('\n').slice(-40).join('\n');
      r.step(`${target} (last 40 lines)`);
      process.stdout.write(tail + '\n');
      return 0;
    }
    if (composeServiceExists(target)) {
      if (follow) {
        if (!r.painter.caps.isTTY) {
          throw new CliError(
            'logs --follow requires an interactive terminal',
            'Omit --follow to print recent logs and exit.',
          );
        }
        return dockerComposeRun(['logs', '-f', target]);
      }
      return dockerComposeRun(['logs', '--tail', '40', target]);
    }
    throw new CliError(`Unknown service: ${target}`, "Run './dev status' to list known services.");
  }

  if (!follow) {
    // Non-streaming by default: print recent native logs and a compose snapshot,
    // then exit. This keeps the command safe for agents and pipes.
    for (const svc of [...getAppServices(), ...ctx.runners.map((x) => x.name)]) {
      const f = logFile(svc);
      if (fs.existsSync(f)) {
        const lines = fs.readFileSync(f, 'utf8').split('\n');
        const tail = lines.slice(-40).join('\n');
        r.step(`${svc} (last 40 lines)`);
        process.stdout.write(tail + '\n');
      }
    }
    dockerComposeRun(['logs', '--tail', '40']);
    return 0;
  }

  if (!r.painter.caps.isTTY) {
    throw new CliError('logs --follow requires an interactive terminal', 'Omit --follow to print recent logs and exit, or read .dev/logs/*.log directly.');
  }
  r.info('Streaming logs (Ctrl+C to stop)...');
  // Stream compose logs in the foreground; native logs are in .dev/logs/*.log.
  return dockerComposeRun(['logs', '-f']);
}

interface StatusJson {
  docker: Array<{ service: string; status: string; ports: string }>;
  native: Array<{ service: string; status: 'running'; pid: number }>;
}

function collectStatus(runners: Runner[]): StatusJson {
  const composePs = dockerComposeCapture(['ps', '--format', '{{.Service}}|{{.Status}}|{{.Ports}}']);
  const docker = composePs.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [service = '', stat = '', ports = ''] = l.split('|');
      return { service, status: stat, ports };
    });
  const native: StatusJson['native'] = [];
  for (const svc of getAppServices()) {
    if (isRunning(svc)) native.push({ service: svc, status: 'running', pid: readPid(svc)! });
  }
  for (const runner of runners) {
    if (isRunning(runner.name)) native.push({ service: runner.name, status: 'running', pid: readPid(runner.name)! });
  }
  return { docker, native };
}

/** A runner's URL cell (C1b — URL truth in status): a port-carrying runner
 *  that's running renders its live URL; the docs runner specifically, when
 *  not running, renders the boot hint instead of a dead link. Every other
 *  stopped/port-carrying runner renders no URL — there's no general boot verb
 *  for it yet, so a URL there would be a promise the CLI can't keep. */
function runnerUrlCell(r: Ctx['r'], runner: Runner, running: boolean, isDocsRunner: boolean): string | undefined {
  const port = runner.env?.PORT;
  if (!port) return undefined;
  if (running) return r.painter.paint('accent', `http://localhost:${port}`);
  if (isDocsRunner) return r.painter.paint('accent', './dev docs');
  return undefined;
}

function renderStatusTables(r: Ctx['r'], data: StatusJson, runners: Runner[]): void {
  r.table(
    'Docker Containers',
    data.docker.map((d) => {
      const ports = d.ports.length > 15 ? d.ports.slice(0, 12) + '...' : d.ports;
      return [d.service, d.status, ports] as [string, string, string];
    }),
  );
  const docsRunner = findDocsRunner(runners);
  const runnerByName = new Map(runners.map((rn) => [rn.name, rn]));
  const nativeRows: Array<[string, string, string, string?]> = [];
  const running = new Set(data.native.map((n) => n.service));
  for (const n of data.native) {
    const runner = runnerByName.get(n.service);
    const url = runner ? runnerUrlCell(r, runner, true, docsRunner?.name === runner.name) : undefined;
    nativeRows.push([n.service, `PID ${n.pid}`, 'native', url]);
  }
  for (const svc of getAppServices()) {
    if (!running.has(svc) && isDead(svc)) nativeRows.push([svc, 'dead', 'native']);
  }
  for (const runner of runners) {
    if (running.has(runner.name)) continue;
    const label = runner.kind ?? 'runner';
    const isDocs = docsRunner?.name === runner.name;
    const url = runnerUrlCell(r, runner, false, isDocs);
    if (isDead(runner.name)) nativeRows.push([runner.name, 'dead', label, url]);
    else if (runner.autostart === false) nativeRows.push([runner.name, 'not started', label, url]);
    else nativeRows.push([runner.name, 'stopped', label, url]);
  }
  r.table('Native Processes', nativeRows);
}

export async function status(ctx: Ctx): Promise<number> {
  const { r } = ctx;
  const json = ctx.json || ctx.args.includes('--json');
  const watch = ctx.args.includes('--watch');

  if (json) {
    // `native` lists running processes (back-compat). `runners` lists every
    // registered runner with its state — so tooling (and the scaffold
    // reconciliation probe) can see registered-but-stopped surfaces/sidecars,
    // which `native` omits.
    const data = collectStatus(ctx.runners);
    const runners = ctx.runners.map((rn) => ({
      name: rn.name,
      kind: rn.kind ?? null,
      state: isRunning(rn.name) ? 'running' : isDead(rn.name) ? 'dead' : 'stopped',
      pid: isRunning(rn.name) ? readPid(rn.name) : null,
      autostart: rn.autostart !== false,
    }));
    // Additive `bet` key (E5) — present only when the active-lane sentinel
    // names a bet and its board parses cleanly; every prior key is untouched.
    const bet = betPanelJson();
    const payload: Record<string, unknown> = { ...data, runners };
    if (bet) payload.bet = bet;
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    return 0;
  }

  if (watch && r.painter.caps.isTTY) {
    return watchStatus(ctx);
  }
  if (watch && !r.painter.caps.isTTY) {
    // Non-TTY fallback: print one frame and exit rather than hang.
    r.info('--watch requires an interactive terminal; printing a single snapshot.');
  }

  // The status table is a command *result*, so render it to stdout (pipeable);
  // progress/spinners from other commands stay on stderr.
  const ro = r.asStream(process.stdout);
  ro.logo('Local Status');
  renderStatusTables(ro, collectStatus(ctx.runners), ctx.runners);
  renderBetPanel(ro);
  return 0;
}

/** Live, self-refreshing dashboard. Alt-screen, ~2s cadence, q or Ctrl+C to exit. */
async function watchStatus(ctx: Ctx): Promise<number> {
  const { r } = ctx;
  const readline = await import('readline');
  const out = process.stderr;

  out.write('\x1b[?1049h'); // alt screen
  out.write('\x1b[?25l'); // hide cursor
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();

  let stop = false;
  const restore = () => {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdin.pause();
    out.write('\x1b[?25h'); // show cursor
    out.write('\x1b[?1049l'); // leave alt screen
  };
  const onKey = (_s: string, key: { name?: string; ctrl?: boolean }) => {
    if (key.name === 'q' || (key.ctrl && key.name === 'c')) stop = true;
  };
  process.stdin.on('keypress', onKey);

  try {
    while (!stop) {
      out.write('\x1b[2J\x1b[H'); // clear + home
      r.logo('Live Status');
      renderStatusTables(r, collectStatus(ctx.runners), ctx.runners);
      renderBetPanel(r);
      out.write(`\n  ${r.painter.dim('Refreshing every 2s — press q or Ctrl+C to exit')}\n`);
      // Poll the stop flag finely so the keypress feels responsive.
      for (let i = 0; i < 20 && !stop; i += 1) await sleep(100);
    }
  } finally {
    process.stdin.removeListener('keypress', onKey);
    restore();
  }
  return 0;
}
