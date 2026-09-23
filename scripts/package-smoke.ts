import { mkdtemp, mkdir, cp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import assert from 'node:assert/strict'
const exec = promisify(execFile)
const base = await mkdtemp(path.join(tmpdir(), 'groundwork-package-'))
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const packageFile = path.resolve(process.argv[2] ?? `${manifest.name}-${manifest.version}.tgz`)
const run = async (cwd: string, program: string, args: string[]) => (await exec(program, args, { cwd, maxBuffer: 4 * 1024 * 1024 })).stdout
try {
  const source = path.join(base, 'source'), clone = path.join(base, 'clone')
  await mkdir(path.join(source, 'vendor'), { recursive: true })
  await cp(packageFile, path.join(source, 'vendor/groundwork.tgz'))
  await writeFile(path.join(source, 'package.json'), JSON.stringify({ name: 'package-smoke', private: true, devDependencies: { 'groundwork-v2': 'file:vendor/groundwork.tgz' } }))
  await run(source, 'npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'])
  const cli = ['node_modules/groundwork-v2/bin/groundwork-v2.js']
  await run(source, process.execPath, [...cli, 'init', '--name', 'Fresh clone'])
  const initial = JSON.parse(await run(source, process.execPath, [...cli, 'read']))
  await run(source, 'git', ['init', '-b', 'main'])
  await run(source, 'git', ['-c', 'user.name=Package test', '-c', 'user.email=test@example.invalid', 'add', '.'])
  await run(source, 'git', ['-c', 'user.name=Package test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'Portable planning fixture'])
  await run(base, 'git', ['clone', source, clone])
  await run(clone, 'npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'])
  const fresh = JSON.parse(await run(clone, process.execPath, [...cli, 'read']))
  assert.equal(fresh.manifest.id, initial.manifest.id)
  assert.equal(fresh.revision, initial.revision)
  assert.notEqual(fresh.context.checkoutId, initial.context.checkoutId)
  const { serve } = await import(path.join(clone, 'node_modules/groundwork-v2/runtime/server/http.js'))
  const app = await serve({ root: clone, port: 0 })
  try {
    // The only check that the packed, prebuilt viewer is served; npm test uses a stub page instead of dist/.
    const page = await fetch(app.url)
    assert.equal(page.status, 200)
    assert.match(await page.text(), /<div id="root">/)
    const snapshot = await (await fetch(app.url + '/api/snapshot')).json() as { plan: { manifest: { id: string } }; error: string | null }
    assert.equal(snapshot.plan.manifest.id, initial.manifest.id)
    assert.equal(snapshot.error, null)
  } finally { await app.close() }
  console.log('Package smoke passed: install, init, commit, fresh clone, npm ci, identical portable plans, independent checkout identity, compiled HTTP viewer.')
} finally { await rm(base, { recursive: true, force: true }) }
