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

  await t.test('a transient project-list failure recovers on the next poll', async t => {
    let attempts = 0
    t.mock.method(globalThis, 'fetch', async (url: string) => {
      if (url === '/api/session') return Response.json({ mode: 'central' })
      return ++attempts === 1 ? new Response('Unavailable', { status: 503 }) : Response.json([{ checkoutId: 'recovered' }])
    })
    let poll!: () => void
    t.mock.method(globalThis, 'setInterval', (callback: () => void) => { poll = callback; return 1 })
    await runtime.startRuntime()
    assert.equal(runtime.getRuntime().loading, false)
    assert.equal(runtime.getRuntime().connected, true)
    assert.equal(runtime.getRuntime().error, 'Could not load registered projects')
    poll()
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(runtime.getRuntime().projects, [{ checkoutId: 'recovered' }])
    assert.equal(runtime.getRuntime().error, null)
  })

  await t.test('runtime restarts close old streams, reject stale events and recover from malformed events', async t => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const originalEventSource = Object.getOwnPropertyDescriptor(globalThis, 'EventSource')
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { pathname: '/' } } })
    const streams: FakeEventSource[] = []
    class FakeEventSource {
      onmessage?: (event: { data: string }) => void
      onerror?: () => void
      closed = false
      url: string
      constructor(url: string) { this.url = url; streams.push(this) }
      close() { this.closed = true }
      send(data: unknown) { this.onmessage?.({ data: JSON.stringify(data) }) }
    }
    Object.defineProperty(globalThis, 'EventSource', { configurable: true, value: FakeEventSource })
    t.after(() => {
      for (const [key, descriptor] of [['window', originalWindow], ['EventSource', originalEventSource]] as const) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else Reflect.deleteProperty(globalThis, key)
      }
    })
    const runtime = await import('../src/data/runtime.ts')
    const snapshots: unknown[] = []
    runtime.attachSnapshot(snapshot => snapshots.push(snapshot))
    t.mock.method(globalThis, 'fetch', async () => Response.json({ mode: 'standalone' }))
    await runtime.startRuntime()
    const first = streams.at(-1)!
    assert.equal(first.url, '/api/events?')
    const snapshot = { workspaces: [], products: [], components: [], features: [] }
    const plan = { snapshot, revision: 'r1', context: { token: 'checkout' }, manifest: { name: 'Test' } }
    first.send({ plan, error: null })
    assert.equal(runtime.getRuntime().plan?.revision, 'r1')
    first.onerror?.()
    assert.equal(runtime.getRuntime().connected, false)
    first.send({ plan, error: null })
    assert.equal(runtime.getRuntime().connected, true)
    assert.equal(runtime.getRuntime().error, null)

    first.onmessage?.({ data: 'invalid json' })
    assert.equal(runtime.getRuntime().plan?.revision, 'r1')
    assert.ok(runtime.getRuntime().error)
    first.send({ plan: { snapshot: {} }, error: null })
    assert.equal(runtime.getRuntime().plan?.revision, 'r1')
    assert.deepEqual(snapshots, [snapshot, snapshot])

    await runtime.startRuntime()
    assert.equal(first.closed, true)
    first.send({ plan: null, error: null })
    first.onerror?.()
    assert.equal(runtime.getRuntime().plan?.revision, 'r1')
    const second = streams.at(-1)!
    second.send({ plan: null, error: 'No plan is available' })
    assert.equal(runtime.getRuntime().plan, null)
    assert.equal(runtime.getRuntime().error, 'No plan is available')
    assert.equal(snapshots.at(-1), null)
  })

  await t.test('only the latest startup and projects poll can publish', async t => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { pathname: '/' } } })
    t.after(() => {
      if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
      else Reflect.deleteProperty(globalThis, 'window')
    })
    const runtime = await import('../src/data/runtime.ts')
    let resolveSession!: (response: Response) => void
    let resolveProjects!: (response: Response) => void
    let holdProjects = false
    const requests: string[] = []
    t.mock.method(globalThis, 'fetch', (url: string) => {
      requests.push(url)
      if (url === '/api/session' && requests.filter(request => request === url).length === 1)
        return new Promise<Response>(resolve => { resolveSession = resolve })
      if (url === '/api/projects' && holdProjects)
        return new Promise<Response>(resolve => { resolveProjects = resolve })
      return Promise.resolve(Response.json(url === '/api/session' ? { mode: 'central' } : [{ checkoutId: 'fresh' }]))
    })
    let poll: (() => void) | undefined
    const cleared: unknown[] = []
    t.mock.method(globalThis, 'setInterval', (callback: () => void) => { poll = callback; return 42 })
    t.mock.method(globalThis, 'clearInterval', (handle: unknown) => { cleared.push(handle) })

    const staleStart = runtime.startRuntime()
    await runtime.startRuntime()
    resolveSession(Response.json({ mode: 'standalone' }))
    await staleStart
    assert.deepEqual(runtime.getRuntime().projects, [{ checkoutId: 'fresh' }])
    assert.equal(runtime.getRuntime().mode, 'central')

    const previousPoll = poll!
    holdProjects = true
    const staleProjects = runtime.refreshProjects()
    holdProjects = false
    await runtime.startRuntime()
    assert.deepEqual(cleared, [42])
    resolveProjects(Response.json([{ checkoutId: 'stale' }]))
    await staleProjects
    assert.deepEqual(runtime.getRuntime().projects, [{ checkoutId: 'fresh' }])
    const count = requests.length
    previousPoll()
    assert.equal(requests.length, count)

    holdProjects = true
    const olderPoll = runtime.refreshProjects()
    holdProjects = false
    await runtime.refreshProjects()
    resolveProjects(new Response('Unavailable', { status: 503 }))
    await olderPoll
    assert.deepEqual(runtime.getRuntime().projects, [{ checkoutId: 'fresh' }])
    assert.equal(runtime.getRuntime().error, null)
  })
})
