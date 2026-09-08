import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ContentError, createRepository, loadContent } from '../src/data/content.ts'
import { livePrototypeIds } from '../src/data/live-prototypes.ts'
import { documents } from './fixtures.ts'

const copy = () => structuredClone(documents) as Record<string, any>
const load = (data: Record<string, unknown>) => loadContent(data, livePrototypeIds)
const rejects = (data: Record<string, unknown>, message: RegExp) => assert.throws(() => load(data), error => error instanceof ContentError && message.test(error.message))

test('new workspace, product and draft feature are discoverable without UI registration', () => {
  const input = copy()
  input['workspaces/w-new.json'] = { id: 'w-new', slug: 'new-space', name: 'New space', hue: 'var(--hue-teal)', createdAt: '2026-09-01T00:00:00Z' }
  input['products/p-new.json'] = { id: 'p-new', workspaceId: 'w-new', slug: 'new-product', name: 'New product', kind: 'library' }
  input['components/c-new.json'] = { id: 'c-new', productId: 'p-new', name: 'New component' }
  input['features/f-new/feature.json'] = { id: 'f-new', productId: 'p-new', title: 'New plan', stage: 'idea', ownerId: 'ryan-nel', touches: ['c-new'], updatedAt: '2026-09-05T10:00:00Z' }
  input['features/f-new/purpose.json'] = { problem: 'A problem', outcome: 'A measurable outcome' }
  const { q } = createRepository(load(input))
  assert.equal(q.workspace('new-space')?.id, 'w-new')
  assert.equal(q.products('w-new')[0].slug, 'new-product')
  assert.equal(q.components('p-new')[0].name, 'New component')
  assert.equal(q.featuresInWorkspace('w-new')[0].spec?.purpose?.outcome, 'A measurable outcome')
  assert.equal(q.features('p-new')[0].owner, 'Ryan Nel')
})
test('shape validation rejects unknown fields, stages, versions and malformed dates with a file path', () => {
  for (const [key, value] of [['stage', 'approved'], ['updatedAt', 'yesterday'], ['titel', 'Typo']]) {
    const input = copy(); input['features/f-1/feature.json'][key] = value
    rejects(input, /features\/f-1\/feature.json/)
  }
  const input = copy(); input['project.json'].schemaVersion = 2
  rejects(input, /project.json/)
})
test('a missing owner or product fails before a partial repository is created', () => {
  const input = copy(); input['features/f-1/feature.json'].ownerId = 'missing'; input['features/f-1/feature.json'].productId = 'missing'
  rejects(input, /ownerId: unknown reference/)
  rejects(input, /productId: unknown reference/)
})
test('duplicate IDs, ambiguous routes and orphaned sections are rejected', () => {
  const duplicate = copy(); duplicate['members/duplicate.json'] = duplicate['members/ryan-nel.json']; rejects(duplicate, /duplicate member/)
  const slug = copy(); slug['products/p-cart.json'].slug = 'pricing'; rejects(slug, /duplicate "pricing"/)
  const orphan = copy(); orphan['features/f-orphan/purpose.json'] = { problem: 'Why', outcome: 'What' }; rejects(orphan, /require feature.json/)
})
test('cross-product references work within a workspace; cross-workspace references fail', () => {
  const input = copy(); input['features/f-1/feature.json'].touches.push('c-cart-svc'); assert.doesNotThrow(() => load(input))
  input['features/f-1/feature.json'].touches.push('c-cli'); rejects(input, /another workspace/)
})
test('section links, decision outcomes and API boundaries must target the right objects', () => {
  const missing = copy(); missing['features/f-2/tests.json'].cases[0].steps = ['missing']; rejects(missing, /unknown journey reference/)
  const decision = copy(); decision['features/f-2/flow.json'].nodes.find((n: any) => n.id === 'region').logic.branches[0].edgeId = 'e-sdk-cart'; rejects(decision, /branch must leave/)
  const boundary = copy(); boundary['features/f-2/api.json'].contracts.find((c: any) => c.id === 'api-quote').from = 'c-sdk'; rejects(boundary, /does not match the boundary/)
})
test('action boundaries cannot leave the action and visible nodes cannot overlap', () => {
  const input = copy(); input['features/f-2/journey.json'].steps[0].flowEdges = ['e-region-quote']; rejects(input, /leaves this action/)
  const overlap = copy(); const nodes = overlap['features/f-2/flow.json'].nodes; nodes[1].col = nodes[0].col; nodes[1].row = nodes[0].row; rejects(overlap, /flow positions/)
})
test('schema fields are unique within each parent, including nested objects', () => {
  const input = copy(); const schema = input['features/f-2/api.json'].contracts.find((c: any) => c.id === 'api-quote').responseSchema.after
  schema.push(structuredClone(schema[0])); rejects(input, /responseSchema.after: duplicate/)
})
test('external design references reject unsafe protocols and live prototypes require registration', () => {
  const input = copy(); input['features/f-2/design.json'].mockups[0].ref = 'missing-renderer'; rejects(input, /unregistered live prototype/)
  input['features/f-2/design.json'].mockups[0] = { id: 'd-cart', kind: 'image', title: 'Example', ref: 'javascript:alert(1)' }; rejects(input, /http\(s\) URL/)
})
test('member names and viewer identity resolve centrally', () => {
  const input = copy(); input['members/ryan-nel.json'].name = 'Renamed member'
  const { q } = createRepository(load(input))
  assert.equal(q.viewer().name, 'Renamed member')
  assert.ok(q.features().filter(f => f.ownerId === 'ryan-nel').every(f => f.owner === 'Renamed member'))
})

test('local raster references allow portable assets without allowing traversal or executable URLs', () => {
  const input = copy()
  const mock = input['features/f-2/design.json'].mockups[0]
  Object.assign(mock, { kind: 'image', ref: '/images/wordloop/active_recording.png' })
  assert.doesNotThrow(() => load(input))
  for (const ref of ['/images/../secret.png', '//example.com/image.png', '/images/a.svg', '/images/%2e%2e/secret.png', 'file:///tmp/image.png']) {
    mock.ref = ref
    rejects(input, /http\(s\) URL/)
  }
})

test('a target specification can preserve an unassessed implementation delta', () => {
  const input = copy()
  input['features/f-2/api.json'].contracts[0].change = 'unspecified'
  input['features/f-2/storage.json'].tables[0].change = 'unspecified'
  const feature = load(input).features.find(f => f.id === 'f-2')!
  assert.equal(feature.spec!.api!.contracts[0].change, 'unspecified')
  assert.equal(feature.spec!.storage!.tables[0].change, 'unspecified')
})
test('an empty project and a feature with no sections are valid drafting states', () => {
  const input = { 'project.json': documents['project.json'], 'members/ryan-nel.json': documents['members/ryan-nel.json'] }
  assert.equal(load(input).features.length, 0)
  assert.equal(load(copy()).features.find(f => f.id === 'f-1')?.spec, undefined)
})
test('a completely blank system needs no member or viewer record', () => {
  const snapshot = load({ 'project.json': { schemaVersion: 1 } })
  assert.deepEqual(snapshot.members, [])
  assert.deepEqual(snapshot.workspaces, [])
  assert.deepEqual(snapshot.products, [])
  assert.deepEqual(snapshot.components, [])
  assert.deepEqual(snapshot.features, [])
  assert.equal(createRepository(snapshot).q.viewer(), undefined)
})
test('chronological sorting uses actual timestamps even when offsets differ', () => {
  const input = copy(); input['features/f-1/feature.json'].updatedAt = '2026-09-05T12:00:00+02:00'; input['features/f-2/feature.json'].updatedAt = '2026-09-05T10:30:00Z'
  assert.equal(createRepository(load(input)).q.features('p-pricing')[0].id, 'f-2')
})

test('component API guides validate their ownership, capability IDs, and contract links', () => {
  const input = copy()
  const api = input['features/f-2/api.json']
  const contract = api.contracts.find((c: any) => c.from !== c.to && c.method !== 'EVENT')
  api.guides = [{ componentId: contract.to, overview: 'This service owns the durable result.', featureImpact: 'This feature needs a result API.', capabilities: [{ id: 'result', title: 'Retrieve a result', description: 'The result can be read through the service API.', contractIds: [contract.id] }] }]
  assert.doesNotThrow(() => load(input))
  const missing = structuredClone(input); missing['features/f-2/api.json'].guides[0].capabilities[0].contractIds = ['unknown-contract']; rejects(missing, /unknown api reference/)
  const wrongOwner = structuredClone(input); wrongOwner['features/f-2/api.json'].guides[0].componentId = contract.from; rejects(wrongOwner, /another component's API/)
  const duplicate = structuredClone(input); duplicate['features/f-2/api.json'].guides.push(duplicate['features/f-2/api.json'].guides[0]); rejects(duplicate, /duplicate/i)
})

test('data model context remains optional and does not invent fields or change assessments', () => {
  const input = copy()
  const path = Object.keys(input).find(key => key.endsWith('/storage.json'))!
  const record = input[path].tables[0]
  record.description = 'A durable record used by this feature.'
  record.group = 'Meeting records'
  record.change = 'unspecified'
  assert.doesNotThrow(() => load(input))
  record.columns = []
  assert.doesNotThrow(() => load(input))
  record.description = ''
  rejects(input, /storage.json/)
  delete record.description
  delete record.group
  assert.doesNotThrow(() => load(input))
})
