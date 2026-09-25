import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import {
  catalogId, catalogIdForms, emptyLegacyIdMap, legacyIdMapDocument, parseCatalogId, parseLegacyIdMap,
  recordLegacyScope, translateCatalogId, legacyIdProjection, legacyIdMapFromProjection, CatalogIdError,
} from '../src/data/catalog-identity.ts'
import { identitySlug } from '../src/data/repository-identity.ts'
import { catalogIndex, catalogLookup } from '../src/data/catalog-index.ts'
import { componentRepositories, referenceLabel, resolveComponentReference } from '../src/data/component-reference.ts'
import { documentVersion, documentVersions, isMigratedDocument, isSupportedVersion } from '../src/data/document-versions.ts'
import { adaptScanManifest, parseScanManifest, recordScanManifestScopes } from '../src/data/scan-manifest.ts'
import { baselineAssessments, entityObservation, knowledgeBaselineSchema } from '../src/data/knowledge.ts'
import { componentReadSchema, componentSchema } from '../src/data/content-schema.ts'
import type { Component } from '../src/data/model.ts'
import { assertLegacyWriteForm, parsePlan } from '../server/format.ts'
import { derivedComponentId, detectProjects, matchComponent, matchComponents, type InventoryFile } from '../server/scan-projects.ts'
import { initialise } from '../server/setup.ts'
import { discardRepositoryScan, prepareRepositoryScan } from '../server/scanner.ts'
// Not a registered operation: the entry point stays internal until v3 writes are enabled.
import { componentIdentityChange, reconcileComponentIdentity } from '../server/scan-lifecycle.ts'
import { SCANNER_VERSION, type ScanMetadata } from '../server/scan-workspace.ts'
import { applyRepositoryScan } from '../server/scan-baseline.ts'
import { readPlan, writePlan } from '../server/repository.ts'
import { readScanManifest } from '../server/scan-manifests.ts'
import { digest } from '../server/git.ts'
import { operationSchemas, operate } from '../server/operations.ts'
import { git } from '../server/git.ts'
import { gitInit, guard, homeFixture, repoRoot, tempDir, writeFiles } from './helpers.ts'

const component = (overrides: Record<string, unknown> = {}): Component => ({
  id: 'gpe-price', productId: 'app', order: 0, name: 'Price', repo: 'volvo-cars/price-engine',
  api: { name: 'Price', endpoints: [{ id: 'get-price', name: 'Get price', method: 'GET', path: '/price' }] },
  ...overrides,
} as unknown as Component)

test('a catalog ID parses in both forms and reports an unusable one', () => {
  const legacy = catalogId('price-engine', 'gpe-price', 'endpoint', 'get-price')
  const migrated = catalogId('volvo-cars/price-engine', 'gpe-price', 'endpoint', 'get-price')
  assert.equal(migrated, 'volvo-cars%2Fprice-engine/gpe-price/endpoint/get-price')
  assert.deepEqual(parseCatalogId(legacy), { scope: 'price-engine', component: 'gpe-price', kind: 'endpoint', entity: 'get-price' })
  assert.deepEqual(parseCatalogId(migrated), { scope: 'volvo-cars/price-engine', component: 'gpe-price', kind: 'endpoint', entity: 'get-price' })
  assert.throws(() => parseCatalogId('price-engine/gpe-price/endpoint'), CatalogIdError)
  assert.throws(() => parseCatalogId('price-engine/gpe-price/nope/get-price'), CatalogIdError)
  // An ID with an empty segment cannot be parsed back, so it is never built in the first place.
  assert.throws(() => catalogId('a', 'b', 'flow', ''), CatalogIdError)
  assert.throws(() => catalogId('', 'b', 'flow', 'c'), CatalogIdError)
  assert.throws(() => catalogId('a', '', 'flow', 'c'), CatalogIdError)
  assert.throws(() => catalogId('a', 'b', 'nope' as 'flow', 'c'), CatalogIdError)
})

test('the legacy ID map translates what it can place and leaves the rest unchanged', () => {
  const map = emptyLegacyIdMap()
  recordLegacyScope(map, 'price-engine', 'gpe-price', 'volvo-cars/price-engine')
  recordLegacyScope(map, 'price-engine', 'gpe-price', 'volvo-cars/price-engine.git')
  const known = catalogId('price-engine', 'gpe-price', 'endpoint', 'get-price')
  const unknown = catalogId('price-engine', 'gpe-unknown', 'endpoint', 'get-price')
  assert.equal(translateCatalogId(known, map), catalogId('volvo-cars/price-engine', 'gpe-price', 'endpoint', 'get-price'))
  assert.equal(translateCatalogId(unknown, map), null, 'an ID the map cannot place is never guessed')
  assert.deepEqual(catalogIdForms(unknown, map), [unknown])
  assert.deepEqual(catalogIdForms(known, map), [known, catalogId('volvo-cars/price-engine', 'gpe-price', 'endpoint', 'get-price')])
  assert.deepEqual([...map.conflicts], [], 'two spellings of one repository are not a conflict')
})

test('conflicting evidence drops the derived rule instead of keeping whichever came first', () => {
  const forward = emptyLegacyIdMap()
  recordLegacyScope(forward, 'price-engine', 'gpe-price', 'volvo-cars/price-engine')
  recordLegacyScope(forward, 'price-engine', 'gpe-price', 'someone-else/other')
  const reverse = emptyLegacyIdMap()
  recordLegacyScope(reverse, 'price-engine', 'gpe-price', 'someone-else/other')
  recordLegacyScope(reverse, 'price-engine', 'gpe-price', 'volvo-cars/price-engine')
  const id = catalogId('price-engine', 'gpe-price', 'endpoint', 'get-price')
  for (const map of [forward, reverse]) {
    assert.equal(translateCatalogId(id, map), null, 'a component two repositories claim is never placed by guess')
    assert.deepEqual(catalogIdForms(id, map), [id])
    assert.deepEqual([...map.conflicts], ['price-engine/gpe-price'], 'the conflict is reported for migration')
  }
  // An explicit whole-ID translation still answers, because it is evidence rather than a derived rule.
  const explicit = parseLegacyIdMap(JSON.stringify({ version: 1, ids: { [id]: catalogId('volvo-cars/price-engine', 'gpe-price', 'endpoint', 'get-price') } }))
  recordLegacyScope(explicit, 'price-engine', 'gpe-price', 'someone-else/other')
  assert.equal(translateCatalogId(id, explicit), catalogId('volvo-cars/price-engine', 'gpe-price', 'endpoint', 'get-price'))
  assert.equal(translateCatalogId(catalogId('price-engine', 'gpe-price', 'flow', 'quote'), explicit), null, 'siblings of a contested component are not guessed')
})

test('a stored legacy-ids.json is read as explicit translations and the component rules behind them', () => {
  const legacy = catalogId('price-engine', 'gpe-price', 'endpoint', 'get-price')
  const migrated = catalogId('volvo-cars/price-engine', 'gpe-price', 'endpoint', 'get-price')
  const map = parseLegacyIdMap(JSON.stringify({ version: 1, ids: { [legacy]: migrated, 'not-an-id': 'still-translated' } }))
  assert.equal(translateCatalogId(legacy, map), migrated)
  assert.equal(translateCatalogId('not-an-id', map), 'still-translated')
  // The rule the explicit entry implies also places sibling IDs of the same component.
  assert.equal(
    translateCatalogId(catalogId('price-engine', 'gpe-price', 'flow', 'quote'), map),
    catalogId('volvo-cars/price-engine', 'gpe-price', 'flow', 'quote'),
  )
  assert.deepEqual(legacyIdMapDocument(map).ids[legacy], migrated)
})

test('catalog entries answer to the legacy ID and to the migrated one', () => {
  const entries = catalogIndex({
    manifest: { id: 'catalog' }, repository: { id: 'volvo-cars/price-engine' }, snapshot: { components: [component()] },
  })
  const endpoint = entries.find(entry => entry.kind === 'endpoint')!
  assert.equal(endpoint.id, catalogId('catalog', 'gpe-price', 'endpoint', 'get-price'), 'the legacy form stays canonical')
  assert.deepEqual(endpoint.aliases, [catalogId('volvo-cars/price-engine', 'gpe-price', 'endpoint', 'get-price')])
  const lookup = catalogLookup(entries)
  assert.equal(lookup.get(endpoint.id), endpoint)
  assert.equal(lookup.get(endpoint.aliases[0]), endpoint)
})

test('a migrated home makes the repository form canonical and answers to every legacy key that names it', () => {
  // The brief's case: a home migrated after its project was renamed, with the old IDs recorded on disk.
  const legacyIds = parseLegacyIdMap(JSON.stringify({ version: 1, ids: { 'old-project/api/component/api': 'acme%2Frepo/api/component/api' } }))
  const plan = {
    manifest: { id: 'acme__repo' }, repository: { id: 'acme/repo' }, layout: 'catalog-v3' as const, legacyIds,
  }
  const components = [component({ id: 'api', repo: 'acme/repo', api: undefined })]
  const entries = catalogIndex({ ...plan, snapshot: { components } })
  const entry = entries[0]
  assert.equal(entry.id, 'acme%2Frepo/api/component/api', 'a migrated home qualifies its entries by repository')
  assert.ok(entry.aliases.includes('old-project/api/component/api'), 'every legacy key that names the entry answers to it')
  const lookup = catalogLookup(entries)
  assert.equal(lookup.get('old-project/api/component/api'), entry)
  assert.equal(lookup.get('acme__repo/api/component/api'), entry, 'the synthetic project scope still answers too')
  // A baseline captured before the rename compares against the same entry rather than reporting it removed.
  const baseline = knowledgeBaselineSchema.parse({
    version: 1, featureId: 'f', question: 'q', catalogRevision: 'a'.repeat(64), context: 'b'.repeat(64),
    capturedAt: '2026-01-01T00:00:00Z', assumptions: [],
    observations: [{ ...entityObservation(entry), id: 'old-project/api/component/api' }],
  })
  assert.deepEqual(baselineAssessments(baseline, components, plan).map(item => item.catalogState), ['unchanged'])
})

test('a component in another repository is qualified by that repository, not by the home', () => {
  const entries = catalogIndex({
    manifest: { id: 'catalog' },
    repository: { id: 'volvo-cars/price-engine' },
    snapshot: { components: [component({ id: 'gpe-pretax', repo: 'volvo-cars/gpe-pretax', api: undefined })] },
  })
  assert.deepEqual(entries[0].aliases, [catalogId('volvo-cars/gpe-pretax', 'gpe-pretax', 'component', 'gpe-pretax')])
})

test('a dependency is resolved against the catalog and an unresolved one is kept as written', () => {
  const components = [
    component({ dependsOn: ['gpe-pretax', { repository: 'volvo-cars/gpe-tax', component: 'gpe-tax' }, 'nowhere'] }),
    component({ id: 'gpe-pretax', repo: 'volvo-cars/gpe-pretax', api: undefined }),
    component({ id: 'gpe-tax', repo: 'volvo-cars/gpe-tax', api: undefined }),
  ]
  const entries = catalogIndex({ manifest: { id: 'catalog' }, repository: { id: 'volvo-cars/price-engine' }, snapshot: { components } })
  const owner = entries.find(entry => entry.id === catalogId('catalog', 'gpe-price', 'component', 'gpe-price'))!
  const dependencies = owner.related.filter(relation => relation.kind === 'dependency')
  assert.deepEqual(dependencies.map(relation => [relation.id, relation.unresolved ?? false]), [
    [catalogId('catalog', 'gpe-pretax', 'component', 'gpe-pretax'), false],
    [catalogId('catalog', 'gpe-tax', 'component', 'gpe-tax'), false],
    [catalogId('catalog', 'nowhere', 'component', 'nowhere'), true],
  ], 'a resolved reference points at the catalogued component; an unresolved one keeps the home scope and is marked')
  assert.match(dependencies[2].reason, /Unresolved component dependency/)
})

test('a reference resolves by name or by repository, and an unresolved one keeps its label', () => {
  const components = [component({ id: 'gpe-price' }), component({ id: 'gpe-pretax', repo: 'volvo-cars/gpe-pretax' })]
  const repositories = componentRepositories(components, 'volvo-cars/price-engine')
  assert.equal(repositories.get('gpe-price'), 'volvo-cars/price-engine')
  assert.deepEqual(resolveComponentReference('gpe-pretax', repositories), {
    component: 'gpe-pretax', repository: 'volvo-cars/gpe-pretax', resolved: true, label: 'gpe-pretax',
  })
  const qualified = { repository: 'volvo-cars/gpe-pretax', component: 'gpe-pretax' }
  assert.equal(resolveComponentReference(qualified, repositories).resolved, true)
  assert.equal(resolveComponentReference({ repository: 'other/repo', component: 'gpe-pretax' }, repositories).resolved, false)
  assert.equal(referenceLabel('gpe-price'), 'gpe-price')
  assert.equal(referenceLabel(qualified), 'volvo-cars/gpe-pretax#gpe-pretax')
})

test('read schemas accept the migrated document forms the write schemas refuse', () => {
  const migrated = { ...component(), schemaVersion: 3, dependsOn: [{ repository: 'volvo-cars/gpe-pretax', component: 'gpe-pretax' }] }
  assert.equal(componentReadSchema.safeParse(migrated).success, true)
  assert.equal(componentSchema.safeParse(migrated).success, false)
  assert.equal(componentSchema.safeParse({ ...component(), dependsOn: ['gpe-pretax'] }).success, true)
  assert.equal(documentVersion('component', {}), documentVersions.component.legacy)
  assert.equal(documentVersion('component', migrated), 3)
  assert.equal(isSupportedVersion('component', 2), false)
  assert.equal(isMigratedDocument('component', migrated), true)
  assert.equal(isMigratedDocument('component', component()), false)
})

test('an unmigrated home still refuses to write a qualified reference', () => {
  const file = 'components/gpe-price.json'
  const qualified = JSON.stringify({ ...component(), dependsOn: [{ repository: 'volvo-cars/gpe-pretax', component: 'gpe-pretax' }] })
  assert.throws(() => assertLegacyWriteForm(file, qualified), /cannot name the repository of a dependency yet/)
  const step = JSON.stringify({
    ...component(),
    executionFlows: [{ id: 'f', steps: [{ id: 'a', dependencyIds: [{ repository: 'r/r', component: 'c' }] }] }],
  })
  assert.throws(() => assertLegacyWriteForm(file, step), /flow step cannot name the repository of a dependency yet/)
  assert.doesNotThrow(() => assertLegacyWriteForm(file, JSON.stringify({ ...component(), dependsOn: ['gpe-pretax'] })))
})

test('a scan manifest is read at its own version and adapted without touching its bytes', () => {
  const legacy = catalogId('catalog', 'gpe-price', 'flow', 'quote')
  const raw = JSON.stringify({
    version: 1, scannerVersion: 3, scanId: '00000000-0000-4000-8000-000000000000', repository: 'volvo-cars/price-engine',
    sourceRevision: 'a'.repeat(40), requestedRef: null, preparedAt: '2026-01-01T00:00:00Z', appliedAt: '2026-01-01T00:00:00Z',
    catalogRevisionBefore: 'r', mode: 'baseline',
    scope: [{ componentId: 'gpe-price', sourcePath: '.', areas: [], observationIds: [legacy] }],
    exclusions: {}, budgets: {}, files: [], dependencyFingerprints: [], omittedDependencyFingerprints: 0,
    mappings: [{ entityId: legacy, path: 'src/a.ts', revision: 'a'.repeat(40) }],
    note: 'n',
  })
  const manifest = parseScanManifest(raw)
  const map = emptyLegacyIdMap()
  recordScanManifestScopes(map, manifest, 'catalog')
  const adapted = adaptScanManifest(manifest, map)
  const migrated = catalogId('volvo-cars/price-engine', 'gpe-price', 'flow', 'quote')
  assert.deepEqual(adapted.scope[0].observationIds, [migrated])
  assert.equal(adapted.mappings[0].entityId, migrated)
  assert.equal(JSON.stringify(manifest.scope[0].observationIds), JSON.stringify([legacy]), 'the parsed record is not mutated')
  assert.throws(() => parseScanManifest(JSON.stringify({ ...JSON.parse(raw), version: 99 })), /Unsupported scan manifest version/)
})

test('a baseline retained under a legacy ID still compares unchanged, in either form', () => {
  const plan = { manifest: { id: 'catalog' }, repository: { id: 'volvo-cars/price-engine' } }
  const entries = catalogIndex({ ...plan, snapshot: { components: [component()] } })
  const endpoint = entries.find(entry => entry.kind === 'endpoint')!
  const baseline = (id: string) => knowledgeBaselineSchema.parse({
    version: 1, featureId: 'f', question: 'q', catalogRevision: 'a'.repeat(64), context: 'b'.repeat(64),
    capturedAt: '2026-01-01T00:00:00Z', assumptions: [], observations: [{ ...entityObservation(endpoint), id }],
  })
  assert.deepEqual(baselineAssessments(baseline(endpoint.id), [component()], plan).map(item => item.catalogState), ['unchanged'])
  assert.deepEqual(baselineAssessments(baseline(endpoint.aliases[0]), [component()], plan).map(item => item.catalogState), ['unchanged'])
  assert.deepEqual(baselineAssessments(baseline(endpoint.id), [component()], 'catalog').map(item => item.catalogState), ['unchanged'],
    'the bare project scope keeps working, so existing callers do not change')
  assert.deepEqual(baselineAssessments(baseline('catalog/gone/endpoint/get-price'), [component()], plan).map(item => item.catalogState), ['removed'])
})

test('a pre-migration baseline keeps unchanged relations after the ID scope changes', () => {
  const scope = { manifest: { id: 'catalog' }, repository: { id: 'volvo-cars/price-engine' } }
  const endpoint = catalogIndex({ ...scope, layout: 'catalog-v1', snapshot: { components: [component()] } })
    .find(entry => entry.kind === 'endpoint')!
  const baseline = knowledgeBaselineSchema.parse({
    version: 1, featureId: 'f', question: 'q', catalogRevision: 'a'.repeat(64), context: 'b'.repeat(64),
    capturedAt: '2026-01-01T00:00:00Z', assumptions: [], observations: [entityObservation(endpoint)],
  })
  const map = emptyLegacyIdMap()
  recordLegacyScope(map, 'catalog', 'gpe-price', 'volvo-cars/price-engine')
  const migrated = { ...scope, layout: 'catalog-v3' as const, legacyIds: map }
  assert.equal(baselineAssessments(baseline, [component()], migrated)[0].catalogState, 'unchanged')
})

test('a conflicting legacy scope cannot advertise a guessed repository alias', () => {
  const map = emptyLegacyIdMap()
  recordLegacyScope(map, 'catalog', 'gpe-price', 'volvo-cars/price-engine')
  recordLegacyScope(map, 'catalog', 'gpe-price', 'other/repository')
  const entries = catalogIndex({ manifest: { id: 'catalog' }, repository: { id: 'volvo-cars/price-engine' },
    legacyIds: map, snapshot: { components: [component()] } })
  const entry = entries.find(item => item.kind === 'endpoint')!
  assert.deepEqual(entry.aliases, [])
  assert.equal(catalogLookup(entries).get(catalogId('volvo-cars/price-engine', 'gpe-price', 'endpoint', 'get-price')), undefined)
})

test('a migrated home does not invent a synthetic alias for conflicting ID evidence', () => {
  const home = 'volvo-cars/price-engine', scope = identitySlug(home)
  const map = emptyLegacyIdMap()
  recordLegacyScope(map, scope, 'gpe-price', home)
  recordLegacyScope(map, scope, 'gpe-price', 'other/repository')
  const entries = catalogIndex({ manifest: { id: scope }, repository: { id: home }, layout: 'catalog-v3',
    legacyIds: legacyIdMapFromProjection(legacyIdProjection(map)), snapshot: { components: [component()] } })
  assert.equal(catalogLookup(entries).get(catalogId(scope, 'gpe-price', 'endpoint', 'get-price')), undefined)
})

test('bare and structured dependency references retain one baseline meaning across migration', () => {
  const home = 'volvo-cars/price-engine', target = 'volvo-cars/db'
  const db = component({ id: 'db', repo: target, api: undefined })
  const flow = { id: 'call-db', name: 'Call DB', steps: [{ id: 'invoke', title: 'Invoke DB', dependencyIds: ['db'] }] }
  const service = component({ id: 'service', repo: home, api: undefined, dependsOn: ['db', 'missing'], executionFlows: [flow] })
  const scope = { manifest: { id: 'catalog' }, repository: { id: home } }
  const entries = catalogIndex({ ...scope, layout: 'catalog-v1', snapshot: { components: [service, db] } })
  const observations = entries.filter(entry => entry.component.id === 'service' && ['component', 'flow'].includes(entry.kind))
    .map(entityObservation)
  const baseline = knowledgeBaselineSchema.parse({
    version: 1, featureId: 'f', question: 'q', catalogRevision: 'a'.repeat(64), context: 'b'.repeat(64),
    capturedAt: '2026-01-01T00:00:00Z', assumptions: [], observations,
  })
  const migratedService = component({ ...service, dependsOn: [{ repository: target, component: 'db' }, 'missing'],
    executionFlows: [{ ...flow, steps: [{ ...flow.steps[0], dependencyIds: [{ repository: target, component: 'db' }] }] }] })
  const map = emptyLegacyIdMap()
  recordLegacyScope(map, 'catalog', 'service', home)
  recordLegacyScope(map, 'catalog', 'db', target)
  const assessed = baselineAssessments(baseline, [migratedService, db], {
    manifest: { id: identitySlug(home) }, repository: { id: home }, layout: 'catalog-v3', legacyIds: map,
  })
  assert.deepEqual(assessed.map(item => item.catalogState), ['unchanged', 'unchanged'])
  const withoutMarker = knowledgeBaselineSchema.parse({ ...baseline,
    observations: baseline.observations.map(item => ({ ...item,
      relations: item.relations.map(({ unresolved: _unresolved, ...relation }) => relation),
    })),
  })
  assert.deepEqual(baselineAssessments(withoutMarker, [migratedService, db], {
    manifest: { id: identitySlug(home) }, repository: { id: home }, layout: 'catalog-v3', legacyIds: map,
  }).map(item => item.catalogState), ['unchanged', 'unchanged'])
})

test('an unmigrated declared component answers to its home repository ID', async t => {
  const root = await tempDir(t, 'groundwork-declared-alias-')
  await initialise(root, { name: 'Catalog' })
  const before = await readPlan(root)
  await writePlan(root, { ...guard(before), changes: {
    'components/postgres.json': JSON.stringify({ id: 'postgres', productId: 'app', name: 'Postgres' }),
  } })
  const plan = await readPlan(root)
  const repositoryForm = catalogId(plan.repository.id, 'postgres', 'component', 'postgres')
  assert.equal(catalogLookup(catalogIndex(plan)).get(repositoryForm)?.component.id, 'postgres')
})

test('read_scan_manifest keeps legacy IDs in an unmigrated home while the stored record keeps its bytes', async t => {
  const root = await tempDir(t, 'groundwork-manifest-view-')
  await initialise(root, { name: 'Catalog' })
  let plan = await readPlan(root)
  const legacy = catalogId(plan.manifest.id, 'gpe-price', 'endpoint', 'get-price')
  const record = JSON.stringify({
    version: 1, scannerVersion: 3, scanId: '00000000-0000-4000-8000-000000000000', repository: 'volvo-cars/price-engine',
    sourceRevision: 'a'.repeat(40), requestedRef: null, preparedAt: '2026-01-01T00:00:00Z', appliedAt: '2026-01-01T00:00:00Z',
    catalogRevisionBefore: 'none', mode: 'baseline',
    scope: [{ componentId: 'gpe-price', sourcePath: '.', areas: ['api'], observationIds: [legacy] }],
    exclusions: {}, budgets: {}, files: [], dependencyFingerprints: [], omittedDependencyFingerprints: 0,
    mappings: [{ entityId: legacy, path: 'src/a.ts', revision: 'a'.repeat(40), repository: 'volvo-cars/price-engine' }],
    note: 'n',
  }) + '\n'
  const manifestId = digest(record)
  await writePlan(root, {
    ...guard(plan),
    changes: {
      'components/gpe-price.json': JSON.stringify(component({ productId: 'app' })),
      [`scan-manifests/${manifestId}.json`]: record,
    },
  })
  const migrated = catalogId('volvo-cars/price-engine', 'gpe-price', 'endpoint', 'get-price')
  const summary = (await readScanManifest(root, {})).items[0] as { manifestId: string; scope: { observationIds: string[] }[] }
  assert.equal(summary.manifestId, manifestId)
  assert.deepEqual(summary.scope[0].observationIds, [legacy], 'an unmigrated summary uses its canonical legacy IDs')
  const mappings = (await readScanManifest(root, { manifestId, section: 'mappings' })).items as { entityId: string }[]
  assert.deepEqual(mappings.map(mapping => mapping.entityId), [legacy])
  // Both forms answer, because the entry keeps the legacy ID as canonical until the home is migrated.
  plan = await readPlan(root)
  const lookup = catalogLookup(catalogIndex(plan))
  assert.ok(lookup.get(migrated) && lookup.get(legacy), 'both ID forms stay resolvable against the catalog')
  // The record is content-addressed, so only the view was adapted.
  assert.equal(plan.files[`scan-manifests/${manifestId}.json`], record)
  assert.equal(digest(plan.files[`scan-manifests/${manifestId}.json`]), manifestId)
})

test('an unmigrated home derives its legacy ID map from what it already records', async t => {
  const root = await tempDir(t, 'groundwork-legacy-ids-')
  await initialise(root, { name: 'Catalog' })
  const plan = await readPlan(root)
  const files = {
    ...plan.files,
    'components/gpe-price.json': JSON.stringify({ id: 'gpe-price', productId: 'app', name: 'Price', repo: 'volvo-cars/price-engine' }),
  }
  const derived = parsePlan(files)
  assert.equal(
    translateCatalogId(catalogId(derived.manifest.id, 'gpe-price', 'component', 'gpe-price'), derived.legacyIds),
    catalogId('volvo-cars/price-engine', 'gpe-price', 'component', 'gpe-price'),
  )
  // A component with no repository cannot be placed, so its IDs stay exactly as they are.
  assert.equal(translateCatalogId(catalogId(derived.manifest.id, 'other', 'component', 'other'), derived.legacyIds), null)
})

const file = (value: string): InventoryFile => ({ path: value, digest: 'a'.repeat(40), bytes: 1 })
async function snapshot(t: TestContext, contents: Record<string, string>) {
  const root = await tempDir(t, 'groundwork-derived-ids-')
  await writeFiles(root, contents)
  return { root, files: Object.keys(contents).map(file) }
}

test('component IDs come from the manifest name and folder, and adding a same-named project changes nothing', async t => {
  assert.equal(derivedComponentId('api', '.'), 'api')
  assert.equal(derivedComponentId('api', 'services/price'), 'api--services-price')
  assert.equal(derivedComponentId('@acme/pretax-api', 'src/api'), 'pretax-api--src-api')
  const contents = { 'services/price/package.json': '{"name":"api"}' }
  const first = await snapshot(t, contents)
  const before = await detectProjects(first.root, first.files, 'acme/mono', [])
  const second = await snapshot(t, { ...contents, 'services/tax/package.json': '{"name":"api"}' })
  const after = await detectProjects(second.root, second.files, 'acme/mono', [])
  assert.deepEqual(before.map(item => item.suggestedId), ['api--services-price'])
  assert.deepEqual(after.map(item => item.suggestedId), ['api--services-price', 'api--services-tax'])
})

test('a root project keeps its ID when a nested project of the same name is added', async t => {
  const contents = { 'package.json': '{"name":"api"}', 'services/api/package.json': '{"name":"api"}' }
  const { root, files } = await snapshot(t, contents)
  const clean = await detectProjects(root, files, 'acme/mono', [])
  const existing = [{ id: 'api', productId: 'app', name: 'API', repo: 'acme/mono', sourcePath: '.' }] as Component[]
  const incremental = await detectProjects(root, files, 'acme/mono', existing)
  assert.deepEqual(clean.map(item => item.suggestedId), ['api', 'api--services-api'])
  assert.deepEqual(incremental.map(item => item.suggestedId), clean.map(item => item.suggestedId))
})

test('an existing component keeps its ID, by path or by a recorded identity change', async t => {
  const { root, files } = await snapshot(t, { 'services/price/package.json': '{"name":"api"}' })
  const existing = [{ id: 'c-price-api', productId: 'app', name: 'Price', repo: 'acme/mono', sourcePath: 'services/price' }] as Component[]
  assert.equal((await detectProjects(root, files, 'acme/mono', existing))[0].suggestedId, 'c-price-api')
  const moved = [{
    ...existing[0], sourcePath: 'services/current',
    identityChanges: [{
      previousId: 'c-price-api', previousSourcePath: 'services/price', id: 'api--services-current', sourcePath: 'services/current',
      recordedAt: '2026-01-01T00:00:00Z', reason: 'Moved', sourceRevision: 'a'.repeat(40),
      evidence: [{ path: 'services/price/package.json', lines: '1', claim: 'Manifest moved here.', revision: 'a'.repeat(40) }],
    }],
  }] as unknown as Component[]
  const detected = await detectProjects(root, files, 'acme/mono', moved)
  assert.equal(detected[0].suggestedId, 'c-price-api')
  assert.equal(detected[0].derivedId, 'api--services-price')
  assert.equal(matchComponent(moved, 'acme/mono', { path: 'services/price', derivedId: 'api--services-price' })?.id, 'c-price-api')
  assert.equal(matchComponent(moved, 'acme/mono', { path: 'services/other', derivedId: 'nothing' }), undefined)
})

test('three identity hops match only the current path or latest previous path, once per component', () => {
  const history = [
    { previousId: 'api--services-first', previousSourcePath: 'services/first', id: 'api--services-second', sourcePath: 'services/second' },
    { previousId: 'api--services-second', previousSourcePath: 'services/second', id: 'api--services-third', sourcePath: 'services/third' },
    { previousId: 'api--services-third', previousSourcePath: 'services/third', id: 'api--services-fourth', sourcePath: 'services/fourth' },
  ].map(change => ({ ...change, recordedAt: '2026-01-01T00:00:00Z', reason: 'Moved', sourceRevision: 'a'.repeat(40), evidence: [] }))
  const component = { id: 'api--services-first', productId: 'app', name: 'Price', repo: 'acme/mono', sourcePath: 'services/fourth', identityChanges: history } as Component
  const boundary = (path: string) => ({ path, derivedId: `api--${path.replace('/', '-')}` })
  const matches = matchComponents([component], 'acme/mono', [boundary('services/first'), boundary('services/second'), boundary('services/third')])
  assert.deepEqual([...matches.keys()], ['services/third'])
  const current = matchComponents([component], 'acme/mono', [boundary('services/third'), boundary('services/fourth')])
  assert.deepEqual([...current.keys()], ['services/fourth'], 'a live current path takes priority over the previous path')
})

async function movableRepository(t: TestContext) {
  const root = await gitInit(await tempDir(t, 'groundwork-identity-source-'))
  await mkdir(path.join(root, 'services/price'), { recursive: true })
  await writeFile(path.join(root, 'services/price/package.json'), JSON.stringify({ name: 'price-api' }))
  await writeFile(path.join(root, 'services/price/index.ts'), 'export const price = 1\n')
  await git(root, ['add', '.'])
  await git(root, ['commit', '-m', 'Fixture'])
  return root
}

test('a moved build project is reconciled onto its component only once the home is migrated', async t => {
  const source = await movableRepository(t)
  const root = await tempDir(t, 'groundwork-identity-target-')
  await initialise(root, { name: 'Catalog' })
  const prepared = await prepareRepositoryScan(root, { repository: source })
  assert.equal(prepared.projects[0].suggestedId, 'price-api--services-price')
  assert.equal(prepared.projects[0].derivedId, 'price-api--services-price')
  let plan = await readPlan(root)
  await assert.rejects(applyRepositoryScan(root, {
    scanId: prepared.scanId, expectedRevision: plan.revision, expectedContext: plan.context.token,
    discoveries: [{
      id: 'c-price-api', productId: 'app', sourcePath: 'services/price', name: 'Price API',
      coverage: { dependencies: 'complete', api: 'complete', data: 'complete', messaging: 'complete' },
    }],
  }), /takes the ID derived from its manifest name and folder, price-api--services-price/)
  await applyRepositoryScan(root, {
    scanId: prepared.scanId, expectedRevision: plan.revision, expectedContext: plan.context.token,
    discoveries: [{
      id: 'price-api--services-price', productId: 'app', sourcePath: 'services/price', name: 'Price API',
      coverage: { dependencies: 'complete', api: 'complete', data: 'complete', messaging: 'complete' },
    }],
  })

  await mkdir(path.join(source, 'apps'), { recursive: true })
  await git(source, ['mv', 'services/price', 'apps/price'])
  await git(source, ['commit', '-m', 'Move the build project'])
  const next = await prepareRepositoryScan(root, { repository: source })
  assert.equal(next.projects[0].suggestedId, 'price-api--apps-price', 'the move looks like a new project until it is reconciled')
  plan = await readPlan(root)
  // An identity change has no legacy representation, so an unmigrated home is told what it has to do first
  // instead of being handed a document an older release would refuse to read.
  await assert.rejects(reconcileComponentIdentity(root, {
    scanId: next.scanId, componentId: 'price-api--services-price', sourcePath: 'apps/price',
    reason: 'The build project moved from services/ to apps/.',
    evidence: [{ path: 'apps/price/package.json', lines: '1', claim: 'The manifest now lives here.', revision: next.revision }],
    expectedRevision: plan.revision, expectedContext: plan.context.token,
  }), /available once this home is migrated/)
  assert.equal((await readPlan(root)).snapshot.components[0].sourcePath, 'services/price', 'the refusal changed nothing')
  await discardRepositoryScan({ scanId: next.scanId })
})

/** Scan metadata for a home that is not being scanned for real, so identity reconciliation can be exercised in a v3 home. */
const scanMetadataFor = (plan: { manifest: { id: string }; context: { checkoutId: string } }, projects: ScanMetadata['projects']): ScanMetadata => ({
  schemaVersion: 1, scannerVersion: SCANNER_VERSION, id: '3f1a2b4c-5d6e-4f70-8192-a3b4c5d6e7f8', createdAt: '2026-01-01T00:00:00Z', expiresAt: '2026-01-02T00:00:00Z',
  requestedRef: null, budgets: { maxFiles: 10, maxBytes: 1000, maxFilesPerPacket: 5, maxPackets: 10 }, dependencyFingerprints: [], omittedDependencyFingerprints: 0,
  repository: 'volvo-cars/price-engine', revision: 'b'.repeat(40), targetProjectId: plan.manifest.id, targetCheckoutId: plan.context.checkoutId,
  areas: ['api'], files: [], projects, packets: [], excluded: {},
})

test('a migrated home records the identity change, under its own canonical ID forms', async t => {
  const root = await homeFixture(t, 'v3', 'git@github.com:volvo-cars/price-engine.git')
  const plan = await readPlan(root)
  const metadata = scanMetadataFor(plan, [{
    path: 'apps/api', name: 'price-api', suggestedId: 'price-api--apps-api', derivedId: 'price-api--apps-api', manifest: 'package.json',
  }])
  const args = {
    scanId: metadata.id, componentId: 'price-api--src-api', sourcePath: 'apps/api',
    reason: 'The build project moved from src/ to apps/.',
    evidence: [{ path: 'apps/api/package.json', lines: '1', claim: 'The manifest now lives here.', revision: metadata.revision }],
    expectedRevision: plan.revision, expectedContext: plan.context.token,
  }
  const { change, changes, manifest } = componentIdentityChange(plan, metadata, args, '2026-02-01T00:00:00Z')
  assert.deepEqual({ previousId: change.previousId, previousSourcePath: change.previousSourcePath, id: change.id, sourcePath: change.sourcePath }, {
    previousId: 'price-api--src-api', previousSourcePath: 'src/api', id: 'price-api--apps-api', sourcePath: 'apps/api',
  })
  const written = JSON.parse(changes['components/price-api--src-api.json'])
  assert.equal(written.sourcePath, 'apps/api', 'the component keeps its ID and takes the new path')
  assert.deepEqual(written.identityChanges, [change])
  // A migrated home qualifies its observations by repository, so the manifest cites the repository-form ID.
  const document = JSON.parse(manifest.raw)
  assert.deepEqual(document.scope[0].observationIds, ['volvo-cars%2Fprice-engine/price-api--src-api/component/price-api--src-api'])
  assert.deepEqual(document.mappings.map((mapping: { entityId: string }) => mapping.entityId),
    ['volvo-cars%2Fprice-engine/price-api--src-api/component/price-api--src-api'])
  // Only the read schema accepts the record; a write into an unmigrated home still refuses it.
  const stored = plan.snapshot.components.find(item => item.id === 'price-api--src-api')!
  const document3 = { ...stored, ...JSON.parse(changes['components/price-api--src-api.json']) }
  assert.equal(componentReadSchema.safeParse(document3).success, true)
  assert.equal(componentSchema.safeParse(document3).success, false)
  assert.throws(() => assertLegacyWriteForm('components/c.json', JSON.stringify({ id: 'c', productId: 'app', name: 'C', identityChanges: [change] })), /identityChanges/)
  // The read path keeps honouring the record, which is what stops the next scan cataloguing the project twice.
  const moved = [{ ...plan.snapshot.components.find(item => item.id === 'price-api--src-api')!, sourcePath: 'apps/api', identityChanges: [change] }] as Component[]
  assert.equal(matchComponent(moved, 'volvo-cars/price-engine', { path: 'apps/api', derivedId: 'price-api--apps-api' })?.id, 'price-api--src-api')
})

test('component identity reconciliation is not offered until a home can be written in the migrated layout', async () => {
  // It could not succeed anywhere: an unmigrated home is refused by the operation, and a migrated one is refused
  // by the storage layer, which does not write v3 yet. So it is not advertised as an operation or a schema.
  assert.equal('reconcile_component_identity' in operationSchemas, false, 'no published JSON schema')
  await assert.rejects(operate('reconcile_component_identity' as 'reconcile_catalog', {}), /Unknown operation/)
  assert.equal(existsSync(path.join(repoRoot, 'schemas/reconcile_component_identity.schema.json')), false)
  for (const file of ['docs/PORTABLE.md', 'docs/CATALOG_DISCOVERY.md', '.agents/skills/groundwork-system-catalog/references/normalized-output.md']) {
    assert.equal(readFileSync(path.join(repoRoot, file), 'utf8').includes('reconcile_component_identity'), false, `${file} does not advertise it`)
  }
})
