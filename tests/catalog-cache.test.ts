import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { chmod, lstat, mkdtemp, readdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { readCatalogCache, refreshCatalogCache } from '../server/catalog-cache.ts'
import { git } from '../server/git.ts'
import { readPlan } from '../server/repository.ts'
import { initialise } from '../server/setup.ts'
import { commitAll, gitInit } from './helpers.ts'

async function makeWritable(target: string) {
  const info = await lstat(target).catch(() => null)
  if (!info) return
  if (info.isDirectory()) {
    await chmod(target, 0o700)
    for (const name of await readdir(target)) await makeWritable(path.join(target, name))
  } else if (info.isFile()) await chmod(target, 0o600)
}

async function testDir(t: TestContext, prefix: string) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), prefix)))
  t.after(async () => { await makeWritable(root); await rm(root, { recursive: true, force: true }) })
  return root
}

async function remoteFixture(t: TestContext) {
  const base = await testDir(t, 'groundwork-catalog-cache-')
  const source = await gitInit(path.join(base, 'source'))
  await initialise(source, { name: 'Cached catalog' })
  await writeFile(path.join(source, 'source.ts'), 'export const version = 1\n')
  const first = await commitAll(source, 'Initial catalog')
  await git(source, ['branch', 'recorded'])
  await writeFile(path.join(source, 'source.ts'), 'export const version = 2\n')
  const second = await commitAll(source, 'Default branch advances')
  await git(source, ['switch', 'recorded'])
  await writeFile(path.join(source, 'recorded.ts'), 'export const recorded = true\n')
  const recorded = await commitAll(source, 'Recorded divergent commit')
  await git(source, ['switch', 'main'])
  const sourceBlob = await git(source, ['rev-parse', `${second}:source.ts`])
  const remote = path.join(base, 'remote.git')
  await git(base, ['clone', '--bare', '--quiet', source, remote])
  await git(remote, ['config', 'uploadpack.allowFilter', 'true'])
  await git(remote, ['config', 'uploadpack.allowAnySHA1InWant', 'true'])
  return { base, source, remote, first, second, recorded, sourceBlob, cacheRoot: path.join(base, 'cache') }
}

test('explicit cache refresh fetches only validated Groundwork data and commit history without a checkout', async t => {
  const fixture = await remoteFixture(t)
  const fetchedAt = new Date('2026-09-25T08:00:00.000Z')
  const missing = 'f'.repeat(40)
  const entry = await refreshCatalogCache({
    repository: 'acme/cached', remote: fixture.remote, recordedCommits: [fixture.recorded, missing, fixture.recorded],
  }, { cacheRoot: fixture.cacheRoot, now: () => fetchedAt, allowUnverifiedLocalRemote: true })

  assert.equal(entry.status, 'ready')
  assert.equal(entry.defaultBranch, 'main')
  assert.equal(entry.ref, fixture.second)
  assert.equal(entry.fetchedAt, fetchedAt.toISOString())
  assert.equal(entry.source, 'hub-cache')
  assert.match(entry.sourceLabel, /main@.*fetched 2026-09-25/)
  assert.equal(entry.trust, 'untrusted')
  assert.deepEqual(entry.recordedCommits, [
    { revision: fixture.recorded, available: true },
    { revision: missing, available: false },
  ])
  assert.deepEqual(await readdir(entry.root), ['.git'], 'the cache has no source or Groundwork checkout')
  assert.equal((await stat(entry.root)).mode & 0o777, 0o500)
  assert.equal((await stat(path.join(entry.root, '.git'))).mode & 0o777, 0o500)
  assert.equal((await readPlan(entry.root, entry.ref)).manifest.name, 'Cached catalog')
  assert.equal(await git(entry.root, ['rev-list', '--count', entry.ref]), '2', 'default-branch history is present')
  assert.equal(await git(entry.root, ['cat-file', '-e', `${fixture.recorded}^{commit}`]).then(() => true, () => false), true)
  assert.equal(await git(entry.root, ['cat-file', '-e', fixture.sourceBlob]).then(() => true, () => false), false,
    'a source blob is not fetched while catalog documents are materialised')
  assert.equal(await git(entry.root, ['config', '--bool', 'remote.origin.promisor']), 'false', 'later reads cannot lazy-fetch')

  await rename(fixture.remote, fixture.remote + '.offline')
  const loaded = await readCatalogCache('ACME/CACHED', { cacheRoot: fixture.cacheRoot })
  assert.equal(loaded?.ref, entry.ref)
  assert.equal(loaded?.root, entry.root)
})

test('cache stays pinned until explicit refresh and a rejected refresh preserves the last valid entry', async t => {
  const fixture = await remoteFixture(t)
  const first = await refreshCatalogCache({ repository: 'acme/cached', remote: fixture.remote }, {
    cacheRoot: fixture.cacheRoot, now: () => new Date('2026-09-25T08:00:00.000Z'), allowUnverifiedLocalRemote: true,
  })
  await chmod(fixture.source, 0o700)
  await writeFile(path.join(fixture.source, 'source.ts'), 'export const version = 3\n')
  const newer = await commitAll(fixture.source, 'Remote advances again')
  await git(fixture.source, ['push', '--quiet', fixture.remote, 'main'])

  const stillPinned = await readCatalogCache('acme/cached', { cacheRoot: fixture.cacheRoot })
  assert.equal(stillPinned?.ref, first.ref)
  assert.equal(stillPinned?.fetchedAt, first.fetchedAt)
  const refreshed = await refreshCatalogCache({ repository: 'acme/cached', remote: fixture.remote }, {
    cacheRoot: fixture.cacheRoot, now: () => new Date('2026-09-25T09:00:00.000Z'), allowUnverifiedLocalRemote: true,
  })
  assert.equal(refreshed.ref, newer)
  assert.equal(refreshed.fetchedAt, '2026-09-25T09:00:00.000Z')

  await writeFile(path.join(fixture.source, '.groundwork/plans/project.json'), '{not json')
  await commitAll(fixture.source, 'Malformed untrusted catalog')
  await git(fixture.source, ['push', '--quiet', fixture.remote, 'main'])
  await assert.rejects(refreshCatalogCache({ repository: 'acme/cached', remote: fixture.remote }, {
    cacheRoot: fixture.cacheRoot, allowUnverifiedLocalRemote: true,
  }), /project\.json|JSON/)
  const preserved = await readCatalogCache('acme/cached', { cacheRoot: fixture.cacheRoot })
  assert.equal(preserved?.ref, newer)
  assert.equal(preserved?.fetchedAt, refreshed.fetchedAt)
})

test('a repository without Groundwork data is a missing cache result and unsafe remotes are refused', async t => {
  const base = await testDir(t, 'groundwork-catalog-cache-empty-')
  const source = await gitInit(path.join(base, 'source'))
  await writeFile(path.join(source, 'README.md'), 'source only\n')
  const revision = await commitAll(source, 'Source only')
  const remote = path.join(base, 'remote.git')
  await git(base, ['clone', '--bare', '--quiet', source, remote])
  await git(remote, ['config', 'uploadpack.allowFilter', 'true'])
  const cacheRoot = path.join(base, 'cache')
  const entry = await refreshCatalogCache({ repository: 'acme/empty', remote }, { cacheRoot, allowUnverifiedLocalRemote: true })
  assert.equal(entry.status, 'missing')
  assert.equal(entry.ref, revision)
  assert.deepEqual(await readdir(entry.root), ['.git'])
  assert.equal((await readCatalogCache('acme/empty', { cacheRoot }))?.status, 'missing')
  await assert.rejects(refreshCatalogCache({ repository: 'acme/unsafe', remote: 'ext::sh -c touch /tmp/nope' }, { cacheRoot }), /Git URL|Git URL or local path|local path/)
  await assert.rejects(refreshCatalogCache({ repository: 'acme/unsafe', remote: 'https://user:secret@example.com/repo.git' }, { cacheRoot }), /Remove credentials/)
  await assert.rejects(refreshCatalogCache({ repository: 'acme/unsafe', remote, recordedCommits: ['HEAD'] }, { cacheRoot, allowUnverifiedLocalRemote: true }))
  await assert.rejects(refreshCatalogCache({ repository: 'acme/not-empty', remote }, { cacheRoot }), /identifies .* not acme\/not-empty/)
  await assert.rejects(refreshCatalogCache({ repository: 'acme/expected', remote: 'https://github.com/acme/other.git' }, { cacheRoot }),
    /identifies acme\/other, not acme\/expected/)

  await git(remote, ['config', 'uploadpack.allowFilter', 'false'])
  await assert.rejects(refreshCatalogCache({ repository: 'acme/no-filter', remote }, {
    cacheRoot, allowUnverifiedLocalRemote: true,
  }), /treeless|ignored/)
})
