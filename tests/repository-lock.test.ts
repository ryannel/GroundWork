import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Conflict, withLock } from '../server/repository.ts'

test('malformed write locks fail explicitly without running the protected operation', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groundwork-lock-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(path.join(root, '.groundwork'))
  await writeFile(path.join(root, '.groundwork/write.lock'), '{invalid')
  let ran = false
  await assert.rejects(withLock(root, async () => { ran = true }), error =>
    error instanceof Conflict && /Invalid lock file/.test(error.message))
  assert.equal(ran, false)
})
