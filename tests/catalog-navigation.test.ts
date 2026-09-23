import { test } from 'node:test'
import assert from 'node:assert/strict'
import { catalogVersions, endpointGroup, filterCatalog, catalogSelection } from '../src/data/catalog-navigation.ts'

test('version choices include event contract versions absent from the declared HTTP version', () => {
  const versions = catalogVersions({ name: 'Facade', version: 'v1', versions: [{ id: 'v1', label: 'HTTP v1' }], endpoints: [
    { id: 'http', name: 'Accessories', method: 'GET', path: '/api/v1/Accessories', version: 'v1' },
    { id: 'event', name: 'Created', method: 'EVENT', path: 'product.created', version: 'proto3' },
    { id: 'health', name: 'Health', method: 'GET', path: '/health' },
  ] })
  assert.deepEqual(versions, [{ id: 'v1', label: 'HTTP v1' }, { id: 'proto3', label: 'proto3' }])
})

test('resource grouping ignores API/version prefixes without hiding event contracts', () => {
  const endpoint = { id: 'endpoint', name: 'Get', method: 'GET' as const, path: '/api/v1/Accessories/{id}' }
  assert.equal(endpointGroup(endpoint), 'Accessories')
  assert.equal(endpointGroup({ ...endpoint, path: '/api/MarketAuth/entries' }), 'MarketAuth')
  assert.equal(endpointGroup({ ...endpoint, method: 'EVENT', path: 'prod.public.pcf.marketauth' }), 'Event contracts')
  assert.equal(endpointGroup({ ...endpoint, path: '/' }), 'Other interfaces')
})

test('catalog search combines terms and group filters and never retains a hidden selection', () => {
  const entries = [
    { id: 'one', name: 'Get market authorization', group: 'MarketAuth', detail: '/api/MarketAuth', search: 'GET specMarket ModelYear' },
    { id: 'two', name: 'Get accessories', group: 'Accessories', detail: '/api/Accessories', search: 'GET Pno3' },
  ]
  assert.deepEqual(filterCatalog(entries, ' MODELyear  MARKET '), [entries[0]])
  assert.deepEqual(filterCatalog(entries, 'GET', 'Accessories'), [entries[1]])
  assert.deepEqual(filterCatalog(entries, 'ModelYear', 'Accessories'), [])
  assert.equal(catalogSelection(filterCatalog(entries, 'Accessories'), 'one')?.id, 'two')
  assert.equal(catalogSelection(filterCatalog(entries, 'missing'), 'one'), undefined)
})
