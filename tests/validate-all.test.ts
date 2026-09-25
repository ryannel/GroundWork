import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { validateAllHomes, validateClonedPaths, validateCrossHomeOwnership } from '../server/validate-all.ts'
import { main } from '../server/cli.ts'
import { initialise } from '../server/setup.ts'
import { git } from '../server/git.ts'
import { commitAll, gitInit, tempDir } from './helpers.ts'

const product = (id: string, repository: string, paths: string[]) => ({
  id, slug: id, name: id, kind: 'service-system' as const,
  repositories: [{ repository, role: 'owned' as const, paths }],
})

test('validate --all covers a home discovered in a linked default-branch worktree', async t => {
  const base = await tempDir(t, 'groundwork-validate-worktree-')
  const config = path.join(base, 'config')
  const main = await gitInit(path.join(base, 'main'))
  const side = path.join(base, 'side')
  await git(main, ['remote', 'add', 'origin', 'git@github.com:acme/worktree-home.git'])
  await commitAll(main, 'Base')
  await git(main, ['worktree', 'add', '-q', '-b', 'side', side])
  await initialise(main, { name: 'Worktree Home' })
  await mkdir(config)
  await writeFile(path.join(config, 'registry-v3.json'), JSON.stringify({
    version: 3, checkouts: { 'acme/worktree-home': [side] }, workspaces: [],
  }))
  const previous = process.env.GROUNDWORK_HOME
  process.env.GROUNDWORK_HOME = config
  t.after(() => { if (previous === undefined) delete process.env.GROUNDWORK_HOME; else process.env.GROUNDWORK_HOME = previous })
  const result = await validateAllHomes()
  assert.deepEqual(result.coveredHomes.map(item => item.repository), ['acme/worktree-home'])
  assert.equal(result.coveredHomes[0].root, main)
})

test('validate --all detects shared repository ownership declared by separate homes', async t => {
  const base = await tempDir(t, 'groundwork-validate-legacy-overlap-')
  const config = path.join(base, 'config')
  const checkouts: Record<string, string[]> = {}
  for (const id of ['one', 'two']) {
    const root = await gitInit(path.join(base, id))
    await git(root, ['remote', 'add', 'origin', `git@github.com:acme/${id}.git`])
    await initialise(root, { name: id })
    const file = path.join(root, `.groundwork/products/${id}.json`)
    const product = JSON.parse(await readFile(file, 'utf8'))
    product.repositories.push({ repository: 'acme/shared', role: 'owned' })
    await writeFile(file, JSON.stringify(product))
    checkouts[`acme/${id}`] = [root]
  }
  await mkdir(config)
  await writeFile(path.join(config, 'registry-v3.json'), JSON.stringify({ version: 3, checkouts, workspaces: [] }))
  const previous = process.env.GROUNDWORK_HOME
  process.env.GROUNDWORK_HOME = config
  t.after(() => { if (previous === undefined) delete process.env.GROUNDWORK_HOME; else process.env.GROUNDWORK_HOME = previous })
  const result = await validateAllHomes()
  assert.deepEqual(result.coveredHomes.map(item => item.repository), ['acme/one', 'acme/two'])
  assert.equal(result.valid, false)
  assert.match(result.issues[0], /overlapping ownership of acme\/shared/)
})

test('cross-home validation compares ownership by repository and reports the homes it checked', async t => {
  assert.match(validateCrossHomeOwnership([
    { repository: 'acme/home-a', root: '/a', products: [product('api', 'acme/mono', ['services/api'])] },
    { repository: 'acme/home-b', root: '/b', products: [product('api', 'acme/mono', ['services/api/internal'])] },
  ])[0], /overlapping ownership/)
  assert.deepEqual(validateCrossHomeOwnership([
    { repository: 'acme/home-a', root: '/a', products: [product('api', 'acme/mono', ['services/api'])] },
    { repository: 'acme/home-b', root: '/b', products: [product('api', 'acme/mono', ['services/web'])] },
  ]), [])

  const base = await tempDir(t, 'groundwork-validate-all-')
  const config = path.join(base, 'config')
  const home = await gitInit(path.join(base, 'home'))
  const source = await gitInit(path.join(base, 'source'))
  await git(home, ['remote', 'add', 'origin', 'git@github.com:acme/home.git'])
  await git(source, ['remote', 'add', 'origin', 'git@github.com:acme/source.git'])
  await initialise(home, { name: 'Home' })
  await mkdir(config)
  await writeFile(path.join(config, 'registry-v3.json'), JSON.stringify({
    version: 3, checkouts: { 'acme/home': [home], 'acme/source': [source] }, workspaces: [],
  }))
  const previous = process.env.GROUNDWORK_HOME
  process.env.GROUNDWORK_HOME = config
  t.after(() => { if (previous === undefined) delete process.env.GROUNDWORK_HOME; else process.env.GROUNDWORK_HOME = previous })
  const result = await validateAllHomes()
  assert.equal(result.valid, true)
  assert.deepEqual(result.coveredHomes.map(item => item.repository), ['acme/home'])
  assert.deepEqual(result.sourceOnly, [source])
  assert.deepEqual(result.issues, [])
  const output: string[] = []
  await main(['validate', '--all'], line => output.push(line))
  assert.deepEqual(JSON.parse(output[0]).coveredHomes.map((item: { repository: string }) => item.repository), ['acme/home'])
  const declared = [{ repository: 'acme/home', root: home, products: [product('api', 'acme/source', ['services/typo'])] }]
  const clones = new Map([['acme/source', source]])
  assert.match((await validateClonedPaths(declared, clones))[0], /path services\/typo does not exist/)
  await mkdir(path.join(source, 'services/typo'), { recursive: true })
  assert.deepEqual(await validateClonedPaths(declared, clones), [])
  assert.deepEqual(await validateClonedPaths(declared, new Map()), [], 'an uncloned repository is not a path error')
})

test('validation warns when a home has only a provisional repository identity', async t => {
  const base = await tempDir(t, 'groundwork-validate-provisional-')
  const config = path.join(base, 'config')
  const home = await gitInit(path.join(base, 'home'))
  await initialise(home, { name: 'Home' })
  const output: string[] = []
  await main(['validate', home], line => output.push(line))
  const single = JSON.parse(output[0])
  assert.equal(single.valid, true)
  assert.match(single.warnings[0], /provisional identity/)

  await mkdir(config)
  await writeFile(path.join(config, 'registry-v3.json'), JSON.stringify({
    version: 3, checkouts: { 'local:home': [home] }, workspaces: [],
  }))
  const previous = process.env.GROUNDWORK_HOME
  process.env.GROUNDWORK_HOME = config
  t.after(() => { if (previous === undefined) delete process.env.GROUNDWORK_HOME; else process.env.GROUNDWORK_HOME = previous })
  const all = await validateAllHomes()
  assert.equal(all.valid, true)
  assert.match(all.warnings[0].warning, /provisional identity/)
  assert.equal(all.warnings[0].root, home)
})
