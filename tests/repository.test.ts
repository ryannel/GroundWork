import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { chmod, mkdir, readFile, rm, stat, writeFile, lstat } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { initialise, installInstructions } from '../server/setup.ts'
import {
  atomicFile, readPlan, readStorageFiles, recover, withTransaction, writePlan, Conflict,
} from '../server/repository.ts'
import { validateTransition } from '../server/transitions.ts'
import { parseBrief, renderBrief, briefProblem } from '../server/format.ts'
import { InvalidInput } from '../server/errors.ts'
import { context, discover, git, GitError } from '../server/git.ts'
import { operate } from '../server/operations.ts'
import { commitAll, gitInit, guard, tempDir as temp } from './helpers.ts'

async function fixture(t: TestContext) {
  const root = await temp(t)
  await initialise(root, { name: 'Repository tests' })
  return root
}
const owner = '.groundwork/members/owner.json'
const exists = (file: string) => lstat(file).then(() => true, () => false)

test('an external edit found before writing refuses cleanly and leaves no journal', async t => {
  const root = await fixture(t)
  const before = await readStorageFiles(root)
  const after = { ...before, [owner]: JSON.stringify({ id: 'owner', name: 'Groundwork write' }) }
  await writeFile(path.join(root, owner), JSON.stringify({ id: 'owner', name: 'Editor' }))
  await assert.rejects(withTransaction(root, commit => commit(before, after)), error =>
    error instanceof Conflict && /External edit detected/.test(error.message))
  assert.equal(await exists(path.join(root, '.groundwork/transaction.json')), false)
  assert.equal((await readPlan(root)).snapshot.members[0].name, 'Editor')
})

test('a failed write rolls back only what it wrote and removes its journal', async t => {
  const root = await fixture(t)
  const storage = await readStorageFiles(root)
  // `before` claims the catalog holds only owner.json, so the post-write consistency check fails.
  const before = { [owner]: storage[owner] }
  const after = { [owner]: JSON.stringify({ id: 'owner', name: 'Rolled back' }) }
  await assert.rejects(withTransaction(root, commit => commit(before, after)), /Storage changed during the write/)
  assert.equal(await readFile(path.join(root, owner), 'utf8'), storage[owner])
  assert.equal(await exists(path.join(root, '.groundwork/transaction.json')), false)
  assert.deepEqual(await readStorageFiles(root), storage)
})

test('a journal of changed paths recovers an interrupted write', async t => {
  const root = await fixture(t)
  const plan = await readPlan(root)
  const before = await readStorageFiles(root)
  const changed = JSON.stringify({ id: 'owner', name: 'Half written' })
  const journal = { paths: [owner], before: { [owner]: before[owner] }, after: { [owner]: changed } }
  await writeFile(path.join(root, '.groundwork/transaction.json'), JSON.stringify(journal))
  await writeFile(path.join(root, owner), changed)
  await assert.rejects(readPlan(root), /pending/)
  await recover(root)
  assert.equal((await readPlan(root)).revision, plan.revision)
})

test('temp files left by an interrupted write are ignored by readers and removed by recover', async t => {
  const root = await fixture(t)
  const leftovers = [`${owner}.${randomUUID()}.tmp`, `.groundwork/products/app.json.${randomUUID()}.tmp`]
  for (const name of leftovers) await writeFile(path.join(root, name), '{"partial":')
  const plan = await readPlan(root)
  await writePlan(root, { ...guard(plan), changes: {
    'members/owner.json': JSON.stringify({ id: 'owner', name: 'Still writable' }),
  } })
  await recover(root)
  for (const name of leftovers) assert.equal(await exists(path.join(root, name)), false)
  assert.equal((await readPlan(root)).snapshot.members[0].name, 'Still writable')
})

test('readPlan waits for a short write instead of failing at once', async t => {
  const root = await fixture(t)
  const lock = path.join(root, '.groundwork/write.lock')
  await writeFile(lock, JSON.stringify({ pid: process.pid, host: os.hostname(), nonce: 'test' }))
  setTimeout(() => { void rm(lock) }, 80)
  assert.equal((await readPlan(root)).snapshot.products[0].name, 'Repository tests')
})

test('writes keep file modes, use the default mode for new files and 0600 only when asked', async t => {
  const root = await temp(t)
  const umask = process.umask()
  await writeFile(path.join(root, 'script.sh'), 'old')
  await chmod(path.join(root, 'script.sh'), 0o755)
  await atomicFile(root, 'script.sh', 'new')
  assert.equal((await stat(path.join(root, 'script.sh'))).mode & 0o777, 0o755)
  await atomicFile(root, 'fresh.txt', 'data')
  assert.equal((await stat(path.join(root, 'fresh.txt'))).mode & 0o777, 0o666 & ~umask)
  await atomicFile(root, 'private.json', '{}', 0o600)
  assert.equal((await stat(path.join(root, 'private.json'))).mode & 0o777, 0o600)
})

test('instruction refresh keeps user file modes and leaves an unchanged .gitignore alone', async t => {
  const root = await temp(t)
  for (const name of ['AGENTS.md', 'package.json', '.gitignore']) {
    await writeFile(path.join(root, name), name === 'package.json' ? '{}\n' : '# existing\n')
    await chmod(path.join(root, name), 0o644)
  }
  await installInstructions(root)
  for (const name of ['AGENTS.md', 'package.json', '.gitignore']) assert.equal((await stat(path.join(root, name))).mode & 0o777, 0o644, name)
  const ignored = await stat(path.join(root, '.gitignore'))
  await new Promise(resolve => setTimeout(resolve, 20))
  await installInstructions(root)
  assert.equal((await stat(path.join(root, '.gitignore'))).mtimeMs, ignored.mtimeMs)
})

test('initialise skips hidden asset files, rejects unsupported ones and never leaves an unreadable plan', async t => {
  const base = await temp(t)
  const assets = path.join(base, 'images')
  await mkdir(path.join(assets, 'screens'), { recursive: true })
  await writeFile(path.join(assets, 'screens/shot.png'), Buffer.from([137, 80, 78, 71]))
  await writeFile(path.join(assets, '.DS_Store'), 'finder')
  const good = path.join(base, 'good')
  await initialise(good, { name: 'Assets', assets })
  await readPlan(good)
  assert.equal(await exists(path.join(good, '.groundwork/plans/assets/screens/shot.png')), true)
  assert.equal(await exists(path.join(good, '.groundwork/plans/assets/.DS_Store')), false)
  await writeFile(path.join(assets, 'diagram.svg'), '<svg/>')
  const bad = path.join(base, 'bad')
  await assert.rejects(initialise(bad, { name: 'Assets', assets }), /Unsupported asset diagram.svg/)
  assert.equal(await exists(path.join(bad, '.groundwork/plans')), false)
  // Documents that parse but reference a missing asset are caught by reading the result back.
  const plan = await readPlan(good)
  await operate('create_feature', { id: 'shots', title: 'Shots', productId: 'app', ownerId: 'owner', problem: 'P', outcome: 'O',
    ...guard(plan) }, good)
  const files = { ...(await readPlan(good)).files,
    'features/shots/design.json': JSON.stringify({ mockups: [{ id: 'screen', title: 'Screen', kind: 'image', ref: 'assets/missing.png' }] }) }
  const unreadable = path.join(base, 'unreadable')
  await assert.rejects(initialise(unreadable, { files }), /Missing raster asset/)
  assert.equal(await exists(path.join(unreadable, '.groundwork/plans')), false)
})

test('validateTransition enforces current document rules without touching disk', async t => {
  const root = await fixture(t)
  const { files } = await readPlan(root)
  assert.throws(() => validateTransition(files, {}), error => error instanceof InvalidInput && /No changes/.test(error.message))
  assert.throws(() => validateTransition(files, { '../escape.json': '{}' }), InvalidInput)
  assert.throws(() => validateTransition(files, { 'members/big.json': 'x'.repeat(2 * 1024 * 1024 + 1) }), /exceeds 2 MB/)
  const { after, plan } = validateTransition(files, { 'members/owner.json': JSON.stringify({ id: 'owner', name: 'Next' }) })
  assert.equal(plan.snapshot.members[0].name, 'Next')
  assert.notEqual(after, files)
  assert.equal(JSON.parse(files['members/owner.json']).name, 'Project owner')
})

test('renderBrief is the inverse of parseBrief, and refuses text it cannot round-trip', () => {
  const pieces = ['plain', 'with # hash', '- dash', '{tests: x}', '[id] text', '## heading', 'line\nbreak', '  padded  ', 'a {b}', '`code`']
  let seed = 7
  const pick = () => pieces[(seed = (seed * 48271) % 2147483647) % pieces.length]
  const sentence = () => `${pick()} ${pick()}`.trim()
  let refused = 0, checked = 0
  for (let i = 0; i < 300; i++) {
    const purpose = {
      problem: sentence(), outcome: sentence(), nonGoals: [sentence(), sentence()],
      success: [{ id: `c${i}`, text: sentence(), ...(i % 2 ? { tests: ['unit-a', 'unit_b'] } : {}) }],
    }
    if (briefProblem(purpose)) {
      refused++
      assert.throws(() => renderBrief(purpose), InvalidInput)
      continue
    }
    checked++
    const trim = (value: string) => value.trim()
    assert.deepEqual(parseBrief(renderBrief(purpose)), {
      ...purpose, problem: purpose.problem.trim(), outcome: purpose.outcome.trim(), nonGoals: purpose.nonGoals.map(trim),
      success: purpose.success.map(item => ({ ...item, text: item.text.trim() })),
    })
  }
  assert.ok(refused > 0 && checked > 0)
  assert.throws(() => renderBrief({ problem: 'P\n## Outcome', outcome: 'O' }), /Problem: a line cannot start/)
  assert.throws(() => renderBrief({ problem: 'P', outcome: 'O', nonGoals: ['one\ntwo'] }), /Non-goals: each item must be a single line/)
})

test('discover skips worktrees whose directory is gone; context reads branch and head', async t => {
  const root = await temp(t)
  await gitInit(root)
  await commitAll(root, 'Start')
  const ctx = await context(root)
  assert.equal(ctx.branch, 'main')
  assert.match(ctx.head!, /^[0-9a-f]{40}$/)
  const worktree = path.join(root, 'gone')
  await git(root, ['worktree', 'add', '-b', 'feature/gone', worktree])
  assert.equal((await context(worktree)).branch, 'feature/gone')
  assert.equal((await discover(root)).length, 2)
  await rm(worktree, { recursive: true, force: true })
  assert.deepEqual((await discover(root)).map(item => item.root), [ctx.root])
  await git(root, ['checkout', '--detach'])
  assert.equal((await context(root)).branch, null)
  await assert.rejects(git(root, ['rev-parse', '--verify', 'missing-ref']), error =>
    error instanceof GitError && error.message.length < 120 && !error.message.includes('core.hooksPath'))
})

test('an unborn branch still has a context', async t => {
  const root = await temp(t)
  await git(root, ['init', '-b', 'trunk'])
  const ctx = await context(root)
  assert.deepEqual([ctx.isGit, ctx.branch, ctx.head], [true, 'trunk', null])
})
