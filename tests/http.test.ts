import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { request, type IncomingMessage } from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'
import { initialise } from '../server/setup.ts'
import { readPlan } from '../server/repository.ts'
import { git } from '../server/git.ts'
import { httpStatus, serve } from '../server/http.ts'
import { InvalidInput } from '../server/errors.ts'

async function fixture(t: any, gitRepo = false) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groundwork-http-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await initialise(root, { name: 'HTTP app' })
  if (gitRepo) {
    await mkdir(path.join(root, '.groundwork/plans/assets'), { recursive: true })
    await writeFile(path.join(root, '.groundwork/plans/assets/pixel.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0xfe, 0x80]))
    await git(root, ['init', '-b', 'main'])
    await git(root, ['config', 'user.email', 'tests@example.invalid'])
    await git(root, ['config', 'user.name', 'Groundwork tests'])
    await git(root, ['add', '.'])
    await git(root, ['commit', '-m', 'Initial plan'])
  }
  const viewerDirectory = path.join(root, 'viewer')
  await mkdir(viewerDirectory)
  await writeFile(path.join(viewerDirectory, 'index.html'), '<!doctype html><title>viewer</title>')
  const app = await serve({ root, port: 0, viewerDirectory })
  t.after(() => app.close())
  const { token } = await (await fetch(app.url + '/api/session')).json() as { token: string }
  return { root, app, token }
}
const guard = (plan: Awaited<ReturnType<typeof readPlan>>) => ({ expectedRevision: plan.revision, expectedContext: plan.context.token })

/** Sends a POST body in separate TCP writes so the server sees separate chunks. */
function post(url: string, headers: Record<string, string | number>, parts: Buffer[]) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = request(url, { method: 'POST', headers }, (res: IncomingMessage) => {
      let body = ''
      res.setEncoding('utf8').on('data', chunk => { body += chunk }).on('end', () => resolve({ status: res.statusCode!, body }))
    })
    req.on('error', reject)
    void (async () => {
      for (const [index, part] of parts.entries()) { if (index) await delay(50); req.write(part) }
      req.end()
    })()
  })
}

test('a multi-byte character split across chunks is decoded intact', async t => {
  const { root, app, token } = await fixture(t)
  const name = 'Zoë 日本'
  const body = Buffer.from(JSON.stringify({ ...guard(await readPlan(root)), changes: { 'members/owner.json': JSON.stringify({ id: 'owner', name }) } }))
  const split = body.indexOf(Buffer.from('日')) + 1
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Content-Length': body.length }
  const response = await post(app.url + '/api/operations/write_plan', headers, [body.subarray(0, split), body.subarray(split)])
  assert.equal(response.status, 200, response.body)
  assert.equal((await readPlan(root)).snapshot.members[0].name, name)
})

test('POST bodies are bounded, must be UTF-8, and statuses separate input, conflicts and missing things', async t => {
  const { root, app, token } = await fixture(t)
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const call = (operation: string, body: string | Buffer, extra: Record<string, string | number> = {}) =>
    post(app.url + '/api/operations/' + operation, { ...headers, 'Content-Length': Buffer.byteLength(body), ...extra }, [Buffer.from(body)])
  assert.equal((await post(app.url + '/api/operations/write_plan', { ...headers, 'Content-Length': 5 * 1024 * 1024 }, [])).status, 413)
  assert.equal((await call('write_plan', Buffer.from([0x7b, 0xff, 0x7d]))).status, 400)
  assert.equal((await call('write_plan', '{not json')).status, 400)
  assert.equal((await call('no_such_operation', '{}')).status, 404)
  assert.equal((await call('write_plan', '{}', { Authorization: `Bearer ${token.slice(1)}` })).status, 401)
  const plan = await readPlan(root)
  const create = { id: 'f', title: 'Feature', productId: 'app', ownerId: 'owner', problem: 'Problem', outcome: 'Outcome' }
  assert.equal((await call('create_feature', JSON.stringify({ ...guard(plan), ...create }))).status, 200)
  const stale = await call('record_progress', JSON.stringify({ ...guard(plan), featureId: 'f', stage: 'exploring' }))
  assert.equal(stale.status, 409, stale.body)
  const current = await readPlan(root)
  assert.equal((await call('record_progress', JSON.stringify({ ...guard(current), featureId: 'missing', stage: 'exploring' }))).status, 404)
  assert.equal((await call('record_progress', JSON.stringify({ ...guard(current), featureId: 'f', status: 'done' }))).status, 400)
})

test('assets are served from the working tree and committed refs, and missing assets are 404', async t => {
  const { app, root } = await fixture(t, true)
  const checkoutId = (await readPlan(root)).context.checkoutId
  const expected = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0xfe, 0x80])
  for (const ref of ['', '&ref=main']) {
    const found = await fetch(`${app.url}/api/asset?checkoutId=${checkoutId}${ref}&path=assets/pixel.png`)
    assert.equal(found.status, 200, ref)
    assert.equal(found.headers.get('content-type'), 'image/png')
    assert.deepEqual(Buffer.from(await found.arrayBuffer()), expected)
    assert.equal((await fetch(`${app.url}/api/asset?checkoutId=${checkoutId}${ref}&path=assets/missing.png`)).status, 404, ref)
  }
  assert.equal((await fetch(`${app.url}/api/asset?checkoutId=${checkoutId}&ref=no-such-ref&path=assets/pixel.png`)).status, 404)
})

test('static files stay inside the viewer and the CSP allows the viewer fonts', async t => {
  const { app } = await fixture(t)
  const page = await fetch(app.url + '/')
  assert.equal(page.status, 200)
  const csp = page.headers.get('content-security-policy')!
  assert.match(csp, /script-src 'self';/)
  assert.match(csp, /style-src [^;]*https:\/\/fonts\.googleapis\.com/)
  assert.match(csp, /font-src [^;]*https:\/\/fonts\.gstatic\.com/)
  for (const escape of ['/%2e%2e/package.json', '/assets/..%2f..%2fpackage.json']) {
    const response = await fetch(app.url + escape)
    assert.notEqual(response.status, 200, escape)
    assert.doesNotMatch(await response.text(), /"name": "groundwork/, escape)
  }
})

const watched = () => process.getActiveResourcesInfo().filter(kind => kind === 'Timeout' || kind === 'FSEventWrap').length
async function settle(expected: number) {
  for (let attempt = 0; attempt < 100 && watched() !== expected; attempt++) await delay(50)
  return watched()
}
async function firstEvent(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal })
  const reader = response.body!.getReader()
  let text = ''
  while (!text.includes('data: ')) text += new TextDecoder().decode((await reader.read()).value)
  return reader
}

test('event streams that disconnect early leave no timers or watchers behind', { timeout: 20000 }, async t => {
  const { app } = await fixture(t)
  const baseline = watched()
  await Promise.all(Array.from({ length: 5 }, () => new Promise<void>(resolve => {
    const req = request(app.url + '/api/events')
    req.on('error', () => resolve())
    req.on('response', response => { response.destroy(); req.destroy(); resolve() })
    req.end()
  })))
  assert.equal(await settle(baseline), baseline)
})

test('event stream subscribers share one poller and watcher per checkout', { timeout: 20000 }, async t => {
  const { app } = await fixture(t)
  const baseline = watched()
  const first = new AbortController()
  await firstEvent(app.url + '/api/events', first.signal)
  await delay(100)
  const one = watched()
  assert.ok(one > baseline)
  const more = Array.from({ length: 3 }, () => new AbortController())
  await Promise.all(more.map(controller => firstEvent(app.url + '/api/events', controller.signal)))
  await delay(100)
  assert.equal(watched(), one)
  for (const controller of [first, ...more]) controller.abort()
  assert.equal(await settle(baseline), baseline)
})

test('close() ends open event streams and releases their resources', { timeout: 20000 }, async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groundwork-http-close-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await initialise(root, { name: 'Close app' })
  const baseline = watched()
  const app = await serve({ root, port: 0 })
  const controller = new AbortController()
  const reader = await firstEvent(app.url + '/api/events', controller.signal)
  await app.close()
  await reader.cancel().catch(() => undefined)
  assert.equal(await settle(baseline), baseline)
})
test('only typed and schema errors are client errors; an untyped Error is a server fault', () => {
  assert.equal(httpStatus(new InvalidInput('bad')), 400)
  assert.equal(httpStatus(new Error('unexpected')), 500)
})
