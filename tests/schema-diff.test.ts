import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diffResponseSchema } from '../src/data/schema-diff.ts'

test('shows added, removed, updated and unchanged fields in their parent context', () => {
  const rows = diffResponseSchema({
    before: [{ name: 'id', type: 'string' }, { name: 'lines', type: 'array', fields: [{ name: 'tax', type: 'number' }, { name: 'legacy', type: 'string' }] }],
    after: [{ name: 'id', type: 'string' }, { name: 'lines', type: 'array', fields: [{ name: 'tax', type: 'number | null' }, { name: 'ruleId', type: 'string' }] }],
  })
  assert.equal(rows.find(r => r.key === '$.id')?.change, 'unchanged')
  assert.equal(rows.find(r => r.key === '$.lines')?.change, 'unchanged')
  assert.equal(rows.find(r => r.key === '$.lines.tax')?.before, 'tax: number')
  assert.equal(rows.find(r => r.key === '$.lines.tax')?.change, 'updated')
  assert.equal(rows.find(r => r.key === '$.lines.legacy')?.change, 'removed')
  assert.equal(rows.find(r => r.key === '$.lines.ruleId')?.change, 'added')
  assert.equal(rows.find(r => r.key === '$.lines:close')?.after, '}]')
})
test('reordering fields does not mark them changed; deletion retains its old position', () => {
  const fields = ['a', 'b', 'c'].map(name => ({ name, type: 'string' }))
  const rows = diffResponseSchema({ before: fields, after: [fields[2], fields[0]] }).filter(r => r.name)
  assert.deepEqual(rows.map(r => [r.name, r.change]), [['b', 'removed'], ['c', 'unchanged'], ['a', 'unchanged']])
})
test('new and deleted endpoints propagate changes into nested fields', () => {
  const fields = [{ name: 'data', type: 'object | null', fields: [{ name: 'id', type: 'string' }] }]
  for (const change of ['added', 'removed']) {
    const rows = diffResponseSchema(change === 'added' ? { after: fields } : { before: fields })
    assert.ok(rows.filter(r => r.name).every(r => r.change === change))
    assert.equal(rows.at(-2)?.after, '} | null')
  }
})
test('optional and container type changes retain old and new declarations', () => {
  const rows = diffResponseSchema({ before: [{ name: 'data', type: 'string' }], after: [{ name: 'data', type: 'object', optional: true, fields: [{ name: 'id', type: 'string' }] }] })
  assert.equal(rows[1].before, 'data: string')
  assert.equal(rows[1].after, 'data?: object')
  assert.ok(rows.some(r => r.name === 'id' && r.change === 'added'))
})
test('nullable objects show the changed closing type, not a false same-to-same diff', () => {
  const fields = [{ name: 'id', type: 'string' }]
  const rows = diffResponseSchema({ before: [{ name: 'data', type: 'object', fields }], after: [{ name: 'data', type: 'object | null', fields }] })
  assert.equal(rows.find(r => r.key === '$.data:close')?.before, '}')
  assert.equal(rows.find(r => r.key === '$.data:close')?.after, '} | null')
})
