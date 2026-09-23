import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile, cp, mkdir, realpath } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { initialise } from '../server/setup.ts'
import { readPlan } from '../server/repository.ts'
import { register, inventory } from '../server/registry.ts'
import { operationSchemas } from '../server/operations.ts'

async function command(module: 'cli' | 'mcp', args: string[], input = '') {
  return new Promise<string>((resolve, reject) => {
    const invocation = module === 'cli' ? 'main(process.argv.slice(1)).catch(e=>{console.error(e.message);process.exitCode=1})' : 'mcp(process.argv[1])'
    const child = spawn(process.execPath, ['--input-type=module', '-e', `import { ${module === 'cli' ? 'main' : 'mcp'} } from './server/${module}.ts'; ${invocation}`, ...args], { cwd: path.resolve('.') })
    let stdout = '', stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk }); child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject); child.on('exit', code => code ? reject(new Error(stderr)) : resolve(stdout))
    child.stdin.end(input)
  })
}
test('CLI and MCP return the same revision and use the same validated authoring operations', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groundwork-adapters-')); t.after(() => rm(root, { recursive: true, force: true }))
  await initialise(root, { name: 'Adapters' })
  const read = JSON.parse(await command('cli', ['read', root]))
  const replies = (await command('mcp', [root], [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1' } } },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'read_plan', arguments: {} } },
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'create_feature', arguments: { id: 'feature', title: 'Adapter feature', productId: 'app', ownerId: 'owner', problem: 'A problem', outcome: 'An outcome', expectedRevision: read.revision, expectedContext: read.context.token } } },
  ].map(item => JSON.stringify(item)).join('\n') + '\n')).trim().split('\n').map(line => JSON.parse(line))
  assert.equal(replies[0].result.protocolVersion, '2025-03-26')
  assert.deepEqual(replies[1].result.tools.map((tool: any) => tool.name).sort(), Object.keys(operationSchemas).sort())
  assert.equal(JSON.parse(replies[2].result.content[0].text).revision, read.revision)
  assert.equal(replies[3].result.isError, undefined)
  const updated = await readPlan(root)
  assert.equal(updated.snapshot.features[0].title, 'Adapter feature')
  const argsFile = path.join(root, 'request.json')
  await writeFile(argsFile, JSON.stringify({ featureId: 'feature', stage: 'exploring', expectedRevision: updated.revision, expectedContext: updated.context.token }))
  await command('cli', ['call', 'record_progress', '--root', root, '--input', argsFile])
  assert.equal((await readPlan(root)).snapshot.features[0].stage, 'exploring')
})
test('different users organise identical plans independently and explicit clones remain separate', async t => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'groundwork-registry-')); t.after(() => rm(base, { recursive: true, force: true }))
  const previous = process.env.GROUNDWORK_HOME
  t.after(() => { if (previous === undefined) delete process.env.GROUNDWORK_HOME; else process.env.GROUNDWORK_HOME = previous })
  const root = path.join(base, 'app'), clone = path.join(base, 'clone')
  await initialise(root, { name: 'Shared app' }); const original = await readPlan(root)
  await cp(root, clone, { recursive: true })
  process.env.GROUNDWORK_HOME = path.join(base, 'user-a')
  await register(root, 'Work', 'Application'); await register(clone, 'Experiments', 'Application clone')
  const a = await inventory()
  assert.equal(a.length, 2); assert.notEqual(a[0].checkoutId, a[1].checkoutId); assert.equal(a[0].projectId, a[1].projectId)
  assert.deepEqual(a.map(item => item.product), ['Application', 'Application clone'])
  assert.deepEqual(a.map(item => item.productPath), ['/w/project/app', '/w/project/app'])
  process.env.GROUNDWORK_HOME = path.join(base, 'user-b')
  assert.equal((await inventory()).length, 0)
  await register(root, 'Personal', 'Shared app')
  const b = await inventory()
  assert.equal(b.length, 1); assert.equal(b[0].workspace, 'Personal'); assert.equal(b[0].product, 'Shared app')
  assert.equal((await readPlan(root)).revision, original.revision)
})
test('repositories without plans can be grouped beneath a workspace product', async t => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'groundwork-registry-source-')); t.after(() => rm(base, { recursive: true, force: true }))
  const previous = process.env.GROUNDWORK_HOME
  t.after(() => { if (previous === undefined) delete process.env.GROUNDWORK_HOME; else process.env.GROUNDWORK_HOME = previous })
  process.env.GROUNDWORK_HOME = path.join(base, 'config')
  const root = path.join(base, 'source')
  await mkdir(root)
  await register(root, 'Commercial Backbone', 'Price')
  const [entry] = await inventory()
  assert.equal(entry.workspace, 'Commercial Backbone')
  assert.equal(entry.product, 'Price')
  assert.equal(entry.repositoryRoot, await realpath(root))
  assert.equal(entry.projectId, null)
  assert.match(entry.error!, /project.json/)
})
