import { spawn, spawnSync, SpawnSyncOptions } from 'child_process';
import * as http from 'http';

export interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

/** Run a command synchronously, inheriting stdio (for user-visible subprocesses
 *  like `docker compose up`). Returns the exit status. */
export function run(cmd: string, args: string[], opts: SpawnSyncOptions = {}): number {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  return r.status ?? 1;
}

/** Run a command synchronously and capture its output (for parsing, e.g.
 *  `docker compose ps`). */
export function capture(cmd: string, args: string[], opts: SpawnSyncOptions = {}): RunResult {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return {
    status: r.status ?? (r.error ? 127 : 1),
    stdout: (r.stdout as string) ?? '',
    stderr: (r.stderr as string) ?? '',
  };
}

/** Run a shell command string (for piped/compound commands ported from bash). */
export function sh(command: string, opts: SpawnSyncOptions = {}): RunResult {
  const r = spawnSync(command, { shell: true, encoding: 'utf8', ...opts });
  return {
    status: r.status ?? (r.error ? 127 : 1),
    stdout: (r.stdout as string) ?? '',
    stderr: (r.stderr as string) ?? '',
  };
}

/** True if a command is resolvable on PATH. Passes a single command string (never
 *  args with shell:true) to avoid Node's DEP0190 shell-injection warning. */
export function commandExists(cmd: string): boolean {
  const safe = cmd.replace(/[^a-zA-Z0-9._-]/g, '');
  const probe = process.platform === 'win32' ? `where ${safe}` : `command -v ${safe}`;
  const r = spawnSync(probe, { shell: true, stdio: 'ignore' });
  return (r.status ?? 1) === 0;
}

/** `docker compose` (v2) is the only supported form. */
export const COMPOSE = ['compose'];

export function dockerComposeCapture(args: string[]): RunResult {
  return capture('docker', [...COMPOSE, ...args]);
}

export function dockerComposeRun(args: string[]): number {
  return run('docker', [...COMPOSE, ...args]);
}

/** Spawn a detached background process writing to a log file; returns its PID.
 *  Optional cwd/env let a declared runner launch from its own directory with a
 *  merged environment (native runners, sidecars). */
export function spawnBackground(
  command: string,
  logStream: number,
  opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): number {
  const child = spawn('bash', ['-c', command], {
    stdio: ['ignore', logStream, logStream],
    detached: true,
    cwd: opts.cwd,
    env: opts.env,
  });
  child.unref();
  return child.pid ?? -1;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Probe an HTTP endpoint and resolve with its status code, or 0 on a connection
 *  error/timeout. Never throws — used by health/doctor connectivity checks so a
 *  hung or absent port renders as a row, not a crash. Localhost-only (http). */
export function httpProbe(url: string, timeoutMs = 3000): Promise<number> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (code: number): void => {
      if (settled) return;
      settled = true;
      resolve(code);
    };
    try {
      const req = http.get(url, (res) => {
        const code = res.statusCode ?? 0;
        res.resume(); // drain so the socket can close
        done(code);
      });
      req.setTimeout(timeoutMs, () => {
        req.destroy();
        done(0);
      });
      req.on('error', () => done(0));
    } catch {
      done(0);
    }
  });
}
