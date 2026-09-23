import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { createRuntime } from '../src/data/runtime.ts'

/** Collects scheduled polls so a test can run them by hand. */
function manualTimers() {
  const pending = new Map<number, () => void>()
  let next = 0
  return {
    pending,
    set: (callback: () => void) => { pending.set(++next, callback); return next },
    clear: (handle: unknown) => { pending.delete(handle as number) },
    /** Runs the one scheduled poll and waits for it to settle. */
    async fire() {
      assert.equal(pending.size, 1, 'exactly one poll is scheduled')
      const [[handle, callback]] = pending
      pending.delete(handle)
      callback()
      await settle()
    },
  }
}
const settle = () => new Promise(resolve => setImmediate(resolve))

class FakeEventSource {
  static streams: FakeEventSource[] = []
  onopen?: () => void
  onmessage?: (event: { data: string }) => void
  onerror?: () => void
  readyState = 0
  closed = false
  url: string
  constructor(url: string) { this.url = url; FakeEventSource.streams.push(this) }
  close() { this.closed = true; this.readyState = 2 }
  send(data: unknown) { this.onmessage?.({ data: JSON.stringify(data) }) }
}
function fakeEventSource(t: TestContext) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'EventSource')
  FakeEventSource.streams = []
  Object.defineProperty(globalThis, 'EventSource', { configurable: true, value: FakeEventSource })
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'EventSource', original)
    else Reflect.deleteProperty(globalThis, 'EventSource')
  })
  return FakeEventSource.streams
}

test('the default runtime loads without a browser location and parses nothing', async t => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Reflect.deleteProperty(globalThis, 'window')
  t.after(() => { if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow) })
  const runtime = await import('../src/data/runtime.ts')
  assert.equal(runtime.runtimeBase, '/')
  assert.equal(runtime.checkoutId, undefined)
  assert.equal(runtime.getRuntime().loading, true)
})

test('project routes and refs are parsed, and malformed refs do not crash startup', () => {
  assert.deepEqual(
    (({ runtimeBase, checkoutId, selectedRef }) => ({ runtimeBase, checkoutId, selectedRef }))(createRuntime('/p/abc/ref/feature%2Fx/f/1')),
    { runtimeBase: '/p/abc/ref/feature%2Fx', checkoutId: 'abc', selectedRef: 'feature/x' },
  )
  const malformed = createRuntime('/p/abc/ref/%E0')
  assert.equal(malformed.checkoutId, 'abc')
  assert.equal(malformed.selectedRef, undefined)
})

test('an unavailable API reports a disconnected state', async t => {
  const runtime = createRuntime('/')
  let applied = false
  runtime.attachSnapshot(() => { applied = true })
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Connection refused') })
  await runtime.startRuntime()
  assert.equal(runtime.getRuntime().loading, false)
  assert.equal(runtime.getRuntime().connected, false)
  assert.equal(runtime.getRuntime().error, 'Connection refused')
  assert.equal(runtime.getRuntime().plan, null)
  assert.equal(applied, false)
})

test('a frontend-only HTML response or unknown session mode cannot become a demo', async t => {
  const runtime = createRuntime('/')
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>Vite</html>'))
  await runtime.startRuntime()
  assert.equal(runtime.getRuntime().connected, false)
  assert.ok(runtime.getRuntime().error)
  t.mock.method(globalThis, 'fetch', async () => Response.json({ mode: 'demo' }))
  await runtime.startRuntime()
  assert.equal(runtime.getRuntime().error, 'Invalid Groundwork service response')
})

test('a reachable Hub lists its registered projects and rejects malformed lists', async t => {
  const timers = manualTimers()
  const runtime = createRuntime('/', timers)
  const projects = [{ name: 'Retail Platform', checkoutId: 'checkout', features: [] }]
  let body: unknown = projects
  t.mock.method(globalThis, 'fetch', async (url: string) => Response.json(url === '/api/session' ? { mode: 'central' } : body))
  await runtime.startRuntime()
  assert.equal(runtime.getRuntime().mode, 'central')
  assert.equal(runtime.getRuntime().connected, true)
  assert.equal(runtime.getRuntime().loading, false)
  assert.equal(runtime.getRuntime().error, null)
  assert.deepEqual(runtime.getRuntime().projects, projects)
  body = [{ name: 'No checkout ID' }]
  await timers.fire()
  assert.equal(runtime.getRuntime().error, 'Invalid registered projects response')
  assert.deepEqual(runtime.getRuntime().projects, projects)
})

test('a transient project-list failure recovers on the next poll', async t => {
  const timers = manualTimers()
  const runtime = createRuntime('/', timers)
  let attempts = 0
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    if (url === '/api/session') return Response.json({ mode: 'central' })
    return ++attempts === 1 ? new Response('Unavailable', { status: 503 }) : Response.json([{ checkoutId: 'recovered' }])
  })
  await runtime.startRuntime()
  assert.equal(runtime.getRuntime().loading, false)
  assert.equal(runtime.getRuntime().connected, true)
  assert.equal(runtime.getRuntime().error, 'Could not load registered projects')
  await timers.fire()
  assert.deepEqual(runtime.getRuntime().projects, [{ checkoutId: 'recovered' }])
  assert.equal(runtime.getRuntime().error, null)
})

test('a slow project list is not starved: the next poll waits for it and no requests pile up', async t => {
  const timers = manualTimers()
  const runtime = createRuntime('/', timers)
  const pending: ((response: Response) => void)[] = []
  let requests = 0
  t.mock.method(globalThis, 'fetch', (url: string) => {
    if (url === '/api/session') return Promise.resolve(Response.json({ mode: 'central' }))
    requests++
    return new Promise<Response>(resolve => { pending.push(resolve) })
  })
  const started = runtime.startRuntime()
  await settle()
  assert.equal(timers.pending.size, 0, 'no poll is scheduled while the first request is in flight')
  // A concurrent refresh shares the in-flight request instead of starting another.
  const shared = runtime.refreshProjects()
  assert.equal(requests, 1)
  pending.shift()!(Response.json([{ checkoutId: 'slow' }]))
  await Promise.all([started, shared])
  assert.deepEqual(runtime.getRuntime().projects, [{ checkoutId: 'slow' }])
  assert.equal(timers.pending.size, 1)
  const [[, poll]] = timers.pending
  timers.pending.clear()
  poll()
  await settle()
  assert.equal(requests, 2)
  assert.equal(timers.pending.size, 0)
  pending.shift()!(Response.json([{ checkoutId: 'slower' }]))
  await settle()
  assert.deepEqual(runtime.getRuntime().projects, [{ checkoutId: 'slower' }])
  assert.equal(timers.pending.size, 1)
})

test('a restart aborts the in-flight project request and cancels its poll', async t => {
  const timers = manualTimers()
  const runtime = createRuntime('/', timers)
  const signals: AbortSignal[] = []
  let holdProjects = false
  let resolveProjects!: (response: Response) => void
  t.mock.method(globalThis, 'fetch', (url: string, init?: RequestInit) => {
    if (url === '/api/session') return Promise.resolve(Response.json({ mode: 'central' }))
    signals.push(init!.signal!)
    if (holdProjects) return new Promise<Response>(resolve => { resolveProjects = resolve })
    return Promise.resolve(Response.json([{ checkoutId: 'fresh' }]))
  })
  await runtime.startRuntime()
  const [[, stalePoll]] = timers.pending
  holdProjects = true
  const stale = runtime.refreshProjects()
  holdProjects = false
  await runtime.startRuntime()
  assert.equal(signals.at(-2)!.aborted, true)
  resolveProjects(Response.json([{ checkoutId: 'stale' }]))
  await stale
  assert.deepEqual(runtime.getRuntime().projects, [{ checkoutId: 'fresh' }])
  assert.equal(timers.pending.size, 1, 'the earlier generation poll was cleared')
  const count = signals.length
  stalePoll()
  await settle()
  assert.equal(signals.length, count, 'a poll from an earlier generation never fetches')
})

test('only the latest startup can publish', async t => {
  const runtime = createRuntime('/', manualTimers())
  let resolveSession!: (response: Response) => void
  let sessions = 0
  t.mock.method(globalThis, 'fetch', (url: string) => {
    if (url === '/api/session' && ++sessions === 1) return new Promise<Response>(resolve => { resolveSession = resolve })
    return Promise.resolve(Response.json(url === '/api/session' ? { mode: 'central' } : [{ checkoutId: 'fresh' }]))
  })
  const staleStart = runtime.startRuntime()
  await runtime.startRuntime()
  resolveSession(Response.json({ mode: 'standalone' }))
  await staleStart
  assert.deepEqual(runtime.getRuntime().projects, [{ checkoutId: 'fresh' }])
  assert.equal(runtime.getRuntime().mode, 'central')
})

test('runtime restarts close old streams, reject stale events and recover from malformed events', async t => {
  const streams = fakeEventSource(t)
  const runtime = createRuntime('/')
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
  assert.match(runtime.getRuntime().error ?? '', /reconnecting/)
  first.onopen?.()
  assert.equal(runtime.getRuntime().connected, true)
  assert.equal(runtime.getRuntime().error, null, 'reopening clears the connection error before the next message')
  first.send({ plan, error: null })
  assert.equal(runtime.getRuntime().connected, true)
  assert.equal(runtime.getRuntime().error, null)

  first.onmessage?.({ data: 'invalid json' })
  assert.equal(runtime.getRuntime().plan?.revision, 'r1')
  assert.ok(runtime.getRuntime().error)
  first.send({ plan: { snapshot: {} }, error: null })
  assert.equal(runtime.getRuntime().plan?.revision, 'r1')
  assert.equal(runtime.getRuntime().error, 'Invalid Groundwork event response')
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
  second.onopen?.()
  assert.equal(runtime.getRuntime().error, 'No plan is available', 'reopening keeps plan errors')
  second.readyState = 2
  second.onerror?.()
  assert.match(runtime.getRuntime().error ?? '', /Reload the page/)
})

test('a project route streams that checkout and its ref', async t => {
  const streams = fakeEventSource(t)
  const runtime = createRuntime('/p/abc/ref/feature%2Fx')
  t.mock.method(globalThis, 'fetch', async (url: string) => Response.json(url === '/api/session' ? { mode: 'central' } : [{ checkoutId: 'abc' }]))
  await runtime.startRuntime()
  assert.equal(streams.at(-1)!.url, '/api/events?checkoutId=abc&ref=feature%2Fx')
  assert.deepEqual(runtime.getRuntime().projects, [{ checkoutId: 'abc' }])
})
