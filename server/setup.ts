import { mkdir, readFile, readdir, cp, rename, rm, lstat } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { PLAN_DIRECTORY, manifestSchema, parsePlan, renderBrief, type Files } from './format.ts'
import { atomicFile, safePath, withLock } from './repository.ts'
import { readContentDirectory } from '../scripts/content-files.ts'
import { loadContent } from '../src/data/content.ts'

// The same source runs under Node's TS support in development and as compiled JS in the package.
export const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), import.meta.url.includes('/runtime/') ? '../..' : '..')
export async function installInstructions(root: string) {
  const guide = await readFile(path.join(packageRoot, 'docs/PORTABLE.md'), 'utf8')
  await atomicFile(root, '.groundwork/GUIDE.md', guide)
  for (const file of await readdir(path.join(packageRoot, 'schemas'))) {
    if (file.endsWith('.json')) await atomicFile(root, `.groundwork/schemas/${file}`, await readFile(path.join(packageRoot, 'schemas', file), 'utf8'))
  }
  const catalogSkill = path.join(packageRoot, '.agents/skills/groundwork-system-catalog')
  await atomicFile(root, '.agents/skills/groundwork-system-catalog/SKILL.md', await readFile(path.join(catalogSkill, 'SKILL.md'), 'utf8'))
  for (const file of await readdir(path.join(catalogSkill, 'references'))) {
    if (file.endsWith('.md')) await atomicFile(root, `.agents/skills/groundwork-system-catalog/references/${file}`, await readFile(path.join(catalogSkill, 'references', file), 'utf8'))
  }
  const packageFile = await safePath(root, 'package.json')
  const packageText = await readFile(packageFile, 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error })
  if (packageText) {
    const pkg = JSON.parse(packageText)
    pkg.scripts ??= {}
    let changed = false
    for (const [name, command] of Object.entries({ 'plans:start': 'groundwork-v2 start', 'plans:standalone': 'groundwork-v2 serve', 'plans:hub': 'groundwork-v2 hub' })) {
      if (!(name in pkg.scripts)) { pkg.scripts[name] = command; changed = true }
    }
    if (changed) await atomicFile(root, 'package.json', JSON.stringify(pkg, null, 2) + '\n')
  }
  const instruction = 'For Groundwork planning, read [.groundwork/GUIDE.md](.groundwork/GUIDE.md). Use the installed `groundwork-v2` CLI or MCP server and preserve checkout context and revision checks.'
  for (const name of ['AGENTS.md', 'CLAUDE.md']) {
    const file = await safePath(root, name)
    const before = await readFile(file, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error })
    if (!before.includes('](.groundwork/GUIDE.md)')) await atomicFile(root, name, before + `\n\n## Groundwork planning\n\n${instruction}\n`)
  }
  const ignoreFile = await safePath(root, '.gitignore')
  let ignore = await readFile(ignoreFile, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error })
  for (const entry of ['node_modules/', '.groundwork/write.lock', '.groundwork/transaction.json', '.groundwork/init-*', '.groundwork/**/*.tmp']) if (!ignore.split('\n').includes(entry)) ignore += `\n${entry}\n`
  await atomicFile(root, '.gitignore', ignore)
}
export async function initialise(root: string, options: { name?: string; id?: string; domain?: string; files?: Files; assets?: string } = {}) {
  await mkdir(root, { recursive: true })
  return withLock(root, async () => {
    if (await lstat(await safePath(root, '.groundwork/project.json')).catch(() => null)) throw new Error('Catalog already exists; initialisation never overwrites it')
    const target = await safePath(root, PLAN_DIRECTORY)
    if (await lstat(target).catch(() => null)) throw new Error('Plans already exist. Initialisation never overwrites an existing plan directory.')
    const manifest = manifestSchema.parse({ schemaVersion: 2, id: options.id ?? randomUUID(), name: options.name ?? path.basename(root), ...(options.domain ? { domain: options.domain } : {}) })
    const files = options.files ?? {
      'project.json': JSON.stringify(manifest, null, 2) + '\n',
      'products/app.json': JSON.stringify({ id: 'app', slug: 'app', name: manifest.name, kind: 'service-system' }, null, 2) + '\n',
      'members/owner.json': JSON.stringify({ id: 'owner', name: 'Project owner' }, null, 2) + '\n',
    }
    parsePlan(files)
    const staging = `.groundwork/init-${randomUUID()}`
    try {
      for (const [name, data] of Object.entries(files)) await atomicFile(root, `${staging}/${name}`, data)
      if (options.assets) await cp(options.assets, await safePath(root, `${staging}/assets`), { recursive: true, dereference: false, filter: async source => { if ((await lstat(source)).isSymbolicLink()) throw new Error('Migration does not follow asset symlinks'); return true } })
      await rename(await safePath(root, staging), target)
    } finally { await rm(await safePath(root, staging), { recursive: true, force: true }) }
    await installInstructions(root)
    return { root, project: parsePlan(files).manifest }
  })
}
/** Explicitly export a legacy dataset; the source is never modified. */
export async function exportLegacy(source: string, target: string, options: { name: string; id?: string; product?: string; assets?: string; supplement?: string }) {
  const docs = await readContentDirectory(source)
  const loaded = loadContent(docs, ['tax-cart-totals'])
  const products = loaded.products.filter(p => !options.product || p.id === options.product)
  if (!products.length) throw new Error('No matching product to export')
  const workspaceIds = new Set(products.map(p => p.workspaceId))
  if (workspaceIds.size > 1) throw new Error('Select a product with --product when exporting multiple legacy workspaces')
  // Include referenced sibling products so cross-product component references survive.
  const keptProducts = loaded.products.filter(p => workspaceIds.has(p.workspaceId))
  const featureIds = new Set(loaded.features.filter(f => products.some(p => p.id === f.productId)).map(f => f.id))
  const files: Files = { 'project.json': JSON.stringify({ schemaVersion: 2, id: options.id ?? randomUUID(), name: options.name }, null, 2) + '\n' }
  for (const [name, value] of Object.entries(docs)) {
    if (name === 'project.json' || name.startsWith('workspaces/')) continue
    if (name.startsWith('products/')) {
      const product = keptProducts.find(p => name === `products/${p.id}.json`)
      if (product) { const { workspaceId: _workspaceId, ...portable } = product; files[name] = JSON.stringify(portable, null, 2) + '\n' }
      continue
    }
    if (name.startsWith('components/') && !keptProducts.some(p => p.id === (value as { productId: string }).productId)) continue
    if (name.startsWith('features/') && !featureIds.has(name.split('/')[1])) continue
    if (name.endsWith('/purpose.json')) files[name.replace('purpose.json', 'brief.md')] = renderBrief(value as Parameters<typeof renderBrief>[0])
    else files[name] = JSON.stringify(value, null, 2).replaceAll('/images/', 'assets/') + '\n'
  }
  if (options.supplement) {
    async function visit(directory: string, prefix = '') {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) throw new Error('Supplement symlinks are not supported')
        const name = prefix + entry.name
        if (entry.isDirectory()) await visit(path.join(directory, entry.name), name + '/')
        else if (entry.isFile()) {
          if (name in files) throw new Error(`Supplement would overwrite ${name}`)
          files[name] = await readFile(path.join(directory, entry.name), 'utf8')
        }
      }
    }
    await visit(options.supplement)
  }
  return initialise(target, { files, assets: options.assets })
}
