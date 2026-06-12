import * as path from 'path';
import * as fs from 'fs';

/** The project root. The `dev` launcher sets DEV_ROOT to its own directory; we fall
 *  back to walking up from cwd to find a project marker so the CLI also works when
 *  invoked directly. */
export const ROOT: string = (() => {
  if (process.env.DEV_ROOT) return process.env.DEV_ROOT;
  let dir = process.cwd();
  for (let i = 0; i < 12; i += 1) {
    if (
      fs.existsSync(path.join(dir, 'dev')) ||
      fs.existsSync(path.join(dir, 'docker-compose.yml')) ||
      fs.existsSync(path.join(dir, '.groundwork'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
})();

export const DEV_DIR = path.join(ROOT, '.dev');
export const PID_DIR = path.join(DEV_DIR, 'pids');
export const LOG_DIR = path.join(DEV_DIR, 'logs');
export const SERVICES_DIR = path.join(ROOT, 'services');
export const TESTS_DIR = path.join(ROOT, 'tests');
export const DOCS_DIR = path.join(ROOT, 'docs');
export const CONFIG_PATH = path.join(DEV_DIR, 'dev.config.json');
/** Durable, committed bet artifacts (decomposition + sealed test manifest) — NOT cache. */
export const GROUNDWORK_BETS_DIR = path.join(ROOT, '.groundwork', 'bets');
/** Machine-readable twin of docs/surfaces.md (surface registry + capability ledger). */
export const GROUNDWORK_SURFACES_FILE = path.join(ROOT, '.groundwork', 'surfaces.json');

export function ensureDirs(): void {
  fs.mkdirSync(PID_DIR, { recursive: true });
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

export function pidFile(svc: string): string {
  return path.join(PID_DIR, `${svc}.pid`);
}

export function logFile(svc: string): string {
  return path.join(LOG_DIR, `${svc}.log`);
}
