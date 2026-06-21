import * as fs from 'fs';
import * as path from 'path';
import { CONFIG_PATH, DEV_DIR } from './paths';

/** A project-owned command — a verb the project adds to `./dev` without touching the
 *  framework bundle. This is the composability seam: the shipped commands are a
 *  starting point, and a project grows the toolkit with every convenience it needs.
 *
 *  Declared in either place (both carry the same shape):
 *    - inline in `.dev/dev.config.json` under a `commands` array, or
 *    - one-per-file under `.dev/commands/*.json` (easier to manage and diff).
 *
 *  The CLI runs `run` as a subprocess (`bash -c`) with any extra args appended, so a
 *  project command is a shell one-liner or a call into a project script — no rebuild,
 *  no dependency added to the zero-dependency bundle. A project command whose `name`
 *  matches a built-in **shadows** it, so a project can redefine `start` for a stack the
 *  default lifecycle does not fit. These declarations are project-owned: `groundwork
 *  update` never overwrites them. */
export interface ProjectCommand {
  name: string;
  summary: string;
  /** Display group in `--help`. Defaults to `PROJECT`. */
  group?: string;
  /** Shell command, run via `bash -c` from `cwd`; extra args are appended. */
  run: string;
  /** Working directory, relative to the repo root. */
  cwd?: string;
  /** Extra environment merged over the parent process env. */
  env?: Record<string, string>;
}

/** Command names are lowercase verbs (optionally namespaced with `:` or `-`), matching
 *  the built-in vocabulary so completion and help stay legible. */
const NAME_RX = /^[a-z][a-z0-9:-]*$/;

/** Coerce one untrusted entry into a validated ProjectCommand, or null if malformed.
 *  Dropping bad entries (rather than throwing) means one broken command never breaks
 *  the whole CLI. */
function coerce(item: unknown): ProjectCommand | null {
  if (!item || typeof item !== 'object') return null;
  const c = item as Record<string, unknown>;
  if (typeof c.name !== 'string' || !NAME_RX.test(c.name)) return null;
  if (typeof c.run !== 'string' || !c.run.trim()) return null;
  return {
    name: c.name,
    summary: typeof c.summary === 'string' && c.summary.trim() ? c.summary : '(project command)',
    group:
      typeof c.group === 'string' && c.group.trim() ? c.group.trim().toUpperCase() : 'PROJECT',
    run: c.run,
    cwd: typeof c.cwd === 'string' ? c.cwd : undefined,
    env:
      c.env && typeof c.env === 'object' && !Array.isArray(c.env)
        ? (c.env as Record<string, string>)
        : undefined,
  };
}

/** Discover project commands from both sources. A `.dev/commands/*.json` file wins over
 *  an inline `commands` entry of the same name, so a project can promote an inline
 *  command to its own file without a duplicate. Any read/parse failure degrades to
 *  fewer commands rather than breaking the CLI. */
export function loadProjectCommands(): ProjectCommand[] {
  const byName = new Map<string, ProjectCommand>();

  // Inline: .dev/dev.config.json → commands: [ ... ]
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as { commands?: unknown };
      if (Array.isArray(raw.commands)) {
        for (const item of raw.commands) {
          const c = coerce(item);
          if (c) byName.set(c.name, c);
        }
      }
    }
  } catch {
    /* no inline commands */
  }

  // Per-file: .dev/commands/*.json
  try {
    const dir = path.join(DEV_DIR, 'commands');
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir).sort()) {
        if (!f.endsWith('.json')) continue;
        try {
          const c = coerce(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
          if (c) byName.set(c.name, c);
        } catch {
          /* skip a malformed file */
        }
      }
    }
  } catch {
    /* no commands dir */
  }

  return [...byName.values()];
}
