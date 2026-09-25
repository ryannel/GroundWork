import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFile, cp, mkdir, realpath } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { initialise } from '../server/setup.ts'
import { readPlan } from '../server/repository.ts'
import { register, unregister, inventory, selectRoot } from '../server/registry.ts'
import { operationSchemas } from '../server/operations.ts'
import { main, exitCodeFor, formatError, UsageError } from '../server/cli.ts'
import { Conflict } from '../server/errors.ts'
import { z } from 'zod'
import { guard, repoRoot, tempDir, withEnv } from './helpers.ts'

async function command(module: 'cli' | 'mcp', args: string[], input = '') {
  return new Promise<string>((resolve, reject) => {
    const invocation = module === 'cli' ? 'main(process.argv.slice(1)).catch(e=>{console.error(e.message);process.exitCode=1})' : 'mcp(process.argv[1])'
    const child = spawn(process.execPath, ['--input-type=module', '-e',
      `import { ${module === 'cli' ? 'main' : 'mcp'} } from './server/${module}.ts'; ${invocation}`, ...args], { cwd: repoRoot })
    let stdout = '', stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk });
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject);
    child.on('exit', code => code ? reject(new Error(stderr)) : resolve(stdout))
    child.stdin.end(input)
  })
}
test('CLI and MCP return the same revision and use the same validated authoring operations', async t => {
  const root = await tempDir(t, 'groundwork-adapters-')
  await initialise(root, { name: 'Adapters' })
  const read = JSON.parse(await command('cli', ['read', root]))
  const feature = { id: 'feature', title: 'Adapter feature', productId: 'app', ownerId: 'owner', problem: 'A problem', outcome: 'An outcome' }
  const replies = (await command('mcp', [root], [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1' } } },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'read_plan', arguments: {} } },
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'create_feature', arguments: { ...feature, ...guard(read) } } },
  ].map(item => JSON.stringify(item)).join('\n') + '\n')).trim().split('\n').map(line => JSON.parse(line))
  assert.equal(replies[0].result.protocolVersion, '2025-03-26')
  assert.deepEqual(replies[1].result.tools.map((tool: { name: string }) => tool.name).sort(), Object.keys(operationSchemas).sort())
  assert.equal(JSON.parse(replies[2].result.content[0].text).revision, read.revision)
  assert.equal(replies[3].result.isError, undefined)
  const updated = await readPlan(root)
  assert.equal(updated.snapshot.features[0].title, 'Adapter feature')
  const argsFile = path.join(root, 'request.json')
  await writeFile(argsFile, JSON.stringify({ featureId: 'feature', stage: 'exploring', ...guard(updated) }))
  await command('cli', ['call', 'record_progress', '--root', root, '--input', argsFile])
  assert.equal((await readPlan(root)).snapshot.features[0].stage, 'exploring')
})
test('different users have independent registries and checkouts remain separate', async t => {
  const base = await tempDir(t, 'groundwork-registry-')
  const root = path.join(base, 'app'), clone = path.join(base, 'clone')
  await mkdir(root)
  await initialise(root, { name: 'Shared app' });
  const original = await readPlan(root)
  await cp(root, clone, { recursive: true })
  withEnv(t, { GROUNDWORK_HOME: path.join(base, 'user-a') })
  await mkdir(path.join(base, 'user-a'), { recursive: true })
  await writeFile(path.join(base, 'user-a/registry.json'), '{"checkouts":{},"workspaces":[]}\n')
  await register(root, 'Work', 'app');
  await register(clone, 'Work', 'app')
  const a = await inventory()
  assert.equal(a.length, 2);
  assert.notEqual(a[0].checkoutId, a[1].checkoutId)
  assert.deepEqual(a.map(item => item.product), ['app', 'clone'])
  process.env.GROUNDWORK_HOME = path.join(base, 'user-b')
  assert.equal((await inventory()).length, 0)
  await assert.rejects(selectRoot(a[0].checkoutId), /Unknown checkout/)
  await mkdir(path.join(base, 'user-b'), { recursive: true })
  await writeFile(path.join(base, 'user-b/registry.json'), '{"checkouts":{},"workspaces":[]}\n')
  await register(root, 'Personal', 'Shared app')
  const b = await inventory()
  assert.equal(b.length, 1);
  assert.equal(b[0].workspace, 'Personal');
    assert.equal(b[0].product, 'Shared app')
  assert.equal(await selectRoot(b[0].checkoutId), await realpath(root))
  await unregister(root)
  assert.equal((await inventory()).length, 0)
  await assert.rejects(selectRoot(b[0].checkoutId), /Unknown checkout/)
  assert.equal((await readPlan(root)).revision, original.revision)
})
test('source repositories without plans can be registered for catalog reads', async t => {
  const base = await tempDir(t, 'groundwork-registry-source-')
  withEnv(t, { GROUNDWORK_HOME: path.join(base, 'config') })
  const root = path.join(base, 'source')
  await mkdir(root)
  await register(root)
  const [entry] = await inventory()
  assert.equal(entry.workspace, 'My projects')
  assert.equal(entry.productRefs.length, 0)
  assert.equal(entry.repositoryRoot, await realpath(root))
  assert.equal(entry.projectId, null)
})

test('CLI arguments are parsed strictly and errors are short, with a distinct exit code for conflicts', async t => {
  const root = await tempDir(t, 'groundwork-cli-')
  await initialise(root, { name: 'CLI' })
  const lines: string[] = []
  const out = (line: string) => { lines.push(line) }
  await assert.rejects(main(['read', root, '--reff', 'main'], out), error => error instanceof UsageError && /Unknown option '--reff'/.test(error.message))
  await assert.rejects(main(['read', root, 'extra'], out), /unexpected argument extra/)
  await assert.rejects(main(['read', root, '--root', root], out), /not both/)
  await assert.rejects(main(['hub', '--port', 'abc'], out), /invalid port abc/)
  await assert.rejects(main(['nonsense'], out), error => error instanceof UsageError && /Unknown command: nonsense/.test(error.message))
  await main(['init', '--help'], out)
  assert.match(lines.pop()!, /portable repository planning/)
  await main(['read', `--root=${root}`], out)
  assert.match(JSON.parse(lines.pop()!).revision, /^[0-9a-f]{64}$/)
  assert.deepEqual([new UsageError('x'), new Conflict('x'), new Error('x')].map(exitCodeFor), [2, 3, 1])
  const invalid = z.strictObject({ name: z.string() }).safeParse({ name: 1 })
  assert.doesNotMatch(formatError(invalid.error), /^\[/)
  assert.match(formatError(invalid.error), /name/)
})
test('the binary explains how to build when the runtime is missing', async t => {
  const base = await tempDir(t, 'groundwork-bin-')
  await mkdir(path.join(base, 'bin'))
  await cp(path.join(repoRoot, 'bin/groundwork-v2.js'), path.join(base, 'bin/groundwork-v2.js'))
  await writeFile(path.join(base, 'package.json'), '{"type":"module"}')
  const result = await new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(base, 'bin/groundwork-v2.js'), 'help'])
    let stderr = ''
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject)
    child.on('exit', code => resolve({ code, stderr }))
  })
  assert.equal(result.code, 1)
  assert.match(result.stderr, /Run npm run build first/)
})
