import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { handleMessage } from '../server/mcp.ts'
import type { operationAnnotations } from '../server/operations.ts'

const call = (message: unknown) => handleMessage(typeof message === 'string' ? message : JSON.stringify(message))
// handleMessage's reply shape depends on the request; each call site names only the fields it reads.
type Reply<T extends object> = { jsonrpc: '2.0'; id: string | number | null } & T
const rpc = async <T extends object>(message: unknown) => (await call(message)) as Reply<T>

test('malformed JSON-RPC input gets an error reply instead of silence', async () => {
  assert.deepEqual(await call('{bad'), { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Invalid JSON' } })
  for (const invalid of ['null', '42', '[{"jsonrpc":"2.0","id":1,"method":"ping"}]', '{"id":1}']) {
    const reply = await rpc<{ error: { code: number } }>(invalid)
    assert.equal(reply.error.code, -32600, invalid)
  }
  assert.equal((await rpc<object>({ id: 7, method: 'ping' })).id, 7, 'an invalid request keeps a usable id')
  assert.equal(await call({ jsonrpc: '2.0', method: 'notifications/initialized' }), null)
  assert.equal(await call(''), null)
  assert.equal((await rpc<{ error: { code: number } }>({ jsonrpc: '2.0', id: 2, method: 'resources/list' })).error.code, -32601)
  assert.equal((await rpc<{ error: { code: number } }>({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'toString' } })).error.code, -32602)
})

test('initialize reports the package version and tool annotations come from the registry', async () => {
  const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const init = await rpc<{ result: { serverInfo: { version: string } } }>({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
  assert.equal(init.result.serverInfo.version, version)
  const list = await rpc<{ result: { tools: { name: string; annotations: ReturnType<typeof operationAnnotations> }[] } }>(
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
  )
  const hints = Object.fromEntries(list.result.tools.map(tool => [tool.name, tool.annotations]))
  assert.equal(hints.discard_repository_scan.destructiveHint, true)
  assert.equal(hints.plan_delivery.destructiveHint, true)
  assert.equal(hints.prepare_repository_scan.readOnlyHint, false)
  assert.equal(hints.prepare_repository_scan.openWorldHint, true)
  assert.deepEqual(hints.search_catalog, { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false })
  assert.equal(hints.create_feature.destructiveHint, false)
})

test('tool failures are reported as tool errors with their message', async () => {
  const reply = await rpc<{ result: { isError: boolean; content: { text: string }[] } }>(
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'discard_repository_scan', arguments: { scanId: 'not-a-uuid' } } },
  )
  assert.equal(reply.result.isError, true)
  assert.ok(reply.result.content[0].text.length > 0)
})
