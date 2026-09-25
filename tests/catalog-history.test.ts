import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { writeFile } from 'node:fs/promises'
import { buildRevisionHistory, coveredPathsKey, coveredTreeId } from '../server/catalog-history.ts'
import { git } from '../server/git.ts'
import { commitAll, gitInit, tempDir } from './helpers.ts'

test('catalog history orders commits and recognises equivalent covered trees after a squash', async t => {
  const base = await tempDir(t, 'groundwork-catalog-history-')
  const root = await gitInit(path.join(base, 'source'))
  await writeFile(path.join(root, 'api.ts'), 'v1\n')
  const first = await commitAll(root)
  await git(root, ['checkout', '-q', '-b', 'local'])
  await writeFile(path.join(root, 'api.ts'), 'v2\n')
  const local = await commitAll(root, 'Local scan')
  await git(root, ['checkout', '-q', 'main'])
  await writeFile(path.join(root, 'api.ts'), 'v2\n')
  await writeFile(path.join(root, 'other.ts'), 'different commit\n')
  const main = await commitAll(root, 'Squash equivalent')
  const tree = { id: await coveredTreeId(root, local, ['api.ts']), coveredPathsKey: coveredPathsKey(['api.ts']) }
  assert.equal(await coveredTreeId(root, main, ['api.ts']), tree.id)
  const history = await buildRevisionHistory(root, [first, local, '0'.repeat(40)], [tree], 'refs/heads/main')
  assert.equal(history.relation(first, main), 'ancestor')
  assert.equal(history.relation(main, first), 'descendant')
  assert.equal(history.relation(local, main), 'diverged')
  assert.equal(history.relation('0'.repeat(40), main), 'unknown')
  assert.equal(history.defaultBranchRevision?.(tree), main)
})
