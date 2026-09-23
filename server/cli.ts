import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { initialise, installInstructions, exportLegacy } from './setup.ts'
import { inventory, register, unregister } from './registry.ts'
import { readPlan, recover } from './repository.ts'
import { startViewer } from './viewer.ts'
import { mcp } from './mcp.ts'
import { operate, operationSchemas, type OperationName } from './operations.ts'
const help = `Groundwork — portable repository planning\n\n  init [path] --name NAME [--domain URL]\n  start [path] [--port 4318]        Start/reuse Hub and print this project’s URL\n  start [path] --standalone         Use a standalone viewer instead\n  hub [--port 4318]                 Start/reuse the shared multi-project Hub\n  serve [path] [--port 4317]        Run the standalone viewer\n  dashboard [--port 4318]           Alias for hub\n  register [path] [--workspace NAME] [--product NAME]\n  unregister [path]\n  projects                         List projects and discovered worktrees\n  read [path] [--ref BRANCH]        Read documents, revision and context\n  validate [path]                   Validate a complete repository plan\n  recover [path]                    Recover an interrupted write\n  instructions [path]               Refresh guide/schema files and instruction links\n  call OPERATION --input FILE       Call an authoring operation with JSON arguments\n       [--root PATH | --central]    Repository scope defaults to the current folder\n  mcp [path] [--central]            Run the stdio MCP adapter\n  export --source CONTENT --target PATH --name NAME [--product ID] [--assets IMAGES]\n\nOperations: ${Object.keys(operationSchemas).join(', ')}\nUse read before mutations. Pass expectedRevision and expectedContext back unchanged.\nNo commands push, fetch, publish, or launch agents.\n`
export async function main(argv = process.argv.slice(2)) {
  const command = argv.shift() ?? 'help'
  const flags: Record<string, string | boolean> = {}
  const positional: string[] = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2)
      if (key === 'central' || key === 'standalone') flags[key] = true
      else { if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`Missing value for --${key}`); flags[key] = argv[++i] }
    } else positional.push(argv[i])
  }
  const string = (key: string) => typeof flags[key] === 'string' ? flags[key] as string : undefined
  const required = (key: string) => { const value = string(key); if (!value) throw new Error(`--${key} is required`); return value }
  const root = path.resolve(string('root') ?? positional[0] ?? '.')
  const print = (value: unknown) => console.log(JSON.stringify(value, null, 2))
  if (command === 'help' || command === '--help' || command === '-h') { console.log(help); return }
  if (command === 'init') return print(await initialise(root, { name: string('name'), domain: string('domain'), id: string('id') }))
  if (command === 'register') return print(await register(root, string('workspace'), string('product')))
  if (command === 'unregister') return print(await unregister(root))
  if (command === 'projects') return print(await inventory())
  if (command === 'read') return print(await operate('read_plan', { ref: string('ref') }, root))
  if (command === 'validate') { const plan = await readPlan(root); return print({ valid: true, project: plan.manifest, features: plan.snapshot.features.length, revision: plan.revision }) }
  if (command === 'recover') { await recover(root); return print({ recovered: true }) }
  if (command === 'instructions') { await installInstructions(root); return print({ installed: true }) }
  if (command === 'call') {
    const name = positional[0]
    if (!name || !Object.hasOwn(operationSchemas, name)) throw new Error('Choose an operation listed in help')
    const input = JSON.parse(await readFile(required('input'), 'utf8'))
    return print(await operate(name as OperationName, input, flags.central ? undefined : path.resolve(string('root') ?? '.')))
  }
  if (command === 'mcp') return mcp(flags.central ? undefined : root)
  if (command === 'export') return print(await exportLegacy(path.resolve(required('source')), path.resolve(required('target')), { name: required('name'), id: string('id'), product: string('product'), supplement: string('supplement'), assets: string('assets') ? path.resolve(string('assets')!) : undefined }))
  if (['start', 'hub', 'serve', 'dashboard'].includes(command)) {
    const standalone = command === 'serve' || flags.standalone === true
    const port = Number(string('port') ?? (standalone ? 4317 : 4318))
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port')
    if (standalone && ['hub', 'dashboard'].includes(command)) throw new Error('Use start --standalone or serve for a standalone workspace')
    const viewer = await startViewer({ root: ['hub', 'dashboard'].includes(command) ? undefined : root, standalone, port })
    console.log(`Groundwork ${standalone ? '· Standalone workspace' : 'Hub'} · ${viewer.reused ? 'using existing server' : 'started'}\n${viewer.url}`)
    if (viewer.app) {
      console.log(standalone ? 'Keep this terminal open. Ctrl+C stops this viewer.' : 'Keep this terminal open. Other projects reuse this Hub. Ctrl+C stops the Hub for all open workspaces.')
      for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void viewer.app!.close().then(() => process.exit(0)) })
    }
    return
  }
  throw new Error(`Unknown command: ${command}\n${help}`)
}
