#!/usr/bin/env node
import * as fs from 'fs';
import { CommandDef, buildRegistry, findCommand } from './registry';
import { Ctx, CliError, UsageError } from './util/context';
import { makeRenderer, Renderer } from './theme/render';
import { CONFIG_PATH } from './util/paths';
import { DEV_CLI_VERSION } from './util/version';
import { parseRunners } from './util/runners';
import { loadProjectCommands } from './util/extensions';

interface DevConfig {
  projectPrefix?: string;
  identity?: unknown;
  terminal?: unknown;
  runners?: unknown;
}

function loadConfig(): { config: DevConfig; tokens: unknown } {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as DevConfig;
      return { config: raw, tokens: { identity: raw.identity, terminal: raw.terminal } };
    }
  } catch {
    /* fall through to defaults */
  }
  return { config: {}, tokens: {} };
}

/** Built-in groups render first, in this order; project-declared groups (PROJECT and
 *  any custom name) follow, so a project's own verbs are visible but never crowd out the
 *  golden-path lifecycle. */
const CORE_GROUPS = ['LIFECYCLE', 'QUALITY', 'BET WORKFLOW', 'META'];

function showHelp(r: Renderer, commands: CommandDef[]): void {
  r.logo('Local Development CLI');
  const present = [...new Set(commands.map((c) => c.group))];
  const order = [
    ...CORE_GROUPS.filter((g) => present.includes(g)),
    ...present.filter((g) => !CORE_GROUPS.includes(g)).sort(),
  ];
  for (const g of order) {
    const cmds = commands.filter((c) => c.group === g);
    if (cmds.length === 0) continue;
    r.category(g);
    for (const c of cmds) r.cmd(c.name, c.summary);
  }
  process.stderr.write('\n');
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);

  if (argv.includes('--version')) {
    process.stdout.write(`${DEV_CLI_VERSION}\n`);
    return 0;
  }

  // Extract global flags from anywhere in the args.
  let json = false;
  let help = false;
  const rest: string[] = [];
  for (const a of argv) {
    if (a === '--json') json = true;
    else if (a === '-h' || a === '--help') help = true;
    else if (a === '-v' || a === '--verbose') {
      /* accepted, no-op */
    } else rest.push(a);
  }

  const { config, tokens } = loadConfig();
  const r = makeRenderer(tokens);

  // The merged registry: built-ins plus the project's own commands, the latter
  // shadowing a built-in of the same name. One source of truth for dispatch, help,
  // and completion.
  const registry = buildRegistry(loadProjectCommands());

  const command = rest[0];
  const args = rest.slice(1);

  if (!command || command === 'help' || help) {
    showHelp(r, registry);
    return 0;
  }

  const def = findCommand(registry, command);
  if (!def) {
    r.error(`Unknown command: ${command}`);
    showHelp(r, registry);
    return 2;
  }

  const ctx: Ctx = {
    r,
    json,
    args,
    projectPrefix: config.projectPrefix || 'workspace',
    runners: parseRunners(config.runners),
    commands: registry,
  };

  return def.handler(ctx);
}

// Graceful Ctrl+C — never leave the terminal in a bad state.
process.on('SIGINT', () => {
  process.stderr.write('\n');
  process.stderr.write('\x1b[?25h'); // restore cursor in case a spinner was active
  process.exit(130);
});

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    const r = makeRenderer({});
    if (err instanceof CliError) {
      r.errorCard(err.message, err.action);
      process.exit(1);
    }
    if (err instanceof UsageError) {
      r.error(err.message);
      process.exit(2);
    }
    r.errorCard(err?.message ?? String(err));
    process.exit(1);
  });
