import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { inventory } from '../server/scan-inventory.ts'

test('scan inventory prioritizes project identity within a file budget and records exclusions', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groundwork-inventory-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const contents = {
    'package.json': '{"name":"example"}',
    'README.md': 'Project overview',
    'src/routes.ts': 'export const route = 1',
    'src/model.ts': 'export interface Model {}',
    'package-lock.json': '{"lockfileVersion":3}',
    'dist/generated.js': 'generated',
  }
  for (const [file, content] of Object.entries(contents)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), content)
  }
  const raw = Object.keys(contents).map(file => `100644 ${'a'.repeat(40)} 0\t${file}\0`).join('')
  const result = await inventory(root, { maxFiles: 2, maxBytes: 1024 }, raw)
  assert.deepEqual(result.files.map(file => file.path), ['package.json', 'README.md'])
  assert.deepEqual(result.excluded, { lockfile: 1, 'generated-or-vendored': 1, budget: 2 })
  assert.deepEqual(result.dependencyFingerprints.map(file => file.path), ['package.json', 'package-lock.json'])
  assert.equal(result.omittedDependencyFingerprints, 0)
})
