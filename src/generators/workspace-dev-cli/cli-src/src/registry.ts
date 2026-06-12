import { Ctx } from './util/context';
import * as lifecycle from './commands/lifecycle';
import * as quality from './commands/quality';
import { doctor } from './commands/doctor';
import * as bet from './commands/bet';
import { surfaceCmd } from './commands/surface';
import { completion } from './commands/completion';

export type CommandGroup = 'LIFECYCLE' | 'QUALITY' | 'BET WORKFLOW' | 'META';

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
    summary: 'Print recent logs (--follow to stream)',
    flags: [{ name: '--follow', desc: 'Stream logs (TTY only)' }],
    handler: lifecycle.logs,
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
    summary: 'Bet tooling (status [<slug>] | sign <slug>)',
    nouns: ['status', 'sign'],
    flags: [
      { name: '--amend', desc: 'Overwrite an existing test manifest (sign)' },
      { name: '--json', desc: 'Emit machine-readable JSON (status)' },
    ],
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

export function findCommand(name: string): CommandDef | undefined {
  return COMMANDS.find((c) => c.name === name);
}
