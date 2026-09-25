import { test } from 'node:test'
import assert from 'node:assert/strict'
import { navigationSearch } from '../src/data/navigation-search.ts'
import { loadContent } from '../shared/content.ts'
import { readContentDirectory } from '../server/content-files.ts'
import { fixturePath } from './helpers.ts'

const data = loadContent(await readContentDirectory(fixturePath('content')))
test('workspace search finds products, components and features without losing ownership', () => {
  const results = navigationSearch('pricing', data)
  assert.ok(results.some(item => item.id === 'product:p-pricing' && item.href === '/w/ecom/pricing'))
  assert.ok(results.some(item => item.id === 'component:c-pricing-api' && item.href.includes('/w/ecom/pricing?component=')))
  assert.ok(results.some(item => item.id === 'feature:f-1' && item.href === '/f/f-1'))
  assert.deepEqual(navigationSearch('   ', data), [])
  assert.deepEqual(navigationSearch('no-such-system-123', data), [])
})
test('internal component search opens its inspectable system boundary', () => {
  const product = data.products[0]!
  const parent = { id: 'service', repo: product.repositories![0].repository, name: 'Service', kind: 'service' as const, order: 0 }
  const child = { id: 'child', parentId: parent.id, repo: product.repositories![0].repository, name: 'Internal worker', kind: 'module' as const, order: 1 }
  const [result] = navigationSearch('Internal worker', { ...data, components: [parent, child] })
  assert.ok(result?.href.endsWith('?component=service#component-details'))
})
