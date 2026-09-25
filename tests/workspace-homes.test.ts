import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encodeStorage, decodeStorage, encodeCatalogAt, decodeCatalogAt, physicalDocumentPattern } from '../server/catalog-storage.ts'

test('one current layout maps products, plans and component catalogs to their homes', () => {
  const files = {
    'products/app.json': '{"id":"app"}',
    'members/owner.json': '{"id":"owner"}',
    'features/feature/feature.json': '{"id":"feature"}',
    'components/api.json': '{"id":"api"}',
  }
  const physical = encodeStorage(files)
  assert.deepEqual(Object.keys(physical).sort(), [
    '.groundwork/catalog/components/api.json',
    '.groundwork/members/owner.json',
    '.groundwork/plans/features/feature/feature.json',
    '.groundwork/products/app.json',
  ])
  assert.deepEqual(decodeStorage(physical).files, files)
  assert.ok(Object.keys(physical).every(name => physicalDocumentPattern.test(name)))
  assert.equal(physicalDocumentPattern.test('.groundwork/plans/project.json'), false)
  assert.equal(physicalDocumentPattern.test('.groundwork/catalog/components/api/component.json'), false)
})

test('local catalog uses the same component document shape', () => {
  const files = { 'components/api.json': '{"id":"api"}' }
  const directory = '.groundwork/local-catalogs/github.com/acme/backend'
  const physical = encodeCatalogAt(files, directory)
  assert.deepEqual(decodeCatalogAt(physical, directory), files)
  assert.ok(Object.keys(physical).every(name => physicalDocumentPattern.test(name)))
})
