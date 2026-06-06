import * as fs from 'fs';
import * as path from 'path';
import { PID_DIR, SERVICES_DIR, pidFile } from './paths';
import { capture, sleep } from './proc';

export type ServiceType = 'go' | 'node' | 'python' | 'unknown';

/** App services are the subdirectories of `services/`. */
export function getAppServices(): string[] {
  if (!fs.existsSync(SERVICES_DIR)) return [];
  return fs
    .readdirSync(SERVICES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
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
