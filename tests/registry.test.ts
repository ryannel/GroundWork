import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { initialise } from '../server/setup.ts'
import { inventory, register, registry, selectRoot } from '../server/registry.ts'
import { context, git } from '../server/git.ts'
import { commitAll, gitInit, tempDir, withEnv } from './helpers.ts'

/** A registry of this test's own; tests/setup.ts already keeps the suite away from the real one. */
async function home(t: TestContext) {
  const base = await tempDir(t, 'groundwork-registry-')
  withEnv(t, { GROUNDWORK_HOME: path.join(base, 'config') })
  return base
}

test('a deleted registration does not stop other checkouts from being selected', async t => {
  const base = await home(t)
  const a = path.join(base, 'a'), b = path.join(base, 'b')
  await initialise(a, { name: 'A' }); await initialise(b, { name: 'B' })
  await register(a); await register(b)
  await rm(a, { recursive: true, force: true })
  // B's ID comes from git directly, so selectRoot starts with a cold cache and has to walk past A.
  const { checkoutId } = await context(b)
  assert.equal(await selectRoot(checkoutId), b)
})

test('a cached checkout whose worktree was removed is no longer selected', async t => {
  const base = await home(t)
  const root = path.join(base, 'repo'), worktree = path.join(base, 'worktree')
  await initialise(root, { name: 'Repo' })
  await gitInit(root)
  await commitAll(root, 'Plan')
  await git(root, ['worktree', 'add', '-b', 'side', worktree])
  await register(root)
  const entry = (await inventory()).find(item => item.root === worktree)!
  assert.equal(await selectRoot(entry.checkoutId), worktree)
  await rm(worktree, { recursive: true, force: true })
  await assert.rejects(selectRoot(entry.checkoutId), /Unknown checkout/)
})

test('registering reports a malformed plan instead of treating the folder as uninitialised', async t => {
  const base = await home(t)
  const root = path.join(base, 'broken')
  await initialise(root, { name: 'Broken' })
  await writeFile(path.join(root, '.groundwork/plans/project.json'), '{broken')
  await assert.rejects(register(root), /project\.json/)
  assert.deepEqual((await registry()).projects, [])
  const empty = path.join(base, 'empty')
  await mkdir(empty)
  assert.equal((await register(empty)).projectId, null)
})

test('registry errors name the file and the schema that matches its version', async t => {
  const base = await home(t)
  await mkdir(path.join(base, 'config'), { recursive: true })
  const file = path.join(base, 'config/registry.json')
  await writeFile(file, JSON.stringify({ version: 2, projects: [{ root: '/x', workspace: 'W' }] }))
  await assert.rejects(registry(), error => error instanceof Error && error.message.includes(file)
    && /product/.test(error.message) && !/expected 1/.test(error.message))
  await writeFile(file, JSON.stringify({ version: 1, projects: [{ root: '/x', workspace: 'W', projectId: 'p' }] }))
  assert.deepEqual((await registry()).projects, [{ root: '/x', workspace: 'W', projectId: 'p', product: 'W' }])
})
