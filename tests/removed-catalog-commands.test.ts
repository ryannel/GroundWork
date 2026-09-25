import { test } from 'node:test'
import assert from 'node:assert/strict'
import { main, UsageError } from '../server/cli.ts'
import { operationNames } from '../server/operations.ts'

test('cache and catalog proposal commands are absent from the public API', async () => {
  for (const name of ['cache-status', 'cache-refresh']) {
    await assert.rejects(main([name]), UsageError)
  }
  for (const name of ['read_catalog_cache', 'refresh_catalog_cache', 'propose_local_catalog']) {
    assert.equal(operationNames.includes(name as never), false)
  }
})
