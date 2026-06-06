import * as fs from 'fs';
import { Ctx, CliError, elapsedSince } from '../util/context';
import {
  capture,
  dockerComposeRun,
  dockerComposeCapture,
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
} from '../util/services';
import { ensureDirs, logFile, PID_DIR, LOG_DIR } from '../util/paths';
import * as path from 'path';

export async function start(ctx: Ctx): Promise<number> {
  const { r } = ctx;
  const docker = ctx.args.includes('--docker');
  ensureDirs();
  const startMs = Date.now();

  if (docker) {
    r.startSpinner('Starting ALL services via Docker');
    if (dockerComposeRun(['up', '-d']) !== 0) {
      r.failSpinner('Failed to start services');
      throw new CliError('docker compose up failed', "Run './dev doctor' to verify Docker is running.");
    }
    r.stopSpinner('All services started via Docker', elapsedSince(startMs));
    return 0;
  }

  // Phase A: infrastructure in Docker
  const infra = getInfraServices();
  if (infra.length > 0) {
    r.startSpinner('Starting Infrastructure (Docker)');
    if (dockerComposeRun(['up', '-d', ...infra]) !== 0) {
      r.failSpinner('Failed to start infrastructure');
      throw new CliError('docker compose up failed', "Run './dev doctor' to verify Docker is running.");
    }
    r.stopSpinner('Infrastructure started');
  }

  // Phase B: app services natively
  const services = getAppServices();
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

  r.success(`Development environment started. (${elapsedSince(startMs)})`);
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

export async function migrate(ctx: Ctx): Promise<number> {
  const { r } = ctx;
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

export async function logs(ctx: Ctx): Promise<number> {
  const { r } = ctx;
  const follow = ctx.args.includes('--follow') || ctx.args.includes('-f');

  if (!follow) {
    // Non-streaming by default: print recent native logs and a compose snapshot,
    // then exit. This keeps the command safe for agents and pipes.
    for (const svc of getAppServices()) {
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

function collectStatus(): StatusJson {
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
  return { docker, native };
}

function renderStatusTables(r: Ctx['r'], data: StatusJson): void {
  r.table(
    'Docker Containers',
    data.docker.map((d) => {
      const ports = d.ports.length > 15 ? d.ports.slice(0, 12) + '...' : d.ports;
      return [d.service, d.status, ports] as [string, string, string];
    }),
  );
  const nativeRows: Array<[string, string, string]> = [];
  const running = new Set(data.native.map((n) => n.service));
  for (const n of data.native) nativeRows.push([n.service, `PID ${n.pid}`, 'native']);
  for (const svc of getAppServices()) {
    if (!running.has(svc) && isDead(svc)) nativeRows.push([svc, 'dead', 'native']);
  }
  r.table('Native Processes', nativeRows);
}

export async function status(ctx: Ctx): Promise<number> {
  const { r } = ctx;
  const json = ctx.json || ctx.args.includes('--json');
  const watch = ctx.args.includes('--watch');

  if (json) {
    process.stdout.write(JSON.stringify(collectStatus(), null, 2) + '\n');
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
  renderStatusTables(ro, collectStatus());
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
      renderStatusTables(r, collectStatus());
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
