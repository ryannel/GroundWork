import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  catalogCandidateFromComponents, materializeResolvedCatalog, resolveCatalogForProduct,
  type AreaUnit, type CatalogCandidate, type DetailUnit, type RetirementUnit, type RevisionHistory,
} from '../server/catalog-resolution.ts'
import type { Component } from '../src/data/model.ts'

const revisions = ['a', 'b', 'c', 'd']
const history: RevisionHistory = {
  relation(first, second) {
    if (first === second) return 'same'
    const a = revisions.indexOf(first), b = revisions.indexOf(second)
    return a < 0 || b < 0 ? 'unknown' : a < b ? 'ancestor' : 'descendant'
  },
}
const area = (revision: string | null, endpoints: string[], patch: Partial<AreaUnit> = {}): AreaUnit => ({
  kind: 'area', componentId: 'api', area: 'api', revision, value: { endpoints },
  entities: endpoints.map(id => ({ kind: 'endpoint', id })), ...patch,
})
const flow = (revision: string, id: string, endpointId: string, patch: Partial<DetailUnit> = {}): DetailUnit => ({
  kind: 'flow', componentId: 'api', id, revision, value: { id, endpointId },
  references: [{ componentId: 'api', kind: 'endpoint', id: endpointId }], ...patch,
})
const finding = (revision: string, id: string, endpointId: string, patch: Partial<DetailUnit> = {}): DetailUnit => ({
  kind: 'finding', componentId: 'api', id, revision, value: { id },
  references: [{ componentId: 'api', kind: 'endpoint', id: endpointId }], ...patch,
})
const retirement = (revision: string, kind: RetirementUnit['retiredKind'], id: string): RetirementUnit => ({
  kind: 'retirement', componentId: 'api', retiredKind: kind, id, revision, value: { reason: 'Removed' },
})
const source = (...units: CatalogCandidate['units']): CatalogCandidate => ({ repository: 'acme/source', units })
const local = (...units: CatalogCandidate['units']): CatalogCandidate => ({ repository: 'acme/source', homeRepository: 'acme/home', units })
const resolve = (from: CatalogCandidate, home: CatalogCandidate | null, order = history) =>
  resolveCatalogForProduct('acme/home', from, home, order)

test('the later source revision wins each whole area; source wins a tie and single-candidate units survive', () => {
  const result = resolve(source(area('a', ['old']), { ...area('a', ['data']), area: 'data' }, flow('c', 'f', 'new')),
    local(area('b', ['new']), { ...area('b', ['message']), area: 'messaging' }, flow('b', 'f', 'old')))
  assert.equal((result.areas.find(item => item.unit.area === 'api')!.unit.value as { endpoints: string[] }).endpoints[0], 'new')
  assert.deepEqual(result.areas.find(item => item.unit.area === 'api')!.provenance,
    { catalog: 'local', revision: 'b', effectiveRevision: 'b', otherCatalog: 'source', otherRevision: 'a',
      otherEffectiveRevision: 'a', reason: 'local-newer' })
  assert.equal(result.areas.find(item => item.unit.area === 'messaging')!.provenance.reason, 'local-only')
  assert.equal(result.areas.find(item => item.unit.area === 'data')!.provenance.reason, 'source-only')
  assert.equal(result.flows[0].provenance.catalog, 'source')
  assert.equal(result.flows[0].provenance.reason, 'source-newer')
  const tie = resolve(source(area('b', ['source'])), local(area('b', ['local'])))
  assert.equal(tie.areas[0].provenance.catalog, 'source')
  assert.equal(tie.areas[0].provenance.reason, 'same-revision')
})

test('a squash or rebase tree maps to default-branch ancestry, and equal covered trees tie toward source', () => {
  const tree = { id: 'tree-1', coveredPathsKey: 'src/api/**' }
  const order: RevisionHistory = { ...history, defaultBranchRevision: candidate => candidate.id === 'tree-1' ? 'b' : undefined }
  const merged = resolve(source(area('a', ['source'])), local(area('orphan', ['local'], { tree })), order)
  assert.equal(merged.areas[0].provenance.catalog, 'local')
  assert.equal(merged.areas[0].provenance.effectiveRevision, 'b')
  const surpassed = resolve(source(area('c', ['source'])), local(area('orphan', ['local'], { tree })), order)
  assert.equal(surpassed.areas[0].provenance.catalog, 'source')
  const equalTrees = resolve(source(area('branch-a', ['source'], { tree })),
    local(area('branch-b', ['local'], { tree })), { relation: () => 'diverged' })
  assert.equal(equalTrees.areas[0].provenance.catalog, 'source')
  assert.equal(equalTrees.areas[0].provenance.reason, 'equivalent-tree')
  assert.equal(equalTrees.warnings.length, 0)
  const distinctPaths = resolve(source(area('branch-a', ['source'], { tree })),
    local(area('branch-b', ['local'], { tree: { ...tree, coveredPathsKey: 'src/other/**' } })), { relation: () => 'diverged' })
  assert.equal(distinctPaths.areas[0].provenance.reason, 'diverged')
})

test('diverged and unknown ordering fall back to source with visible conflict and rejected revision', () => {
  for (const status of ['diverged', 'unknown'] as const) {
    const result = resolve(source(area('left', ['source'])), local(area('right', ['local'])), { relation: () => status })
    assert.equal(result.areas[0].provenance.catalog, 'source')
    assert.equal(result.areas[0].provenance.otherRevision, 'right')
    assert.equal(result.areas[0].provenance.conflict, status)
    assert.deepEqual(result.warnings, [{ componentId: 'api', kind: 'area', id: 'api', status }])
  }
  const unrecorded = resolve(source(area(null, ['source'])), local(area('b', ['local'])))
  assert.equal(unrecorded.areas[0].provenance.reason, 'unknown')
  assert.equal(unrecorded.areas[0].provenance.catalog, 'source')
})

test('newer retirements prevent older endpoint and flow revival, while newer active evidence can supersede an older retirement', () => {
  const removed = resolve(source(area('a', ['old']), flow('a', 'old-flow', 'old')),
    local(retirement('b', 'endpoint', 'old'), retirement('b', 'flow', 'old-flow')))
  assert.deepEqual(removed.areas[0].suppressed, [{ kind: 'endpoint', id: 'old' }])
  assert.equal(removed.flows.length, 0)
  assert.equal(removed.retirements.filter(item => item.effective).length, 2)
  const restored = resolve(source(area('c', ['old']), flow('c', 'old-flow', 'old')),
    local(retirement('b', 'endpoint', 'old'), retirement('b', 'flow', 'old-flow')))
  assert.equal(restored.areas[0].suppressed.length, 0)
  assert.equal(restored.flows.length, 1)
  assert.equal(restored.retirements.filter(item => item.effective).length, 0)
})

test('a flow and finding selected at another revision are marked incompatible with missing area references', () => {
  const result = resolve(source(area('c', ['new']), flow('b', 'path', 'removed'), finding('b', 'claim', 'removed')),
    local(flow('a', 'path', 'removed')))
  assert.equal(result.flows[0].provenance.catalog, 'source')
  assert.deepEqual(result.flows[0].incompatible, [{ componentId: 'api', kind: 'endpoint', id: 'removed', areaRevision: 'c' }])
  assert.deepEqual(result.findings[0].incompatible, [{ componentId: 'api', kind: 'endpoint', id: 'removed', areaRevision: 'c' }])
  assert.equal(result.flows[0].unit.id, 'path', 'incompatible knowledge remains visible with its provenance')
})

test('incompatible details transitively invalidate findings that reference them', () => {
  const identity: AreaUnit = { kind: 'area', componentId: 'api', area: 'identity', revision: 'c',
    value: { id: 'api', productId: 'product', order: 0, name: 'API', repo: 'acme/source' },
    entities: [{ kind: 'component', id: 'api' }] }
  const badFlow = flow('b', 'bad-flow', 'missing-endpoint')
  // Put the final dependent first so a single ordered pass cannot accidentally satisfy this regression.
  const finalFinding = finding('b', 'final-claim', 'unused', {
    references: [{ componentId: 'api', kind: 'finding', id: 'flow-claim' }],
  })
  const flowFinding = finding('b', 'flow-claim', 'unused', {
    references: [{ componentId: 'api', kind: 'flow', id: 'bad-flow' }],
  })
  const result = resolve(source(identity, area('c', ['present']), badFlow, finalFinding, flowFinding), null)
  assert.deepEqual(result.flows[0].incompatible.map(ref => `${ref.kind}/${ref.id}`), ['endpoint/missing-endpoint'])
  assert.deepEqual(result.findings.find(item => item.unit.id === 'flow-claim')?.incompatible.map(ref => `${ref.kind}/${ref.id}`),
    ['flow/bad-flow'])
  assert.deepEqual(result.findings.find(item => item.unit.id === 'final-claim')?.incompatible.map(ref => `${ref.kind}/${ref.id}`),
    ['finding/flow-claim'])
  const materialized = materializeResolvedCatalog(result)
  assert.equal(materialized.components[0].executionFlows?.length ?? 0, 0)
  assert.equal(materialized.components[0].findings?.length ?? 0, 0)
  assert.deepEqual(materialized.incompatible.map(item => item.unit.id), ['bad-flow', 'final-claim', 'flow-claim'])
})

test('another product home local catalog cannot enter this product resolution, and duplicate units are rejected', () => {
  assert.throws(() => resolve(source(area('a', ['one'])),
    { repository: 'acme/source', homeRepository: 'acme/other-home', units: [area('b', ['two'])] }), /another repository or product home/)
  assert.throws(() => resolve(source(area('a', ['one']), area('b', ['two'])), null), /Duplicate area catalog unit/)
})

test('normalization dates each area separately, and materialization suppresses retired facts while surfacing incompatible details', () => {
  const component = (apiRevision: string, endpoints: string[], flows: { id: string; endpointId: string; revision: string }[],
    retired: { kind: 'endpoint'; id: string; revision: string }[] = []): Component => ({
    id: 'api', productId: 'product', order: 0, name: 'API', repo: 'acme/source', sourceRevision: 'c',
    api: { name: 'API', endpoints: endpoints.map(id => ({ id, name: id, method: 'GET', path: `/${id}` })), schemas: [],
      sourceRevision: apiRevision },
    data: { records: [] },
    executionFlows: flows.map(item => ({ id: item.id, endpointId: item.endpointId, name: item.id, summary: item.id,
      sourceRevision: item.revision, entryStepId: 'start', steps: [{ id: 'start', title: 'Start', kind: 'request', description: '', evidence: [] }],
      transitions: [], gaps: [] })),
    retiredObservations: retired.map(item => ({ kind: item.kind, id: item.id, retiredAt: '2026-01-01T00:00:00Z',
      sourceRevision: item.revision, reason: 'Removed', evidence: [], observation: { id: item.id } })),
  }) as Component
  const from = catalogCandidateFromComponents('acme/source', [component('a', ['old'], [
    { id: 'removed-flow', endpointId: 'old', revision: 'a' },
    { id: 'incompatible-flow', endpointId: 'ghost', revision: 'b' },
  ])])
  const home = catalogCandidateFromComponents('acme/source', [component('b', ['new'], [], [{ kind: 'endpoint', id: 'old', revision: 'b' }])], 'acme/home')
  assert.equal(from.units.find(unit => unit.kind === 'area' && unit.area === 'api')?.revision, 'a')
  assert.equal(from.units.find(unit => unit.kind === 'area' && unit.area === 'data')?.revision, null,
    'a later component scan cannot date an untouched data area')
  const resolved = resolveCatalogForProduct('acme/home', from, home, history)
  const materialized = materializeResolvedCatalog(resolved)
  assert.deepEqual(materialized.components[0].api?.endpoints.map(item => item.id), ['new'])
  assert.equal(materialized.components[0].executionFlows?.length ?? 0, 0)
  assert.deepEqual(materialized.incompatible.map(item => item.unit.id), ['incompatible-flow', 'removed-flow'])
  assert.equal(materialized.components[0].retiredObservations?.[0].id, 'old')
})
