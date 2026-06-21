import * as fs from 'fs';
import * as path from 'path';
import { PID_DIR, SERVICES_DIR, pidFile } from './paths';
import { capture, sleep } from './proc';
import { runnerNames } from './runners';

export type ServiceType = 'go' | 'node' | 'python' | 'unknown';

let composeServicesCache: Set<string> | null | undefined;

/** Compose membership, resolved once per process. `null` means the topology
 *  could not be read (no docker CLI / no compose file) — callers fall back to
 *  directory listing so the CLI still degrades gracefully without Docker. */
function getComposeServices(): Set<string> | null {
  if (composeServicesCache !== undefined) return composeServicesCache;
  const r = capture('docker', ['compose', 'config', '--services']);
  composeServicesCache =
    r.status === 0
      ? new Set(
          r.stdout
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
        )
      : null;
  return composeServicesCache;
}

/** App services are the subdirectories of `services/` that are wired into the
 *  workspace docker-compose topology. Surface apps (mobile, desktop, CLI)
 *  live under `services/` too but never join compose — they have their own
 *  Nx targets and are excluded from backend lifecycle commands
 *  (start/migrate/doctor would otherwise boot phantom backends and create
 *  phantom databases for them). */
export function getAppServices(): string[] {
  if (!fs.existsSync(SERVICES_DIR)) return [];
  const runners = runnerNames();
  const dirs = fs
    .readdirSync(SERVICES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    // A dir registered as a runner is managed as a native runner, not an app
    // service — exclude it from both the compose-readable and the fallback path
    // so it is never double-managed or boot-detected by marker file.
    .filter((d) => !runners.has(d))
    .sort();
  const compose = getComposeServices();
  if (compose === null) return dirs;
  return dirs.filter((d) => compose.has(d));
}

/** Infra services are compose services that are NOT app services. */
export function getInfraServices(): string[] {
  const app = new Set(getAppServices());
  const r = capture('docker', ['compose', 'config', '--services']);
  if (r.status !== 0) return [];
  return r.stdout
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !app.has(s));
}

export function serviceDir(svc: string): string {
  return path.join(SERVICES_DIR, svc);
}

/** Detect a service's type by marker file. Precedence matches the bash CLI:
 *  .air.toml (go) → package.json (node) → pyproject.toml (python). */
export function detectType(svc: string): ServiceType {
  const dir = serviceDir(svc);
  if (fs.existsSync(path.join(dir, '.air.toml'))) return 'go';
  if (fs.existsSync(path.join(dir, 'package.json'))) return 'node';
  if (fs.existsSync(path.join(dir, 'pyproject.toml'))) return 'python';
  return 'unknown';
}

/** Locate a Python service's pydantic Settings module (it carries `server_port`).
 *  The package name is dynamic, so walk `src/` rather than assuming a fixed path. */
function findPythonConfig(dir: string): string | null {
  const src = path.join(dir, 'src');
  if (!fs.existsSync(src)) return null;
  const stack = [src];
  while (stack.length > 0) {
    const cur = stack.pop() as string;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.name === 'config.py') return full;
    }
  }
  return null;
}

/** Resolve a service's HTTP port from its language marker file. Go reads
 *  `.env` (PORT/SERVER_PORT); Node reads `package.json` (`next dev --port`);
 *  Python reads `server_port` from its Settings module. Returns null when the
 *  port can't be determined (the caller renders this as an "unknown port" row). */
export function servicePort(svc: string): number | null {
  const dir = serviceDir(svc);
  switch (detectType(svc)) {
    case 'go': {
      const env = path.join(dir, '.env');
      if (fs.existsSync(env)) {
        const m = fs.readFileSync(env, 'utf8').match(/^(?:PORT|SERVER_PORT)=(\d+)/m);
        if (m) return parseInt(m[1], 10);
      }
      return null;
    }
    case 'node': {
      const pkg = path.join(dir, 'package.json');
      if (fs.existsSync(pkg)) {
        const m = fs.readFileSync(pkg, 'utf8').match(/next dev --port (\d+)/);
        if (m) return parseInt(m[1], 10);
      }
      return null;
    }
    case 'python': {
      const cfg = findPythonConfig(dir);
      if (cfg) {
        const m = fs.readFileSync(cfg, 'utf8').match(/server_port:\s*int\s*=\s*(\d+)/);
        if (m) return parseInt(m[1], 10);
      }
      return null;
    }
    default:
      return null;
  }
}

/** A service's health endpoint path. Next.js/Node apps expose `/api/healthz`;
 *  Go and Python services expose `/health`. */
export function serviceHealthPath(svc: string): string {
  return detectType(svc) === 'node' ? '/api/healthz' : '/health';
}

/** The boot command for a service, faithful to the bash CLI. */
export function bootCommand(svc: string): string | null {
  const dir = serviceDir(svc);
  switch (detectType(svc)) {
    case 'go':
      return `cd ${JSON.stringify(dir)} && air`;
    case 'node':
      return `cd ${JSON.stringify(dir)} && ([ -d node_modules ] || npm install --legacy-peer-deps) && npm run dev`;
    case 'python':
      return `cd ${JSON.stringify(dir)} && uv run python src/main.py`;
    default:
      return null;
  }
}

export function readPid(svc: string): number | null {
  const f = pidFile(svc);
  if (!fs.existsSync(f)) return null;
  const n = parseInt(fs.readFileSync(f, 'utf8').trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** True if the service has a live PID. Cleans up a stale pidfile, matching bash. */
export function isRunning(svc: string): boolean {
  const pid = readPid(svc);
  if (pid === null) return false;
  if (pidAlive(pid)) return true;
  fs.rmSync(pidFile(svc), { force: true });
  return false;
}

/** True if a pidfile exists but the process is dead. */
export function isDead(svc: string): boolean {
  const pid = readPid(svc);
  return pid !== null && !pidAlive(pid);
}

export function writePid(svc: string, pid: number): void {
  fs.mkdirSync(PID_DIR, { recursive: true });
  fs.writeFileSync(pidFile(svc), `${pid}\n`);
}

export function removePid(svc: string): void {
  fs.rmSync(pidFile(svc), { force: true });
}

/** Recursively terminate a process tree: SIGTERM, grace period, then SIGKILL. */
export async function killTree(pid: number): Promise<void> {
  const r = capture('pgrep', ['-P', String(pid)]);
  const children = r.stdout
    .split('\n')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));
  for (const child of children) {
    await killTree(child);
  }
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
  await sleep(1000);
  if (pidAlive(pid)) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      /* already gone */
    }
  }
}
