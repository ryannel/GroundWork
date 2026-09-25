import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { rankClones } from '../server/clone-rank.ts'
import { git } from '../server/git.ts'
import { commitAll, gitInit, tempDir } from './helpers.ts'

test('clone choice compares local default branches and exposes disagreement', async t => {
  const base = await tempDir(t, 'groundwork-clone-rank-')
  const a = await gitInit(path.join(base, 'a'))
  await commitAll(a, 'Base')
  const b = path.join(base, 'b')
  await git(base, ['clone', '-q', a, b])
  await commitAll(b, 'Newer default branch')
  const candidates = [
    { root: a, checkoutId: 'a', repository: 'acme/shared' },
    { root: b, checkoutId: 'b', repository: 'acme/shared' },
  ]
  const descendant = (await rankClones(candidates)).get('acme/shared')!
  assert.equal(descendant.preferredCheckoutId, 'b')
  assert.equal(descendant.disagreement?.status, 'different')
  for (let n = 0; n < 8; n++) await commitAll(a, `A ${n}`)
  const divergent = (await rankClones(candidates)).get('acme/shared')!
  assert.equal(divergent.preferredCheckoutId, 'a', 'a longer default branch wins when histories cannot be ordered')
  assert.ok(divergent.disagreement)
  assert.deepEqual(divergent.disagreement?.heads.map(item => item.root), [a, b])
})
