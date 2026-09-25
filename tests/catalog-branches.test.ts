import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { writeFile } from 'node:fs/promises'
import { localDefaultBranch, readProductCatalogPlan } from '../server/catalog-branches.ts'
import { readPlan, writePlan } from '../server/repository.ts'
import { git } from '../server/git.ts'
import { initialise } from '../server/setup.ts'
import { commitAll, gitInit, guard, tempDir } from './helpers.ts'

test('other repositories are read from their committed default branch while the edited home uses its working tree', async t => {
  const base = await tempDir(t, 'groundwork-branches-')
  const home = await gitInit(path.join(base, 'home'))
  const source = await gitInit(path.join(base, 'source'))
  await git(home, ['remote', 'add', 'origin', 'git@github.com:acme/home.git'])
  await git(source, ['remote', 'add', 'origin', 'git@github.com:acme/source.git'])
  await initialise(home, { name: 'Home' })
  await initialise(source, { name: 'Source' })
  await commitAll(home)
  const mainHead = await commitAll(source)
  await git(source, ['checkout', '-q', '-b', 'feature'])
  const before = await readPlan(source)
  const product = before.snapshot.products[0]
  const storedProduct = JSON.parse(before.files[`products/${product.id}.json`])
  await writePlan(source, { ...guard(before), changes: {
    [`products/${product.id}.json`]: JSON.stringify({ ...storedProduct, name: 'Feature branch only' }),
  } })

  const defaultBranch = await localDefaultBranch(source)
  assert.equal(defaultBranch?.branch, 'main')
  assert.equal(defaultBranch?.commit, mainHead)
  const otherView = await readProductCatalogPlan(source, home)
  assert.equal(otherView.plan.snapshot.products[0].name, product.name)
  assert.equal(otherView.source.workingTree, false)
  assert.match(otherView.source.label, /acme\/source@main/)
  assert.match(otherView.source.label, new RegExp(mainHead.slice(0, 12)))

  const ownView = await readProductCatalogPlan(source, source)
  assert.equal(ownView.plan.snapshot.products[0].name, 'Feature branch only')
  assert.equal(ownView.source.workingTree, true)
  assert.match(ownView.source.label, /feature \(working tree\)/)
})

test('a source clone without Groundwork is an empty committed catalog candidate', async t => {
  const base = await tempDir(t, 'groundwork-branches-empty-')
  const home = await gitInit(path.join(base, 'home'))
  const source = await gitInit(path.join(base, 'source'))
  await git(source, ['remote', 'add', 'origin', 'git@github.com:acme/source.git'])
  await writeFile(path.join(source, 'main.ts'), 'export const value = 1\n')
  const head = await commitAll(source)

  const view = await readProductCatalogPlan(source, home)
  assert.equal(view.plan.snapshot.components.length, 0)
  assert.equal(view.source.workingTree, false)
  assert.equal(view.source.commit, head)
  assert.match(view.source.label, /acme\/source@main/)
})
