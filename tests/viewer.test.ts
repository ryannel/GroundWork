import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { createServer } from 'node:http'
import { initialise, installInstructions } from '../server/setup.ts'
import { startViewer } from '../server/viewer.ts'
import { register, inventory } from '../server/registry.ts'
import { tempDir, withEnv } from './helpers.ts'

test('projects share one Hub while standalone startup stays isolated', async t => {
  const temp = await tempDir(t, 'groundwork-viewer-')
  withEnv(t, { GROUNDWORK_HOME: path.join(temp, 'config') })
  // A stub viewer page, so the test does not depend on a prior `npm run build` producing dist/.
  const viewerDirectory = path.join(temp, 'viewer')
  await mkdir(viewerDirectory)
  await writeFile(path.join(viewerDirectory, 'index.html'), '<!doctype html><html><title>Groundwork test viewer</title></html>')
  const a = path.join(temp, 'a'), b = path.join(temp, 'b'), c = path.join(temp, 'c')
  for (const root of [a, b, c]) await initialise(root, { name: path.basename(root) })
  await register(a, 'Personal', 'Suite')
  const first = await startViewer({ root: a, port: 0, viewerDirectory }); t.after(() => first.app!.close())
  const firstPage = await fetch(first.url)
  assert.equal(firstPage.status, 200)
  assert.match(await firstPage.text(), /<html/)
  const port = Number(new URL(first.url).port)
  const second = await startViewer({ root: b, port })
  assert.equal((await fetch(second.url)).status, 200)
  assert.equal(second.reused, true)
  assert.equal(second.app, undefined)
  assert.equal(new URL(second.url).origin, new URL(first.url).origin)
  assert.notEqual(new URL(second.url).pathname, new URL(first.url).pathname)
  assert.equal((await inventory()).find(p => p.root === a)?.workspace, 'Personal')
  assert.equal((await inventory()).find(p => p.root === a)?.product, 'Suite')
  const hub = await startViewer({ port })
  assert.equal(hub.url, new URL(first.url).origin)
  const response = await fetch(hub.url + '/api/projects')
  assert.equal((await response.json()).length, 2)
  const isolated = await startViewer({ root: c, standalone: true, port: 0, viewerDirectory }); t.after(() => isolated.app!.close())
  assert.equal(new URL(isolated.url).pathname, '/')
  assert.equal((await inventory()).length, 2)
  const isolatedPort = Number(new URL(isolated.url).port)
  assert.equal((await startViewer({ root: c, standalone: true, port: isolatedPort })).reused, true)
  await assert.rejects(startViewer({ root: a, standalone: true, port: isolatedPort }), /another service, project/)
  await assert.rejects(startViewer({ root: c, port: isolatedPort }), /another service, project/)
})

test('startup refuses an occupied unrelated port', async t => {
  const server = createServer((_, res) => { res.end('<html>Other app</html>') })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())))
  await assert.rejects(startViewer({ port: (server.address() as { port: number }).port }), /another service/)
})

test('instruction refresh installs project startup scripts without replacing user scripts', async t => {
  const root = await tempDir(t, 'groundwork-scripts-')
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'app', scripts: { 'plans:start': 'my-custom-command', dev: 'vite' } }))
  await installInstructions(root)
  await installInstructions(root)
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  assert.equal(pkg.scripts['plans:start'], 'my-custom-command')
  assert.equal(pkg.scripts['plans:standalone'], 'groundwork-v2 serve')
  assert.equal(pkg.scripts['plans:hub'], 'groundwork-v2 hub')
  assert.equal(pkg.scripts.dev, 'vite')
})
