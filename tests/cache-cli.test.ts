import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { main } from '../server/cli.ts'
import { operate, operationAnnotations } from '../server/operations.ts'
import { tempDir, withEnv } from './helpers.ts'

test('cache CLI reports an absent cache without fetching', async t => {
  const base = await tempDir(t, 'groundwork-cache-cli-')
  withEnv(t, { GROUNDWORK_HOME: path.join(base, 'config') })
  const output: string[] = []
  await main(['cache-status', '--repository', 'acme/missing'], line => output.push(line))
  assert.deepEqual(output, ['null'])
})

test('cache operations expose a read-only status and an explicit network refresh', async t => {
  const base = await tempDir(t, 'groundwork-cache-op-')
  withEnv(t, { GROUNDWORK_HOME: path.join(base, 'config') })
  assert.equal(await operate('read_catalog_cache', { repository: 'acme/missing' }), null)
  assert.equal(operationAnnotations('read_catalog_cache').readOnlyHint, true)
  assert.equal(operationAnnotations('refresh_catalog_cache').openWorldHint, true)
})
