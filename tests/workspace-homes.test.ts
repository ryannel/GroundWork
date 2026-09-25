import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { repositoryIdentity } from '../src/data/repository-identity.ts'
import { decodeStorage, encodeStorage, layoutFile, physicalDocumentPattern } from '../server/catalog-storage.ts'
import { repositoryKey } from '../server/catalog-freshness.ts'
import { InvalidInput } from '../server/errors.ts'
import { NotInitialised, parsePlan } from '../server/format.ts'
import { context, git, originUrl } from '../server/git.ts'
import { readPlan, readStorageFiles, writePlan } from '../server/repository.ts'
import { acquire } from '../server/scan-acquire.ts'
import { initialise } from '../server/setup.ts'
import { commitAll, gitInit, guard, homeFixture, tempDir } from './helpers.ts'

test('the legacy layout loads unchanged and reports its repository identity', async t => {
  const root = await homeFixture(t, 'legacy', 'git@github.com:Volvo-Cars/Legacy-Home.git')
  const plan = await readPlan(root)
  assert.equal(plan.layout, 'legacy')
  assert.deepEqual(plan.manifest, { schemaVersion: 2, id: 'legacy-home', name: 'Legacy Home' })
  assert.deepEqual(plan.snapshot.products.map(product => product.id), ['app'])
  assert.deepEqual(plan.snapshot.components.map(component => `${component.id}:${component.productId}`), ['service:app'])
  assert.equal(plan.repository.id, 'volvo-cars/legacy-home')
  assert.equal(plan.repository.provisional, false)
  // The identity sits beside the manifest ID; neither replaces the other yet.
  assert.equal(plan.context.repository.id, plan.repository.id)
  assert.notEqual(plan.repository.id, plan.manifest.id)
})

test('the split v1 layout loads unchanged and reports its repository identity', async t => {
  const root = await homeFixture(t, 'split-v1', 'https://github.com/volvo-cars/split-home.git')
  const plan = await readPlan(root)
  assert.equal(plan.layout, 'catalog-v1')
  assert.deepEqual(plan.manifest, { schemaVersion: 2, id: 'split-home', name: 'Split Home' })
  assert.deepEqual(plan.snapshot.components.map(component => component.id), ['service'])
  assert.equal(plan.snapshot.components[0].api?.endpoints.length, 1)
  assert.equal(plan.repository.id, 'volvo-cars/split-home')
})

test('a v3 home loads without a project manifest, deriving it from the repository', async t => {
  const root = await homeFixture(t, 'v3', 'git@github.com:volvo-cars/price-engine.git')
  const plan = await readPlan(root)
  assert.equal(plan.layout, 'catalog-v3')
  assert.equal(plan.repository.id, 'volvo-cars/price-engine')
  assert.deepEqual(plan.manifest, { schemaVersion: 2, id: 'volvo-cars__price-engine', name: 'price-engine' })
  assert.deepEqual(plan.snapshot.products.map(product => product.id).sort(), ['price-engine', 'product-configuration-facade'])
  // Membership comes from each product's owned repositories and paths, not from a productId on the component.
  assert.deepEqual(
    plan.snapshot.components.map(component => `${component.id}:${component.productId}`).sort(),
    ['postgres:price-engine', 'price-api--src-api:price-engine'],
  )
  assert.equal(Object.keys(plan.files).filter(file => file.startsWith('scan-manifests/')).length, 1)
  // The source catalog holds only this repository's own components; another repository's scan is a local catalog.
  assert.ok(!Object.keys(plan.files).some(file => file.includes('pretax')))
  const storage = await readStorageFiles(root)
  const localCatalog = Object.keys(storage).filter(file => file.startsWith('.groundwork/local-catalogs/github.com/volvo-cars/gpe-pretax/'))
  assert.equal(localCatalog.length, 3, 'the pretax component and its scan are accepted as a local catalog, not loaded as source content')
  assert.ok(storage['.groundwork/legacy-ids.json'])
})

test('a pre-migration branch merged after migration keeps both document forms readable', async t => {
  const root = await homeFixture(t, 'merged-branch', 'ssh://git@ghe.example.com:22/Volvo-Cars/Price.git')
  const plan = await readPlan(root)
  assert.equal(plan.layout, 'catalog-v3')
  assert.equal(plan.repository.id, 'ghe.example.com/Volvo-Cars/Price')
  assert.deepEqual(plan.manifest, { schemaVersion: 2, id: 'ghe_dexample_dcom__Volvo-Cars__Price', name: 'Price' })
  const membership = Object.fromEntries(plan.snapshot.components.map(component => [component.id, component.productId]))
  // The document written before the migration still carries productId; the one written after derives it.
  assert.deepEqual(membership, { 'gpe-price': 'legacy-product', 'price-api--src-api': 'price-engine' })
})

test('a merged pre-migration branch that restores .groundwork/plans still loads as a v3 home', async t => {
  const root = await homeFixture(t, 'merged-legacy-plans', 'git@github.com:volvo-cars/price-engine.git')
  const plan = await readPlan(root)
  // The legacy ID map marks a migrated home, so the legacy manifest the merge restored is superseded, not a
  // half-applied migration. Its sibling documents are read individually, as the format rules require.
  assert.equal(plan.layout, 'catalog-v3')
  assert.deepEqual(plan.manifest, { schemaVersion: 2, id: 'volvo-cars__price-engine', name: 'price-engine' })
  assert.deepEqual(plan.snapshot.products.map(product => product.id).sort(), ['legacy-product', 'price-engine'])
  assert.deepEqual(
    plan.snapshot.components.map(component => `${component.id}:${component.productId}`).sort(),
    ['gpe-legacy:legacy-product', 'price-api--src-api:price-engine'],
  )
})

test('a home holding only plan documents is v3, not an uninitialised legacy home', () => {
  const feature = '{"id":"one","productId":"app","title":"One","stage":"idea","touches":[],"ownerId":"owner","updatedAt":"2026-01-01T00:00:00Z"}\n'
  assert.equal(decodeStorage({ '.groundwork/plans/features/one/feature.json': feature }).layout, 'catalog-v3')
  // A merged legacy document that collides with the migrated one is reported rather than silently preferred.
  assert.throws(() => decodeStorage({
    '.groundwork/legacy-ids.json': '{"version":1,"ids":{}}\n',
    '.groundwork/products/app.json': '{"id":"app"}\n',
    '.groundwork/plans/products/app.json': '{"id":"app"}\n',
  }), /Merged pre-migration document conflicts/)
})

test('layout detection separates the three forms and still refuses an interrupted migration', () => {
  const project = '{"schemaVersion":2,"id":"home","name":"Home"}\n'
  const component = '{"id":"service","name":"Service"}\n'
  assert.equal(decodeStorage({ '.groundwork/plans/project.json': project }).layout, 'legacy')
  assert.equal(decodeStorage({}).layout, 'legacy')
  assert.equal(decodeStorage({ '.groundwork/project.json': project, [layoutFile]: '{"version":1}\n' }).layout, 'catalog-v1')
  assert.equal(decodeStorage({ '.groundwork/products/app.json': '{"id":"app"}\n' }).layout, 'catalog-v3')
  assert.equal(decodeStorage({ '.groundwork/catalog/components/service/component.json': component }).layout, 'catalog-v3')
  // project.json without the marker, or catalog files beside a legacy manifest in a home that was never
  // migrated, are half-applied migrations.
  assert.throws(() => decodeStorage({ '.groundwork/project.json': project }), InvalidInput)
  assert.throws(
    () => decodeStorage({ '.groundwork/plans/project.json': project, '.groundwork/catalog/components/service/component.json': component }),
    /repair or recover the migration/,
  )
  assert.throws(() => decodeStorage({ '.groundwork/legacy-ids.json': '{}\n', '.groundwork/catalog/layout.json': '{"version":2}\n' }), InvalidInput)
})

test('a v3 home with no origin still loads, under a provisional identity', async t => {
  const root = await homeFixture(t, 'v3')
  const plan = await readPlan(root)
  assert.equal(plan.repository.provisional, true)
  assert.equal(plan.repository.id, `local:${path.basename(root).toLowerCase()}`)
  assert.match(plan.repository.warning!, /no origin remote/)
  assert.equal(plan.manifest.name, path.basename(root).toLowerCase())
  assert.ok(plan.manifest.id.startsWith('local_c'))
  assert.equal(plan.snapshot.components.length, 2)
})

test('the single-product fallback never claims a component of a repository the product only uses', () => {
  const product = JSON.stringify({
    schemaVersion: 3, id: 'price', slug: 'price', name: 'Price', kind: 'service-system',
    repositories: [{ repository: 'volvo-cars/gpe-pretax', role: 'owned', paths: ['src/api'] }, { repository: 'volvo-cars/utils', role: 'used' }],
  })
  const files = (component: Record<string, unknown>) => ({
    'products/price.json': product,
    'components/thing.json': JSON.stringify({ id: 'thing', name: 'Thing', kind: 'service', ...component }),
  })
  const source = { layout: 'catalog-v3' as const, repository: { id: 'volvo-cars/price-engine', origin: null, provisional: false } }
  const productOf = (component: Record<string, unknown>) => parsePlan(files(component), source).snapshot.components[0].productId
  // The home's own repository, a declared component with no repository, and an owned repository outside the
  // declared paths all belong to the home's only product.
  assert.equal(productOf({ repo: 'volvo-cars/price-engine', sourcePath: 'src' }), 'price')
  assert.equal(productOf({}), 'price')
  assert.equal(productOf({ repo: 'volvo-cars/gpe-pretax', sourcePath: 'src/api' }), 'price')
  assert.equal(productOf({ repo: 'volvo-cars/gpe-pretax', sourcePath: 'libs/other' }), 'price')
  // A used repository's components come from that repository's catalog; attributing them here would be a guess.
  assert.throws(() => productOf({ repo: 'volvo-cars/utils', sourcePath: 'src' }), /productId/)
  assert.throws(() => productOf({ repo: 'volvo-cars/unrelated', sourcePath: 'src' }), /productId/)
})

test('an empty checkout is still uninitialised rather than a v3 home', async t => {
  const root = await gitInit(await tempDir(t, 'groundwork-empty-'))
  await assert.rejects(readPlan(root), error => error instanceof NotInitialised)
})

test('identity comes from the configured origin only', async t => {
  const root = await gitInit(await tempDir(t, 'groundwork-origin-'))
  for (const form of ['git@ghe.example.com:acme/api.git', 'ssh://git@ghe.example.com/acme/api', 'https://ghe.example.com/acme/api.git']) {
    await git(root, ['remote', 'remove', 'origin']).catch(() => null)
    await git(root, ['remote', 'add', 'origin', form])
    assert.equal((await context(root)).repository.id, 'ghe.example.com/acme/api', form)
  }
  // An upstream remote belongs to this clone alone, so it never takes part in a shared identity.
  await git(root, ['remote', 'add', 'upstream', 'git@github.com:acme/upstream.git'])
  assert.equal((await context(root)).repository.id, 'ghe.example.com/acme/api')
  // Neither does a url.*.insteadOf rewrite: git config reports the configured URL, git remote get-url would not.
  await git(root, ['config', '--local', 'url.git@github.com:.insteadOf', 'https://ghe.example.com/'])
  assert.equal(await git(root, ['remote', 'get-url', 'origin']), 'git@github.com:acme/api.git')
  assert.equal((await context(root)).repository.id, 'ghe.example.com/acme/api')
  await git(root, ['remote', 'remove', 'origin'])
  const without = (await context(root)).repository
  assert.equal(without.provisional, true)
  assert.equal(without.id, `local:${path.basename(root).toLowerCase()}`)
})

test('a multi-url origin is identified by the url git fetches from', async t => {
  const root = await gitInit(await tempDir(t, 'groundwork-multi-'))
  await git(root, ['remote', 'add', 'origin', 'git@ghe.example.com:acme/api.git'])
  await git(root, ['remote', 'set-url', '--add', 'origin', 'git@mirror.example.com:acme/api.git'])
  // `git config --get` would report the mirror, which is only a push target; the fetch url is the first value.
  assert.equal(await originUrl(root), 'git@ghe.example.com:acme/api.git')
  assert.equal((await context(root)).repository.id, 'ghe.example.com/acme/api')
})

test('acquiring a clone without an origin yields the same provisional identity a checkout would', async t => {
  const source = await gitInit(await tempDir(t, 'groundwork-source-'))
  await writeFile(path.join(source, 'README.md'), '# Source\n')
  await commitAll(source)
  const target = path.join(await tempDir(t, 'groundwork-target-'), 'clone')
  const acquired = await acquire(source, undefined, target)
  assert.equal(acquired.repository, (await context(source)).repository.id)
  assert.equal(acquired.repository, `local:${path.basename(source).toLowerCase()}`)
  // A provisional identity is already normalised, so reading it again must not turn `local:` into a host.
  assert.equal(repositoryIdentity(acquired.repository), acquired.repository)
  // Catalog comparisons resolve a checkout path the same way, so a stored path still matches the acquired identity.
  assert.equal(await repositoryKey(source), acquired.repository)
  assert.equal(await repositoryKey(acquired.repository), acquired.repository)
})

test('local catalog paths accept a host with a port and never a traversal', () => {
  const document = 'components/api--src/component.json'
  assert.ok(physicalDocumentPattern.test(`.groundwork/local-catalogs/ghe.example.com:2222/acme/api/${document}`))
  assert.ok(physicalDocumentPattern.test(`.groundwork/local-catalogs/github.com/volvo-cars/gpe-pretax/${document}`))
  assert.ok(physicalDocumentPattern.test('.groundwork/local-catalogs/ghe.example.com:2222/acme/api/scans/' + 'a'.repeat(64) + '.json'))
  // Normalisation spells an IPv6 host in brackets, so the allowlist has to accept the directory name it produces.
  assert.equal(repositoryIdentity('ssh://git@[2001:db8::1]:2222/acme/api.git'), '[2001:db8::1]:2222/acme/api')
  for (const host of ['[2001:db8::1]', '[2001:db8::1]:2222', '[::1]', '[::ffff:192.0.2.1]']) {
    assert.ok(physicalDocumentPattern.test(`.groundwork/local-catalogs/${host}/acme/api/${document}`), host)
  }
  for (const bad of [
    `.groundwork/local-catalogs/../acme/api/${document}`, `.groundwork/local-catalogs/github.com/../api/${document}`,
    `.groundwork/local-catalogs/github.com/acme/../${document}`, `.groundwork/local-catalogs/ghe.example.com:port/acme/api/${document}`,
    `.groundwork/local-catalogs/github.com/${document}`, `.groundwork/local-catalogs/[2001:db8::1]/../api/${document}`,
    `.groundwork/local-catalogs/[2001:db8::1]:port/acme/api/${document}`, `.groundwork/local-catalogs/[2001:db8::1]/acme/../${document}`,
    `.groundwork/local-catalogs/[../x]/acme/api/${document}`, `.groundwork/local-catalogs/[..]/acme/api/${document}`,
  ]) assert.equal(physicalDocumentPattern.test(bad), false, bad)
})

test('writes into an unmigrated home are refused the migrated document forms', async t => {
  const migrated = (raw: string) => JSON.stringify({
    ...JSON.parse(raw), schemaVersion: 3, domain: 'https://backstage.example.com/catalog/default/system/app',
    repositories: [{ repository: 'volvo-cars/legacy-home', role: 'owned' }],
  })
  for (const fixture of ['legacy', 'split-v1'] as const) {
    const root = await homeFixture(t, fixture, 'git@github.com:volvo-cars/home.git')
    const before = await readPlan(root)
    await assert.rejects(
      writePlan(root, { ...guard(before), changes: { 'products/app.json': migrated(before.files['products/app.json']) } }),
      /writes only the legacy forms/,
    )
    const withVersion = JSON.stringify({ ...JSON.parse(before.files['components/service.json']), schemaVersion: 3 })
    await assert.rejects(
      writePlan(root, { ...guard(before), changes: { 'components/service.json': withVersion } }),
      /cannot declare schemaVersion/,
    )
    const { productId: _productId, ...withoutProduct } = JSON.parse(before.files['components/service.json'])
    await assert.rejects(
      writePlan(root, { ...guard(before), changes: { 'components/service.json': JSON.stringify(withoutProduct) } }),
      /must name its productId/,
    )
    // Nothing reached disk: no product or component document gained a migrated-only field.
    const storage = await readStorageFiles(root)
    for (const [name, raw] of Object.entries(storage)) {
      if (!/products\/|components\//.test(name)) continue
      const value = JSON.parse(raw)
      for (const field of ['schemaVersion', 'repositories', 'domain']) assert.equal(field in value, false, `${fixture}: ${name}.${field}`)
    }
    assert.deepEqual((await readPlan(root)).files, before.files)
  }
})

test('an unmigrated home still reads a migrated document a merged branch brought in, and can be written to', async t => {
  const root = await homeFixture(t, 'legacy', 'git@github.com:volvo-cars/legacy-home.git')
  const file = path.join(root, '.groundwork/plans/products/app.json')
  await writeFile(file, JSON.stringify({
    schemaVersion: 3, id: 'app', slug: 'app', name: 'Legacy Home', kind: 'service-system',
    domain: 'https://backstage.example.com/catalog/default/system/app',
    repositories: [{ repository: 'volvo-cars/legacy-home', role: 'owned' }],
  }, null, 2) + '\n')
  const plan = await readPlan(root)
  assert.equal(plan.layout, 'legacy')
  assert.deepEqual(plan.snapshot.products.map(product => product.id), ['app'])
  // Writing another document leaves the merged one exactly as it is rather than rewriting or refusing it.
  await writePlan(root, { ...guard(plan), changes: { 'members/owner.json': JSON.stringify({ id: 'owner', name: 'Next' }) } })
  assert.equal(JSON.parse(await readFile(file, 'utf8')).schemaVersion, 3)
  assert.equal((await readPlan(root)).snapshot.members[0].name, 'Next')
})

test('writes still produce the legacy forms in every layout that can be written', async t => {
  const renamed = (raw: string) => JSON.stringify({ ...JSON.parse(raw), name: 'Renamed service' })
  const legacy = await homeFixture(t, 'legacy', 'git@github.com:volvo-cars/legacy-home.git')
  const before = await readPlan(legacy)
  await writePlan(legacy, { ...guard(before), changes: { 'components/service.json': renamed(before.files['components/service.json']) } })
  const legacyStorage = await readStorageFiles(legacy)
  assert.deepEqual(Object.keys(legacyStorage).sort(), [
    '.groundwork/plans/components/service.json', '.groundwork/plans/members/owner.json',
    '.groundwork/plans/products/app.json', '.groundwork/plans/project.json',
  ])
  assert.equal(JSON.parse(legacyStorage['.groundwork/plans/components/service.json']).name, 'Renamed service')
  assert.equal((await readPlan(legacy)).layout, 'legacy')

  const split = await homeFixture(t, 'split-v1', 'git@github.com:volvo-cars/split-home.git')
  const splitBefore = await readPlan(split)
  await writePlan(split, { ...guard(splitBefore), changes: { 'components/service.json': renamed(splitBefore.files['components/service.json']) } })
  const splitStorage = await readStorageFiles(split)
  assert.equal(JSON.parse(splitStorage['.groundwork/catalog/components/service/component.json']).name, 'Renamed service')
  assert.equal(splitStorage[layoutFile], '{"version":1}\n')
  assert.ok(splitStorage['.groundwork/project.json'], 'project.json is never removed before the migration')
  assert.equal(Object.keys(splitStorage).filter(file => file.startsWith('.groundwork/products/')).length, 0)
  assert.equal((await readPlan(split)).layout, 'catalog-v1')

  // Nothing writes the v3 layout yet, so a v3 home is read-only in this release.
  const migrated = await homeFixture(t, 'v3', 'git@github.com:volvo-cars/price-engine.git')
  const plan = await readPlan(migrated)
  await assert.rejects(
    writePlan(migrated, { ...guard(plan), changes: { 'members/owner.json': '{"id":"owner","name":"Owner"}' } }),
    /does not write it/,
  )
  assert.equal(JSON.parse(await readFile(path.join(migrated, '.groundwork/members/owner.json'), 'utf8')).name, 'Project owner')
  assert.throws(() => encodeStorage({}, 'catalog-v3'), InvalidInput)
})

test('initialisation refuses the migrated document forms, exactly as a write does', async t => {
  const root = await tempDir(t, 'groundwork-init-')
  const product = { id: 'app', slug: 'app', name: 'App', kind: 'service-system' }
  const files = (overrides: { product?: object; component?: object }) => ({
    'project.json': JSON.stringify({ schemaVersion: 2, id: 'app', name: 'App' }),
    'products/app.json': JSON.stringify({ ...product, ...overrides.product }),
    'components/service.json': JSON.stringify({ id: 'service', productId: 'app', name: 'Service', kind: 'service', ...overrides.component }),
    'members/owner.json': JSON.stringify({ id: 'owner', name: 'Owner' }),
  })
  // init writes into .groundwork/plans/, so a v3-form document would land in a home no older release can read.
  await assert.rejects(initialise(root, { files: files({ product: { schemaVersion: 3, repositories: [{ repository: 'acme/api', role: 'owned' }] } }) }),
    /writes only the legacy forms/)
  await assert.rejects(initialise(root, { files: files({ product: { domain: 'https://backstage.example.com/catalog/default/system/app' } }) }),
    /writes only the legacy forms/)
  await assert.rejects(initialise(root, { files: files({ component: { schemaVersion: 3 } }) }), /cannot declare schemaVersion/)
  const { productId: _productId, ...unowned } = JSON.parse(files({}) ['components/service.json'])
  await assert.rejects(initialise(root, { files: { ...files({}), 'components/service.json': JSON.stringify(unowned) } }), /must name its productId/)
  // Nothing was staged: no plan directory exists, and the legacy forms still initialise the folder.
  assert.equal(await readdir(path.join(root, '.groundwork/plans')).catch(() => null), null)
  await initialise(root, { files: files({}) })
  const plan = await readPlan(root)
  assert.equal(plan.layout, 'legacy')
  assert.deepEqual(plan.snapshot.components.map(component => `${component.id}:${component.productId}`), ['service:app'])
})

test('a component no product owns is reported by name rather than as a missing field', async t => {
  const root = await homeFixture(t, 'v3', 'git@github.com:volvo-cars/price-engine.git')
  const orphan = { id: 'orphan', name: 'Orphan', kind: 'service', repo: 'volvo-cars/unrelated', sourcePath: 'src/api' }
  await mkdir(path.join(root, '.groundwork/catalog/components/orphan'), { recursive: true })
  await writeFile(path.join(root, '.groundwork/catalog/components/orphan/component.json'), JSON.stringify(orphan, null, 2) + '\n')
  // Phase 3 gives a catalog without an owning product its own model; until then the reader has to say what is wrong.
  await assert.rejects(readPlan(root), error => {
    assert.ok(error instanceof InvalidInput)
    assert.match(error.message, /components\/orphan\.json: no product in this home owns volvo-cars\/unrelated path "src\/api"/)
    assert.match(error.message, /productId cannot be derived/)
    assert.match(error.message, /price-engine, product-configuration-facade/)
    return true
  })
})

test('a plans-only home with no project manifest loads as v3, and says so when a document is missing', async t => {
  const feature = (productId: string) => JSON.stringify({
    id: 'one', productId, title: 'One', stage: 'idea', touches: [], ownerId: 'owner', updatedAt: '2026-01-01T00:00:00Z',
  })
  const root = await tempDir(t, 'groundwork-plans-only-')
  await mkdir(path.join(root, '.groundwork/plans/features/one'), { recursive: true })
  await mkdir(path.join(root, '.groundwork/plans/products'), { recursive: true })
  await mkdir(path.join(root, '.groundwork/plans/members'), { recursive: true })
  await writeFile(path.join(root, '.groundwork/plans/features/one/feature.json'), feature('app'))
  await gitInit(root)
  await git(root, ['remote', 'add', 'origin', 'git@github.com:volvo-cars/plans-only.git'])
  // Without the documents it refers to, the failure names them and says the home is being read as v3.
  await assert.rejects(readPlan(root), error => {
    assert.match((error as Error).message, /no \.groundwork\/project\.json, so Groundwork reads it as the migrated \(v3\) layout/)
    assert.match((error as Error).message, /missing members\/owner\.json, products\/app\.json/)
    return true
  })
  // With them, a home that holds nothing but plan documents is a valid v3 home.
  await writeFile(path.join(root, '.groundwork/plans/products/app.json'), '{"id":"app","slug":"app","name":"App","kind":"service-system"}\n')
  await writeFile(path.join(root, '.groundwork/plans/members/owner.json'), '{"id":"owner","name":"Owner"}\n')
  const plan = await readPlan(root)
  assert.equal(plan.layout, 'catalog-v3')
  assert.deepEqual(plan.manifest, { schemaVersion: 2, id: 'volvo-cars__plans-only', name: 'plans-only' })
  assert.deepEqual(plan.snapshot.features.map(item => item.id), ['one'])
})
