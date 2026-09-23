import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'
import { Conflict, InvalidInput } from './errors.ts'
import { initialise, installInstructions, exportLegacy } from './setup.ts'
import { inventory, register, unregister } from './registry.ts'
import { readPlan, recover } from './repository.ts'
import { startViewer } from './viewer.ts'
import { mcp } from './mcp.ts'
import { operate, operationSchemas, type OperationName } from './operations.ts'
const help = `Groundwork — portable repository planning

  init [path] --name NAME [--domain URL]
  start [path] [--port 4318]        Start/reuse Hub and print this project’s URL
  start [path] --standalone         Use a standalone viewer instead
  hub [--port 4318]                 Start/reuse the shared multi-project Hub
  serve [path] [--port 4317]        Run the standalone viewer
  dashboard [--port 4318]           Alias for hub
  register [path] [--workspace NAME] [--product NAME]
  unregister [path]
  projects                         List projects and discovered worktrees
  read [path] [--ref BRANCH]        Read documents, revision and context
  validate [path]                   Validate a complete repository plan
  recover [path]                    Recover an interrupted write and remove leftover temp files
  instructions [path]               Refresh guide/schema files and instruction links
  call OPERATION --input FILE       Call an authoring operation with JSON arguments
       [--root PATH | --central]    Repository scope defaults to the current folder
  mcp [path] [--central]            Run the stdio MCP adapter
  export --source CONTENT --target PATH --name NAME [--product ID] [--assets IMAGES]

Operations: ${Object.keys(operationSchemas).join(', ')}
Use read before mutations. Pass expectedRevision and expectedContext back unchanged.
No commands push, fetch, publish, or launch agents.
Exit codes: 1 failure, 2 command-line mistake, 3 conflict (re-read and retry).
`
/** A mistake in the command line itself: unknown command or option, missing value, extra argument. */
export class UsageError extends InvalidInput {}
const text = { type: 'string' } as const, flag = { type: 'boolean' } as const
type Options = Record<string, typeof text | typeof flag>
/** Options and the maximum number of positional arguments each command accepts. */
const commands: Record<string, { options: Options; positionals: number }> = {
  help: { options: {}, positionals: 0 },
  init: { options: { root: text, name: text, domain: text, id: text }, positionals: 1 },
  start: { options: { root: text, port: text, standalone: flag }, positionals: 1 },
  hub: { options: { port: text }, positionals: 0 },
  dashboard: { options: { port: text }, positionals: 0 },
  serve: { options: { root: text, port: text }, positionals: 1 },
  register: { options: { root: text, workspace: text, product: text }, positionals: 1 },
  unregister: { options: { root: text }, positionals: 1 },
  projects: { options: {}, positionals: 0 },
  read: { options: { root: text, ref: text }, positionals: 1 },
  validate: { options: { root: text }, positionals: 1 },
  recover: { options: { root: text }, positionals: 1 },
  instructions: { options: { root: text }, positionals: 1 },
  call: { options: { root: text, central: flag, input: text }, positionals: 1 },
  mcp: { options: { root: text, central: flag }, positionals: 1 },
  export: { options: { source: text, target: text, name: text, id: text, product: text, assets: text, supplement: text }, positionals: 0 },
}
function parse(command: string, args: string[]) {
  const spec = Object.hasOwn(commands, command) ? commands[command] : undefined
  if (!spec) throw new UsageError(`Unknown command: ${command}. Run groundwork-v2 help to list commands.`)
  let parsed
  try {
    parsed = parseArgs({ args, options: { ...spec.options, help: { type: 'boolean', short: 'h' } }, allowPositionals: true, strict: true })
  } catch (error) {
    // Node's messages add advice about "--" that does not apply here; the first sentence says what is wrong.
    throw new UsageError(`${command}: ${(error as Error).message.split(/\. (?=[A-Z])/)[0]}`, { cause: error })
  }
  const { values, positionals } = parsed as { values: Record<string, string | boolean | undefined>; positionals: string[] }
  if (positionals.length > spec.positionals) throw new UsageError(`${command}: unexpected argument ${positionals[spec.positionals]}`)
  return { values, positionals }
}
/** Runs one CLI command. `out` receives everything written to stdout; errors are thrown for `run` to report. */
export async function main(argv = process.argv.slice(2), out: (line: string) => void = line => console.log(line)) {
  const [first = 'help', ...rest] = argv
  const command = first === '--help' || first === '-h' ? 'help' : first
  const { values, positionals } = parse(command, rest)
  const string = (key: string) => typeof values[key] === 'string' ? values[key] as string : undefined
  const required = (key: string) => {
    const value = string(key)
    if (!value) throw new UsageError(`${command}: --${key} is required`)
    return value
  }
  if (command === 'help' || values.help) { out(help); return }
  if (command !== 'call' && string('root') && positionals.length) throw new UsageError(`${command}: pass the path or --root, not both`)
  const root = path.resolve(string('root') ?? (command === 'call' ? undefined : positionals[0]) ?? '.')
  const print = (value: unknown) => out(JSON.stringify(value, null, 2))
  if (command === 'init') return print(await initialise(root, { name: string('name'), domain: string('domain'), id: string('id') }))
  if (command === 'register') return print(await register(root, string('workspace'), string('product')))
  if (command === 'unregister') return print(await unregister(root))
  if (command === 'projects') return print(await inventory())
  if (command === 'read') return print(await operate('read_plan', { ref: string('ref') }, root))
  if (command === 'validate') {
    const plan = await readPlan(root)
    return print({ valid: true, project: plan.manifest, features: plan.snapshot.features.length, revision: plan.revision })
  }
  if (command === 'recover') { await recover(root); return print({ recovered: true }) }
  if (command === 'instructions') { await installInstructions(root); return print({ installed: true }) }
  if (command === 'call') {
    const name = positionals[0]
    if (!name || !Object.hasOwn(operationSchemas, name)) throw new UsageError('call: choose an operation listed in help')
    if (values.central && string('root')) throw new UsageError('call: pass --root or --central, not both')
    const input = JSON.parse(await readFile(required('input'), 'utf8'))
    return print(await operate(name as OperationName, input, values.central ? undefined : root))
  }
  if (command === 'mcp') return mcp(values.central ? undefined : root)
  if (command === 'export') {
    const assets = string('assets')
    return print(await exportLegacy(path.resolve(required('source')), path.resolve(required('target')), {
      name: required('name'), id: string('id'), product: string('product'), supplement: string('supplement'), assets: assets ? path.resolve(assets) : undefined,
    }))
  }
  // start, hub, dashboard and serve
  const standalone = command === 'serve' || values.standalone === true
  const port = Number(string('port') ?? (standalone ? 4317 : 4318))
  // Reject 0 too: Number('') is 0, and a literal 0 asks the OS for a random port, silently defeating --port.
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new UsageError(`${command}: invalid port ${string('port')}`)
  const hub = command === 'hub' || command === 'dashboard'
  const viewer = await startViewer({ root: hub ? undefined : root, standalone, port })
  out(`Groundwork ${standalone ? '· Standalone workspace' : 'Hub'} · ${viewer.reused ? 'using existing server' : 'started'}\n${viewer.url}`)
  if (viewer.app) {
    out(standalone
      ? 'Keep this terminal open. Ctrl+C stops this viewer.'
      : 'Keep this terminal open. Other projects reuse this Hub. Ctrl+C stops the Hub for all open workspaces.')
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void viewer.app!.close().then(() => process.exit(0)) })
  }
}
/** Exit codes: 1 for failures, 2 for command-line mistakes, 3 for a retryable Conflict (stale revision or busy repository). */
export function exitCodeFor(error: unknown) {
  if (error instanceof UsageError) return 2
  if (error instanceof Conflict) return 3
  return 1
}
export function formatError(error: unknown) {
  if (error instanceof z.ZodError) return `Invalid input:\n${z.prettifyError(error)}`
  return error instanceof Error ? error.message : String(error)
}
/** Entry point for the installed binary: reports errors on stderr without a stack trace. */
export async function run(argv = process.argv.slice(2)) {
  try { await main(argv) } catch (error) {
    console.error(formatError(error))
    process.exitCode = exitCodeFor(error)
  }
}
// Runs when this file is executed directly (`node server/cli.ts ...`), not when it is only imported.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await run()
