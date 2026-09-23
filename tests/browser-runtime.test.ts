import { test } from 'node:test'
import assert from 'node:assert/strict'

test('viewer startup uses the service and never substitutes sample plans', async t => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { pathname: '/' } } })
  t.after(() => {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  })
  const runtime = await import('../src/data/runtime.ts')
  let applied = false
  runtime.attachSnapshot(() => { applied = true })

  await t.test('an unavailable API reports a disconnected state', async t => {
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('Connection refused') })
    await runtime.startRuntime()
    assert.equal(runtime.getRuntime().loading, false)
    assert.equal(runtime.getRuntime().connected, false)
    assert.equal(runtime.getRuntime().error, 'Connection refused')
    assert.equal(runtime.getRuntime().plan, null)
    assert.equal(applied, false)
  })

  await t.test('a frontend-only HTML response cannot become a demo', async t => {
    t.mock.method(globalThis, 'fetch', async () => new Response('<html>Vite</html>'))
    await runtime.startRuntime()
    assert.equal(runtime.getRuntime().connected, false)
    assert.ok(runtime.getRuntime().error)
    assert.equal(applied, false)
  })

  await t.test('a reachable Hub lists its registered projects', async t => {
    const projects = [{ name: 'Commercial Backbone', checkoutId: 'checkout', features: [] }]
    t.mock.method(globalThis, 'fetch', async (url: string) => Response.json(url === '/api/session' ? { mode: 'central' } : projects))
    t.mock.method(globalThis, 'setInterval', () => 0)
    await runtime.startRuntime()
    assert.equal(runtime.getRuntime().mode, 'central')
    assert.equal(runtime.getRuntime().connected, true)
    assert.equal(runtime.getRuntime().error, null)
    assert.deepEqual(runtime.getRuntime().projects, projects)
    assert.equal(applied, false)
  })
})
