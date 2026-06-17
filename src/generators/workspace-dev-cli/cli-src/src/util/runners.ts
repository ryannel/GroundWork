import * as fs from 'fs';
import { CONFIG_PATH } from './paths';

/** A declared native process the CLI manages directly — a surface app (Electron,
 *  CLI, Flutter) or a native sidecar (a macOS-only Python service that can't be
 *  containerized). Runners decouple "managed by ./dev" from "is a docker-compose
 *  service": the lifecycle commands start/stop/tail/report them alongside Docker
 *  infra and natively-run app services. Declared in `.dev/dev.config.json`. */
export interface Runner {
  /** Unique within the workspace; keys the runner's pid and log files. */
  name: string;
  /** Display/metadata only. */
  kind?: 'sidecar' | 'surface';
  /** Shell command to launch. Run via `bash -c` from `cwd`. */
  cmd: string;
  /** Working directory, relative to the repo root. */
  cwd?: string;
  /** Extra environment merged over the parent process env. */
  env?: Record<string, string>;
  /** Optional readiness probe. Carried but not enforced by `start` yet. */
  health?: unknown;
  /** Whether `./dev start` launches it (default true). `false` = registered and
   *  reportable, but not part of the boot set (e.g. a CLI tool). */
  autostart?: boolean;
}

/** Coerce a raw `runners` value (untrusted JSON) into validated Runner records.
 *  Entries missing a string `name`/`cmd` are dropped rather than throwing, so a
 *  malformed config degrades to fewer runners instead of breaking every command. */
export function parseRunners(raw: unknown): Runner[] {
  if (!Array.isArray(raw)) return [];
  const out: Runner[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (typeof r.name !== 'string' || typeof r.cmd !== 'string') continue;
    out.push({
      name: r.name,
      kind: r.kind === 'surface' ? 'surface' : r.kind === 'sidecar' ? 'sidecar' : undefined,
      cmd: r.cmd,
      cwd: typeof r.cwd === 'string' ? r.cwd : undefined,
      env:
        r.env && typeof r.env === 'object' && !Array.isArray(r.env)
          ? (r.env as Record<string, string>)
          : undefined,
      health: r.health ?? null,
      autostart: r.autostart === false ? false : true,
    });
  }
  return out;
}

/** Load runners straight from dev.config.json. Used where there is no Ctx
 *  (e.g. service discovery in services.ts). Returns [] on any read/parse error. */
export function loadRunners(): Runner[] {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return [];
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as { runners?: unknown };
    return parseRunners(raw.runners);
  } catch {
    return [];
  }
}

/** Names of every registered runner — the set of `services/` directories that
 *  are managed as runners and must therefore be excluded from app-service
 *  discovery so they are not double-managed or boot-detected by marker file. */
export function runnerNames(): Set<string> {
  return new Set(loadRunners().map((r) => r.name));
}
