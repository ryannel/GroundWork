import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { FILE_SIZE_LIMIT, inventory, parseTree, type TreeEntry } from '../server/scan-inventory.ts'

function tree(contents: Record<string, string | Buffer>, sizes: Record<string, number> = {}) {
  const blobs = new Map<string, Buffer>()
  const entries: TreeEntry[] = Object.entries(contents).map(([file, content]) => {
    const bytes = Buffer.from(content)
    const digest = createHash('sha1').update(file).digest('hex')
    blobs.set(digest, bytes)
    return { mode: '100644', digest, bytes: sizes[file] ?? bytes.length, path: file }
  })
  const requested: string[] = []
  const read = async (digests: string[]) => {
    requested.push(...digests)
    return new Map(digests.map(digest => [digest, blobs.get(digest)!]))
  }
  const pathOf = (digest: string) => entries.find(entry => entry.digest === digest)!.path
  return { entries, read, requested: () => requested.map(pathOf) }
}

test('scan inventory prioritizes project identity within a file budget and records exclusions', async () => {
  const { entries, read } = tree({
    'package.json': '{"name":"example"}',
    'README.md': 'Project overview',
    'src/routes.ts': 'export const route = 1',
    'src/model.ts': 'export interface Model {}',
    'package-lock.json': '{"lockfileVersion":3}',
    'dist/generated.js': 'generated',
  })
  const result = await inventory(entries, { maxFiles: 2, maxBytes: 1024 }, read)
  assert.deepEqual(result.files.map(file => file.path), ['package.json', 'README.md'])
  assert.equal(result.contents.get('package.json')?.toString(), '{"name":"example"}')
  assert.deepEqual(result.excluded, { lockfile: 1, 'generated-or-vendored': 1, budget: 2 })
  assert.deepEqual(result.dependencyFingerprints.map(file => file.path), ['package.json', 'package-lock.json'])
  assert.equal(result.omittedDependencyFingerprints, 0)
})

test('inventory filters by path and size before reading, and reads only files that can still fit', async () => {
  const { entries, read, requested } = tree({
    'package.json': '{}',
    'src/big.ts': 'x',
    'src/0binary.ts': Buffer.from([0, 1, 2]),
    'src/a.ts': 'a',
    'src/b.ts': 'b',
    'src/c.ts': 'c',
  }, { 'src/big.ts': FILE_SIZE_LIMIT + 1 })
  const result = await inventory(entries, { maxFiles: 3, maxBytes: 1024 }, read)
  // The binary file is sniffed out, so the budget still admits the next file in priority order.
  assert.deepEqual(result.files.map(file => file.path), ['package.json', 'src/a.ts', 'src/b.ts'])
  assert.deepEqual(result.excluded, { oversized: 1, binary: 1, budget: 1 })
  assert.ok(!requested().includes('src/big.ts'))
  assert.ok(!requested().includes('src/c.ts'))
})

test('agent instruction files are excluded at any depth', async () => {
  const { entries, read } = tree({
    'AGENTS.md': 'root', 'packages/api/CLAUDE.md': 'nested', '.cursorrules': 'rules', '.windsurfrules': 'rules',
    'docs/.github/copilot-instructions.md': 'nested', 'packages/api/.cursor/rules/style.mdc': 'rules', 'src/agents.ts': 'code',
  })
  const result = await inventory(entries, { maxFiles: 100, maxBytes: 1024 * 1024 }, read)
  assert.deepEqual(result.files.map(file => file.path), ['src/agents.ts'])
  assert.equal(result.excluded['agent-instructions'], 6)
})

test('ls-tree output parses modes, object IDs, padded sizes and submodules', () => {
  const sha = 'a'.repeat(40)
  const raw = [`100644 blob ${sha}      12\tsrc/a b.ts`, `160000 commit ${sha}       -\tvendor/lib`, `120000 blob ${sha}       9\tlink`, ''].join('\0')
  assert.deepEqual(parseTree(raw), [
    { mode: '100644', digest: sha, bytes: 12, path: 'src/a b.ts' },
    { mode: '160000', digest: sha, bytes: 0, path: 'vendor/lib' },
    { mode: '120000', digest: sha, bytes: 9, path: 'link' },
  ])
  assert.throws(() => parseTree('garbage\0'), /unsupported file inventory/)
})
