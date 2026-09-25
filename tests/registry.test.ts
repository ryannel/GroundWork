import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { initialise } from '../server/setup.ts'
import { inventory, register, unregister, readHubRegistry, selectRoot, previewFolderRegistration, registerFolder } from '../server/registry.ts'
import { context, git } from '../server/git.ts'
import { gitInit, tempDir, withEnv } from './helpers.ts'

async function home(t: Parameters<typeof tempDir>[0]) {
  const base = await tempDir(t, 'groundwork-registry-')
  withEnv(t, { GROUNDWORK_HOME: path.join(base, 'config') })
  return base
}

test('registration stores exact checkouts and product workspace references in one registry', async t => {
  const base = await home(t)
  const root = await gitInit(path.join(base, 'app'))
  await git(root, ['remote', 'add', 'origin', 'git@github.com:acme/app.git'])
  await initialise(root, { name: 'App' })
  await register(root, 'Team')
  const config = await readHubRegistry()
  assert.deepEqual(config.checkouts, { 'acme/app': [root] })
  assert.deepEqual(config.workspaces, [{ name: 'Team', products: [{ repository: 'acme/app', product: 'app' }] }])
  const [entry] = await inventory()
  assert.equal(entry.productPath, '/r/acme%2Fapp/app')
  assert.equal(await selectRoot(entry.checkoutId), root)
  await unregister(root)
  assert.deepEqual((await readHubRegistry()).checkouts, {})
  await assert.rejects(selectRoot(entry.checkoutId), /Unknown checkout/)
})

test('a source checkout can register before it has Groundwork documents', async t => {
  const base = await home(t)
  const root = await gitInit(path.join(base, 'source'))
  await git(root, ['remote', 'add', 'origin', 'git@github.com:acme/source.git'])
  await register(root)
  const [entry] = await inventory()
  assert.equal(entry.projectId, null)
  assert.equal(entry.error, null)
  assert.equal(await selectRoot((await context(root)).checkoutId), root)
})

test('a missing checkout does not hide registered peers', async t => {
  const base = await home(t)
  const a = await gitInit(path.join(base, 'a'))
  const b = await gitInit(path.join(base, 'b'))
  await register(a)
  await register(b)
  await rm(a, { recursive: true, force: true })
  assert.equal(await selectRoot((await context(b)).checkoutId), b)
})

test('folder registration adds only selected Git repositories and rejects a foreign path', async t => {
  const base = await home(t)
  const folder = path.join(base, 'clones')
  const a = await gitInit(path.join(folder, 'a'))
  const b = await gitInit(path.join(folder, 'b'))
  await git(a, ['remote', 'add', 'origin', 'git@github.com:acme/a.git'])
  await git(b, ['remote', 'add', 'origin', 'git@github.com:acme/b.git'])
  const preview = await previewFolderRegistration(folder)
  assert.deepEqual(preview.repositories.map(item => item.repository), ['acme/a', 'acme/b'])
  await assert.rejects(registerFolder(folder, [path.join(folder, 'missing')]), /Select repositories/)
  await registerFolder(folder, [a])
  assert.deepEqual((await readHubRegistry()).checkouts, { 'acme/a': [a] })
})

test('malformed registry names the one current file', async t => {
  const base = await home(t)
  await mkdir(path.join(base, 'config'), { recursive: true })
  await writeFile(path.join(base, 'config/registry.json'), '{broken')
  await assert.rejects(readHubRegistry(), /registry\.json/)
})
