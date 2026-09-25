import { test } from 'node:test'
import assert from 'node:assert/strict'
import { catalogIndex } from '../shared/catalog-index.ts'
import { catalogKinds } from '../shared/catalog-identity.ts'
import {
  CATALOG_PARAMS, catalogHistory, catalogTargetOf, clearComponentScope, entityParam, focusEntity, readCatalogLocation, writeCatalogLocation,
} from '../shared/catalog-url.ts'
import { endpointFlows, selectedFlow, triggeredFlows } from '../src/data/inspector-model.ts'
import { catalogLocation } from '../server/catalog.ts'

const sha = 'a'.repeat(40)
const evidence = [{ path: 'src/app.ts', lines: '1-4', revision: sha, claim: 'Seen in source' }]
const step = (id: string) => ({ id, title: id, kind: 'logic', description: id, evidence })
const flow = (id: string, extra: object) => ({
  id, name: id, summary: id, sourceRevision: sha, entryStepId: `${id}-start`, steps: [step(`${id}-start`)], transitions: [], gaps: [], ...extra,
})
const component: any = {
  id: 'orders-api', productId: 'shop', order: 0, name: 'Orders API', kind: 'service',
  api: {
    name: 'Orders',
    endpoints: [{ id: 'post-orders', name: 'Create order', method: 'POST', path: '/orders', request: 'OrderRequest' }],
    schemas: [{ id: 'order-request', name: 'OrderRequest', kind: 'record', fields: [] }],
  },
  data: { records: [{ id: 'orders-table', name: 'orders', kind: 'record', fields: [] }] },
  messaging: {
    messages: [{
      id: 'order-placed', name: 'OrderPlaced', broker: 'kafka', channel: 'orders', direction: 'inbound', fields: [],
      delivery: { ordering: 'key', retries: '3', deadLetter: 'none' },
    }],
  },
  jobs: [{ id: 'nightly-sweep', name: 'Nightly sweep', description: 'Cleans up', evidence }],
  executionFlows: [
    flow('create-order', { endpointId: 'post-orders' }),
    flow('create-order-retry', { endpointId: 'post-orders' }),
    flow('consume-order-placed', { trigger: { kind: 'message', messageId: 'order-placed' } }),
    flow('sweep', { trigger: { kind: 'job', jobId: 'nightly-sweep' } }),
  ],
}
const entries = catalogIndex({ manifest: { id: 'project' }, snapshot: { components: [component] } })

test('every server deep link round-trips through the viewer URL contract to the same entity', () => {
  assert.deepEqual(new Set(entries.map(entry => entry.kind)), new Set(catalogKinds), 'the fixture covers every catalog kind')
  for (const entry of entries) {
    const url = new URL(`http://localhost/w/project/shop?${writeCatalogLocation(new URLSearchParams({ component: component.id }), catalogLocation(entry))}`)
    assert.equal(url.searchParams.get('component'), component.id)
    const location = readCatalogLocation(url.searchParams)
    const target = catalogTargetOf(location)
    if (entry.kind === 'component') assert.equal(target, undefined)
    else assert.deepEqual(target, { kind: entry.kind, id: entry.localId }, entry.id)
    if (entry.kind !== 'flow') continue
    // The inspector opens the triggering entity and selects this exact path among its recorded flows.
    const raw = entry.raw as { endpointId?: string; trigger?: { kind: 'message' | 'job' } }
    const flows = raw.endpointId ? endpointFlows(component, location.apiEntity!)
      : raw.trigger!.kind === 'message' ? triggeredFlows(component, 'message', location.messagesEntity!)
        : triggeredFlows(component, 'job', location.jobsEntity!)
    assert.equal(selectedFlow(flows, location.flow)?.id, entry.localId)
    if (raw.endpointId) assert.equal(location.apiView, 'flow')
  }
})

test('switching components clears every catalog parameter, including flow and jobs state', () => {
  const stale = new URLSearchParams({
    component: 'a', scope: 'x', view: 'ideas', flow: 'fl', jobsEntity: 'j', jobsQuery: 'q', jobsGroup: 'g',
    catalog: 'api', apiEntity: 'e', apiMethod: 'GET', messagesDirection: 'inbound', schema: 's', from: 'api:e',
  })
  const next = clearComponentScope(stale)
  assert.deepEqual([...next.keys()], ['component', 'scope', 'view'])
  for (const key of CATALOG_PARAMS) assert.equal(next.has(key), false, key)
  assert.equal(stale.get('flow'), 'fl', 'the input is not mutated')
})

test('tabs, views, searches and filters replace history; selecting an entity pushes it', () => {
  assert.equal(catalogHistory({ catalog: 'data' }), 'replace')
  assert.equal(catalogHistory({ apiQuery: 'order', catalog: 'api' }), 'replace')
  assert.equal(catalogHistory({ apiView: 'flow', from: undefined }), 'replace')
  assert.equal(catalogHistory({ apiMethod: 'GET' }), 'replace')
  assert.equal(catalogHistory({ catalog: 'api', dataEntity: undefined }), 'replace', 'clearing a selection is not navigation')
  assert.equal(catalogHistory({ catalog: 'api', apiEntity: 'post-orders' }), 'push')
  assert.equal(catalogHistory({ ...focusEntity('messages', 'order-placed'), from: 'api:post-orders' }), 'push')
})

test('writing a location sets values and removes empty ones without touching other parameters', () => {
  const next = writeCatalogLocation(new URLSearchParams('component=a&catalog=api&apiQuery=x'), { apiQuery: '', apiGroup: undefined, apiEntity: 'e' })
  assert.equal(next.toString(), 'component=a&catalog=api&apiEntity=e')
  assert.deepEqual(readCatalogLocation(new URLSearchParams('catalog=&apiEntity=e&unrelated=1')), { apiEntity: 'e' })
})

test('focusing an entity clears the search and filters that could hide it', () => {
  assert.deepEqual(focusEntity('messages', 'm'), {
    catalog: 'messages', messagesEntity: 'm', messagesQuery: undefined, messagesGroup: undefined, messagesDirection: undefined,
  })
  assert.deepEqual(Object.keys(focusEntity('api', 'e')).sort(), ['apiEntity', 'apiGroup', 'apiMethod', 'apiQuery', 'apiVersion', 'catalog'])
})

test('schemas and flows have stable URL parameters', () => {
  assert.equal(entityParam('schema'), 'schema')
  assert.equal(entityParam('flow'), 'flow')
})
