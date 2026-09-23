import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile, appendFile, readdir } from 'node:fs/promises'
import { spawn, spawnSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { Conflict, withLock } from '../server/repository.ts'

async function workspace(t: { after: (fn: () => Promise<void>) => void }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groundwork-lock-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(path.join(root, '.groundwork'))
  return root
}
const lockFile = (root: string) => path.join(root, '.groundwork/write.lock')
/** A PID that belonged to a process which has already exited. */
const deadPid = () => spawnSync(process.execPath, ['-e', '']).pid!

test('malformed write locks fail explicitly without running the protected operation', async t => {
  const root = await workspace(t)
  await writeFile(lockFile(root), '{invalid')
  let ran = false
  await assert.rejects(withLock(root, async () => { ran = true }), error =>
    error instanceof Conflict && /Invalid lock file/.test(error.message))
  assert.equal(ran, false)
})

test('contended acquisitions wait instead of seeing a half-written lock, and never overlap', async t => {
  const root = await workspace(t)
  let inside = 0, overlaps = 0, entered = 0
  for (let round = 0; round < 10; round++) {
    const results = await Promise.allSettled(Array.from({ length: 4 }, () => withLock(root, async () => {
      inside++; entered++
      if (inside > 1) overlaps++
      await new Promise(resolve => setImmediate(resolve))
      inside--
    })))
    assert.deepEqual(results.filter(result => result.status === 'rejected'), [])
  }
  assert.equal(entered, 40)
  assert.equal(overlaps, 0)
  assert.deepEqual((await readdir(path.join(root, '.groundwork'))).filter(name => name.startsWith('write.lock')), [])
})

test('a lock left by a dead process is broken once, even by two waiters at the same time', async t => {
  const root = await workspace(t)
  await writeFile(lockFile(root), JSON.stringify({ pid: deadPid(), host: os.hostname(), nonce: 'crashed' }))
  let inside = 0, overlaps = 0
  const guarded = () => withLock(root, async () => {
    if (++inside > 1) overlaps++
    await new Promise(resolve => setTimeout(resolve, 5))
    inside--
  })
  await Promise.all([guarded(), guarded(), guarded()])
  assert.equal(overlaps, 0)
  // Locks written before nonces existed are still recognised.
  await writeFile(lockFile(root), JSON.stringify({ pid: deadPid() }))
  assert.equal(await withLock(root, async () => 'ran'), 'ran')
})

test('release removes only the lock this holder created', async t => {
  const root = await workspace(t)
  const foreign = JSON.stringify({ pid: process.pid, host: os.hostname(), nonce: 'someone-else' })
  await withLock(root, async () => { await writeFile(lockFile(root), foreign) })
  assert.equal(await readFile(lockFile(root), 'utf8'), foreign)
})

test('separate processes exclude each other', { timeout: 30000 }, async t => {
  const root = await workspace(t)
  const log = path.join(root, 'log')
  const worker = `
    import { withLock } from './server/repository.ts'
    import { appendFile } from 'node:fs/promises'
    const [root, log, id] = process.argv.slice(1)
    for (let i = 0; i < 15; i++) await withLock(root, async () => {
      await appendFile(log, 'enter ' + id + '\\n')
      await new Promise(resolve => setTimeout(resolve, 2))
      await appendFile(log, 'exit ' + id + '\\n')
    })`
  await appendFile(log, '')
  await Promise.all(['a', 'b', 'c'].map(id => new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', worker, root, log, id], { cwd: path.resolve('.'), stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject)
    child.on('exit', code => code ? reject(new Error(stderr)) : resolve())
  })))
  const lines = (await readFile(log, 'utf8')).trim().split('\n')
  assert.equal(lines.length, 90)
  for (let i = 0; i < lines.length; i += 2) {
    assert.match(lines[i], /^enter /)
    assert.equal(lines[i + 1], lines[i].replace('enter', 'exit'))
  }
})
