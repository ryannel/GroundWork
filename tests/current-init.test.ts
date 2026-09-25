import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lstat, readFile } from 'node:fs/promises'
import path from 'node:path'
import { initialise } from '../server/setup.ts'
import { readPlan, writePlan } from '../server/repository.ts'
import { git, context } from '../server/git.ts'
import { gitInit, guard, tempDir } from './helpers.ts'

test('init in a Git checkout writes repository products without a project manifest and permits planning writes', async t => {
  const root = await gitInit(await tempDir(t, 'groundwork-current-init-'))
  await git(root, ['remote', 'add', 'origin', 'git@github.com:acme/example.git'])
  await initialise(root, { name: 'Example product' })
  assert.equal(await lstat(path.join(root, '.groundwork/project.json')).catch(() => null), null)
  assert.equal(await lstat(path.join(root, '.groundwork/plans/project.json')).catch(() => null), null)
  const product = JSON.parse(await readFile(path.join(root, '.groundwork/products/example.json'), 'utf8'))
  assert.deepEqual(product.repositories, [{ repository: 'acme/example', role: 'owned' }])
  const plan = await readPlan(root)
  assert.equal(plan.layout, 'catalog-v3')
  assert.equal(plan.repository.id, (await context(root)).repository.id)
  await writePlan(root, { ...guard(plan), changes: { 'members/owner.json': JSON.stringify({ id: 'owner', name: 'Renamed owner' }) } })
  assert.equal((await readPlan(root)).snapshot.members[0].name, 'Renamed owner')
})
