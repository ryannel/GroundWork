import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { initialise } from '../server/setup.ts'
import { inventory, register, unregister, registry, selectRoot, previewHubMigration, migrateHubRegistry, previewFolderRegistration, registerFolder, labelMappingKey, registrationMappingKey } from '../server/registry.ts'
import { readHubRegistry, writeHubRegistry } from '../server/registry-v3.ts'
import { readPlan, writePlan } from '../server/repository.ts'
import { viewerProjectRoute } from '../server/viewer.ts'
import { context, git } from '../server/git.ts'
import { commitAll, gitInit, tempDir, withEnv, guard } from './helpers.ts'

/** A registry of this test's own; tests/setup.ts already keeps the suite away from the real one. */
async function home(t: TestContext, legacy = true) {
  const base = await tempDir(t, 'groundwork-registry-')
  withEnv(t, { GROUNDWORK_HOME: path.join(base, 'config') })
  if (legacy) {
    await mkdir(path.join(base, 'config'), { recursive: true })
    await writeFile(path.join(base, 'config/registry.json'), '{"version":2,"projects":[]}\n')
  }
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

test('v2 migration requires confirmed exact product mappings and leaves the v2 file intact', async t => {
  const base = await home(t)
  const homeRoot = path.join(base, 'price'), source = path.join(base, 'source')
  await gitInit(homeRoot); await git(homeRoot, ['remote', 'add', 'origin', 'git@github.com:acme/price.git'])
  await initialise(homeRoot, { name: 'Price' })
  await gitInit(source); await git(source, ['remote', 'add', 'origin', 'git@github.com:acme/source.git'])
  await register(homeRoot, 'Commercial', 'Pricing')
  await register(source, 'Commercial', 'Pricing')
  const before = await readFile(path.join(base, 'config/registry.json'), 'utf8')
  const key = labelMappingKey({ workspace: 'Commercial', product: 'Pricing' })
  const unresolved = await previewHubMigration()
  assert.deepEqual(unresolved.unresolved.map(item => item.key), [key])
  assert.equal(unresolved.checkoutCount, 2)
  await assert.rejects(migrateHubRegistry({}, true), /Unconfirmed registry labels/)
  const mappings = { [key]: { repository: 'acme/price', product: 'price' } }
  const preview = await previewHubMigration(mappings)
  assert.equal(preview.unresolved.length, 0)
  assert.deepEqual(preview.registry.workspaces, [{ name: 'Commercial', products: [{ repository: 'acme/price', product: 'price' }] }])
  await assert.rejects(migrateHubRegistry(mappings, false), /Confirm/)
  await migrateHubRegistry(mappings, true)
  assert.equal(await readFile(path.join(base, 'config/registry.json'), 'utf8'), before)
  assert.deepEqual((await readHubRegistry(path.join(base, 'config')))?.checkouts['acme/source'], [source])
})

test('migration requires root-specific mappings when distinct homes share a v2 label', async t => {
  const base = await home(t)
  const a = path.join(base, 'a'), b = path.join(base, 'b')
  for (const [root, remote] of [[a, 'a'], [b, 'b']]) {
    await gitInit(root); await git(root, ['remote', 'add', 'origin', `git@github.com:acme/${remote}.git`])
    await initialise(root, { name: 'App' })
    await register(root, 'Team', 'App')
  }
  const label = labelMappingKey({ workspace: 'Team', product: 'App' })
  const broad = { [label]: { repository: 'acme/a', product: 'a' } }
  const ambiguous = await previewHubMigration(broad)
  assert.equal(ambiguous.unresolved.length, 1)
  assert.deepEqual(ambiguous.unresolved[0].roots.sort(), [a, b])
  await assert.rejects(migrateHubRegistry(broad, true), /Unconfirmed registry labels/)
  const mappings = {
    [registrationMappingKey({ root: a, workspace: 'Team', product: 'App' })]: { repository: 'acme/a', product: 'a' },
    [registrationMappingKey({ root: b, workspace: 'Team', product: 'App' })]: { repository: 'acme/b', product: 'b' },
  }
  const preview = await previewHubMigration(mappings)
  assert.deepEqual(preview.unresolved, [])
  assert.deepEqual(preview.registry.workspaces[0].products, [{ repository: 'acme/a', product: 'a' },
    { repository: 'acme/b', product: 'b' }])
})

test('migration preview surfaces a malformed registered home instead of dropping it', async t => {
  const base = await home(t)
  const valid = path.join(base, 'valid'), broken = path.join(base, 'broken')
  await initialise(valid, { name: 'Valid' })
  await initialise(broken, { name: 'Broken' })
  await register(valid, 'Team', 'App')
  await register(broken, 'Team', 'App')
  await writeFile(path.join(broken, '.groundwork/plans/project.json'), '{broken')
  const label = labelMappingKey({ workspace: 'Team', product: 'App' })
  await assert.rejects(previewHubMigration({ [label]: { repository: 'local:valid', product: 'app' } }), /project\.json/)
})

test('v3 source-only checkout resolves its owning product without matching registry labels', async t => {
  const base = await home(t)
  const homeRoot = path.join(base, 'price'), source = path.join(base, 'source')
  await gitInit(homeRoot); await git(homeRoot, ['remote', 'add', 'origin', 'git@github.com:acme/price.git'])
  await initialise(homeRoot, { name: 'Price' })
  await gitInit(source); await git(source, ['remote', 'add', 'origin', 'git@github.com:acme/source.git'])
  const productFile = path.join(homeRoot, '.groundwork/products/price.json')
  const product = JSON.parse(await readFile(productFile, 'utf8'))
  product.repositories.push({ repository: 'acme/source', role: 'owned' }, { repository: 'acme/unregistered', role: 'owned' })
  await writeFile(productFile, JSON.stringify(product))
  const plan = await readPlan(homeRoot)
  await writePlan(homeRoot, { ...guard(plan), changes: {
    'components/source.json': JSON.stringify({ id: 'source', name: 'Source', productId: 'price', repo: 'acme/source' }),
    'components/other.json': JSON.stringify({ id: 'other', name: 'Other', productId: 'price', repo: 'acme/unregistered' }),
  } })
  const key = labelMappingKey({ workspace: 'Commercial', product: 'An unrelated old label' })
  await register(homeRoot, 'Commercial', 'An unrelated old label')
  await register(source, 'Commercial', 'An unrelated old label')
  await migrateHubRegistry({ [key]: { repository: 'acme/price', product: 'price' } }, true)
  const entries = await inventory()
  const sourceEntry = entries.find(item => item.root === source)!
  const homeEntry = entries.find(item => item.root === homeRoot)!
  assert.equal(sourceEntry.productPath, '/r/acme%2Fprice/price')
  assert.deepEqual(sourceEntry.productRefs, [{ repository: 'acme/price', product: 'price', slug: 'price', name: 'Price', workspaceNames: ['Commercial'],
    path: '/r/acme%2Fprice/price', componentIds: ['source'], componentKeys: ['acme/source#source'],
    declaredRepositories: ['acme/price', 'acme/source', 'acme/unregistered'], features: [] }])
  assert.deepEqual(homeEntry.productRefs[0].componentKeys.sort(), ['acme/source#source', 'acme/unregistered#other'])
  assert.equal(await selectRoot(sourceEntry.checkoutId), source)
  assert.equal(viewerProjectRoute(sourceEntry, entries, true), `/p/${homeEntry.checkoutId}/r/acme%2Fprice/price`)
})

test('folder registration previews bounded Git roots and adds only selected repositories', async t => {
  const base = await home(t, false)
  const folder = path.join(base, 'clones'), a = path.join(folder, 'a'), b = path.join(folder, 'b')
  await gitInit(a); await git(a, ['remote', 'add', 'origin', 'git@github.com:acme/a.git'])
  await gitInit(b); await git(b, ['remote', 'add', 'origin', 'git@github.com:acme/b.git'])
  const preview = await previewFolderRegistration(folder)
  assert.deepEqual(preview.repositories.map(item => item.repository), ['acme/a', 'acme/b'])
  await assert.rejects(registerFolder(folder, [path.join(folder, 'missing')]), /Select repositories/)
  await registerFolder(folder, [a])
  assert.deepEqual((await readHubRegistry(path.join(base, 'config')))?.checkouts, { 'acme/a': [a] })
})

test('v3 inventory prefers the clone with the most advanced default branch', async t => {
  const base = await home(t)
  const original = path.join(base, 'original'), clone = path.join(base, 'clone')
  await gitInit(original)
  await git(original, ['remote', 'add', 'origin', 'git@github.com:acme/app.git'])
  await initialise(original, { name: 'App' })
  await commitAll(original, 'Initial plan')
  await git(base, ['clone', '-q', original, clone])
  await git(clone, ['remote', 'set-url', 'origin', 'git@github.com:acme/app.git'])
  const clonePlan = await readPlan(clone)
  await writePlan(clone, { ...guard(clonePlan), changes: { 'products/app.json': JSON.stringify({ id: 'app', slug: 'new-app', name: 'New App', kind: 'service-system' }) } })
  await writeFile(path.join(clone, 'later.txt'), 'later\n')
  await commitAll(clone, 'Later change')
  await register(original, 'Work', 'App')
  await register(clone, 'Work', 'App')
  const key = labelMappingKey({ workspace: 'Work', product: 'App' })
  await migrateHubRegistry({ [key]: { repository: 'acme/app', product: 'app' } }, true)
  const entries = await inventory()
  assert.equal(entries.find(item => item.root === original)?.preferred, false)
  assert.equal(entries.find(item => item.root === clone)?.preferred, true)
  assert.equal(entries.find(item => item.root === original)?.productPath, '/r/acme%2Fapp/new-app')
})

test('fresh registration writes v3 and fresh unregister does not create a v2 file', async t => {
  const base = await home(t, false)
  const root = path.join(base, 'fresh')
  await initialise(root, { name: 'Fresh' })
  await register(root)
  assert.equal((await readHubRegistry(path.join(base, 'config')))?.version, 3)
  await assert.rejects(readFile(path.join(base, 'config/registry.json')), /ENOENT/)
  await rm(path.join(base, 'config/registry-v3.json'))
  await unregister(root)
  await assert.rejects(readFile(path.join(base, 'config/registry.json')), /ENOENT/)
  await writeFile(path.join(root, '.groundwork/plans/project.json'), '{broken')
  await assert.rejects(register(root), /project\.json/)
  assert.equal(await readHubRegistry(path.join(base, 'config')), null)
})

test('v3 home lists products without local ownership and used checkouts do not choose a startup product', async t => {
  const base = await home(t, false)
  const root = path.join(base, 'home'), owned = path.join(base, 'owned'), used = path.join(base, 'used')
  for (const [folder, remote] of [[root, 'home'], [owned, 'owned'], [used, 'used']]) {
    await gitInit(folder); await git(folder, ['remote', 'add', 'origin', `git@github.com:acme/${remote}.git`])
  }
  await mkdir(path.join(root, '.groundwork/products'), { recursive: true })
  await writeFile(path.join(root, '.groundwork/legacy-ids.json'), '{"version":1,"ids":{}}\n')
  await writeFile(path.join(root, '.groundwork/products/external.json'), JSON.stringify({
    schemaVersion: 3, id: 'external', slug: 'external', name: 'External', kind: 'service-system',
    repositories: [{ repository: 'acme/owned', role: 'owned' }, { repository: 'acme/used', role: 'used' }],
  }))
  assert.equal((await readPlan(root)).snapshot.products.length, 1)
  await mkdir(path.join(owned, '.groundwork'), { recursive: true })
  await writeFile(path.join(owned, '.groundwork/legacy-ids.json'), '{"version":1,"ids":{}}\n')
  assert.deepEqual((await readPlan(owned)).snapshot.products, [], 'a source catalog may have no products')
  await register(root); await register(owned); await register(used)
  await writeHubRegistry(path.join(base, 'config'), config => ({ ...config,
    workspaces: [{ name: 'Team', products: [{ repository: 'acme/home', product: 'external' }] }],
  }))
  const entries = await inventory()
  const homeEntry = entries.find(item => item.root === root)!
  const ownedEntry = entries.find(item => item.root === owned)!
  const usedEntry = entries.find(item => item.root === used)!
  assert.deepEqual(homeEntry.productRefs.map(ref => ref.product), ['external'])
  assert.deepEqual(homeEntry.productRefs[0].declaredRepositories, ['acme/owned', 'acme/used'])
  assert.equal(homeEntry.productPath, null)
  assert.equal(ownedEntry.productPath, '/r/acme%2Fhome/external')
  assert.equal(viewerProjectRoute(ownedEntry, entries, false), `/p/${homeEntry.checkoutId}/r/acme%2Fhome/external`)
  assert.deepEqual(usedEntry.productRefs.map(ref => ref.product), ['external'])
  assert.equal(usedEntry.productPath, null)
  assert.equal(usedEntry.error, null)
})

test('unregistered feature worktree plan does not become a Hub home for a source repository', async t => {
  const base = await home(t, false)
  const source = path.join(base, 'source'), feature = path.join(base, 'feature')
  await gitInit(source); await git(source, ['remote', 'add', 'origin', 'git@github.com:acme/source.git'])
  await commitAll(source, 'Empty source')
  await git(source, ['worktree', 'add', '-b', 'feature', feature])
  await initialise(feature, { name: 'Unpushed feature plan' })
  await register(source)
  const entries = await inventory()
  assert.deepEqual(entries.find(item => item.root === source)?.productRefs, [])
  assert.deepEqual(entries.find(item => item.root === feature)?.productRefs, [])
  assert.equal(entries.find(item => item.root === source)?.preferred, true)
  assert.equal(entries.find(item => item.root === feature)?.preferred, false)
})

test('v3 inventory exposes malformed home errors rather than treating them as source-only', async t => {
  const base = await home(t, false)
  const root = path.join(base, 'broken')
  await initialise(root, { name: 'Broken' })
  await register(root)
  await writeFile(path.join(root, '.groundwork/plans/project.json'), '{broken')
  assert.match((await inventory()).find(item => item.root === root)?.error ?? '', /project\.json/)
})
