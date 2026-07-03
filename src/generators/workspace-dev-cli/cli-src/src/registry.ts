import * as path from 'path';
import { Ctx } from './util/context';
import * as lifecycle from './commands/lifecycle';
import * as quality from './commands/quality';
import { doctor } from './commands/doctor';
import * as bet from './commands/bet';
import { surfaceCmd } from './commands/surface';
import { completion } from './commands/completion';
import { ProjectCommand } from './util/extensions';
import { run } from './util/proc';
import { ROOT } from './util/paths';

/** Built-in groups, plus `PROJECT` and any custom group a project command declares.
 *  The `string & {}` keeps editor completion for the known literals while admitting
 *  project-defined group names. */
export type CommandGroup = 'LIFECYCLE' | 'QUALITY' | 'BET WORKFLOW' | 'META' | 'PROJECT' | (string & {});

export interface FlagDef {
  name: string;
  desc: string;
}

export interface CommandDef {
  name: string;
  group: CommandGroup;
  summary: string;
  /** Sub-nouns for completion (e.g. `new` → bet, milestone, slice). */
  nouns?: string[];
  flags?: FlagDef[];
  handler: (ctx: Ctx) => Promise<number>;
}

/** The declarative command registry. This is the single source of truth that drives
 *  dispatch, `--help`, shell completion, and usage validation — so they cannot drift. */
export const COMMANDS: CommandDef[] = [
  {
    name: 'start',
    group: 'LIFECYCLE',
    summary: 'Boot infrastructure (Docker) + app services (native)',
    flags: [{ name: '--docker', desc: 'Run all services in Docker' }],
    handler: lifecycle.start,
  },
  {
    name: 'stop',
    group: 'LIFECYCLE',
    summary: 'Gracefully tear down all services',
    handler: lifecycle.stop,
  },
  {
    name: 'reset',
    group: 'LIFECYCLE',
    summary: 'Stop, wipe volumes, start & migrate (full recycle)',
    flags: [{ name: '--docker', desc: 'Recycle the all-Docker topology' }],
    handler: lifecycle.reset,
  },
  {
    name: 'migrate',
    group: 'LIFECYCLE',
    summary: 'Create service databases & apply schemas',
    handler: lifecycle.migrate,
  },
  {
    name: 'status',
    group: 'LIFECYCLE',
    summary: 'Show running services (--watch for a live dashboard)',
    flags: [
      { name: '--json', desc: 'Emit machine-readable JSON' },
      { name: '--watch', desc: 'Live-refreshing dashboard (TTY only)' },
    ],
    handler: lifecycle.status,
  },
  {
    name: 'logs',
    group: 'LIFECYCLE',
    summary: 'Print recent logs (logs <service> to filter; --follow to stream)',
    flags: [{ name: '--follow', desc: 'Stream logs (TTY only)' }],
    handler: lifecycle.logs,
  },
  {
    name: 'health',
    group: 'LIFECYCLE',
    summary: 'Poll every app service + Jaeger health endpoint',
    flags: [{ name: '--json', desc: 'Emit machine-readable JSON' }],
    handler: lifecycle.health,
  },
  {
    name: 'clean',
    group: 'LIFECYCLE',
    summary: 'Tear down & wipe state (--hard wipes volumes)',
    flags: [{ name: '--hard', desc: 'Also wipe Docker volumes' }],
    handler: lifecycle.clean,
  },
  {
    name: 'doctor',
    group: 'QUALITY',
    summary: 'Verify the local environment',
    flags: [{ name: '--json', desc: 'Emit machine-readable JSON' }],
    handler: doctor,
  },
  {
    name: 'test',
    group: 'QUALITY',
    summary: 'Run tests (integration | bet <slug>)',
    nouns: ['integration', 'bet'],
    flags: [
      { name: '--integration', desc: 'Boot the stack for a bet suite' },
      { name: '--keep', desc: 'Leave the stack running after tests' },
    ],
    handler: quality.test,
  },
  {
    name: 'lint',
    group: 'QUALITY',
    summary: 'Run static analysis across services',
    handler: quality.lint,
  },
  {
    name: 'audit',
    group: 'QUALITY',
    summary: 'Dependency vulnerabilities + secret scan (fails on findings)',
    handler: quality.audit,
  },
  {
    name: 'new',
    group: 'BET WORKFLOW',
    summary: 'Scaffold a bet / milestone / slice (red test stubs)',
    nouns: ['bet', 'milestone', 'slice'],
    handler: bet.newCmd,
  },
  {
    name: 'archive',
    group: 'BET WORKFLOW',
    summary: "Archive a delivered bet's progress suite",
    nouns: ['bet'],
    handler: bet.archive,
  },
  {
    name: 'bet',
    group: 'BET WORKFLOW',
    summary: 'Bet progress board (status [<slug>]) · memlog (log <slug> -- "<line>")',
    nouns: ['status', 'log'],
    flags: [{ name: '--json', desc: 'Emit machine-readable JSON (status)' }],
    handler: bet.betCmd,
  },
  {
    name: 'surface',
    group: 'BET WORKFLOW',
    summary: 'Surface registry & capability ledger (status)',
    nouns: ['status'],
    flags: [{ name: '--json', desc: 'Emit machine-readable JSON (status)' }],
    handler: surfaceCmd,
  },
  {
    name: 'completion',
    group: 'META',
    summary: 'Print a shell completion script (bash|zsh|fish)',
    nouns: ['bash', 'zsh', 'fish'],
    handler: completion,
  },
];

export function findCommand(list: CommandDef[], name: string): CommandDef | undefined {
  return list.find((c) => c.name === name);
}

/** Single-quote an argument for safe interpolation into a `bash -c` string. */
function shellQuote(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

/** Wrap a project command as a CommandDef whose handler runs it as a subprocess,
 *  appending any extra args the user passed after the verb. Running as a subprocess
 *  keeps the bundle zero-dependency — the project's command can pull in whatever it
 *  needs without the core CLI knowing. */
export function projectCommandDef(pc: ProjectCommand): CommandDef {
  return {
    name: pc.name,
    group: pc.group || 'PROJECT',
    summary: pc.summary,
    handler: async (ctx: Ctx) => {
      const cwd = pc.cwd ? path.join(ROOT, pc.cwd) : ROOT;
      const env = pc.env ? { ...process.env, ...pc.env } : process.env;
      const extra = ctx.args.map(shellQuote).join(' ');
      const command = extra ? `${pc.run} ${extra}` : pc.run;
      return run('bash', ['-c', command], { cwd, env });
    },
  };
}

/** Merge the built-in registry with the project's own commands. A project command
 *  shadows a built-in of the same name — project wins — so a project can redefine a
 *  verb (e.g. `start`) for a stack the default lifecycle does not fit, without editing
 *  the bundle. The merged list is the single source of truth for dispatch, `--help`,
 *  and completion, exactly as COMMANDS is for the built-ins alone. */
export function buildRegistry(project: ProjectCommand[]): CommandDef[] {
  const projDefs = project.map(projectCommandDef);
  const shadowed = new Set(projDefs.map((d) => d.name));
  const core = COMMANDS.filter((c) => !shadowed.has(c.name));
  return [...core, ...projDefs];
}
