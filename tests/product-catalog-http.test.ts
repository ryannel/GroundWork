import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { serve } from '../server/http.ts'
import { context, git } from '../server/git.ts'
import { initialise } from '../server/setup.ts'
import { gitInit, tempDir } from './helpers.ts'

test('the Hub exposes resolved product catalog and read provenance on request', async t => {
  const base = await tempDir(t, 'groundwork-product-http-')
  const root = await gitInit(path.join(base, 'home'))
  await git(root, ['remote', 'add', 'origin', 'git@github.com:acme/home.git'])
  await initialise(root, { name: 'Home' })
  const viewerDirectory = path.join(base, 'viewer')
  await mkdir(viewerDirectory)
  await writeFile(path.join(viewerDirectory, 'index.html'), '<!doctype html><title>Test</title>')
  const app = await serve({ root, port: 0, viewerDirectory })
  t.after(() => app.close())
  const checkoutId = (await context(root)).checkoutId
  const response = await fetch(`${app.url}/api/product-catalog?${new URLSearchParams({ checkoutId, productId: 'home' })}`)
  assert.equal(response.status, 200)
  const catalog = await response.json()
  assert.equal(catalog.homeRepository, 'acme/home')
  assert.equal(catalog.productId, 'home')
  assert.equal(catalog.repositories[0].repository, 'acme/home')
  assert.match(catalog.repositories[0].source.label, /acme\/home@main.*working tree/)
})
