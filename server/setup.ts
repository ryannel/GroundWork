import { mkdir, readFile, readdir, cp, rename, rm, lstat } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { InvalidInput, NotFound } from './errors.ts'
import { assetPattern, manifestSchema, parsePlan, renderBrief, assertLegacyWriteForms, type Files } from './format.ts'
import { GUIDE_FILE, INIT_STAGING_PREFIX, IGNORED_PATHS, PLANS_DIR, PROJECT_FILE, SCHEMAS_DIR } from './paths.ts'
import { atomicFile, readPlanUnlocked, safePath, withLock } from './repository.ts'
import { readContentDirectory } from './content-files.ts'
import { loadContent } from '../src/data/content.ts'
import { identitySlug, repositoryName } from '../src/data/repository-identity.ts'
import { context } from './git.ts'

// The same source runs under Node's TS support in development and as compiled JS in the package.
export const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), import.meta.url.includes('/runtime/') ? '../..' : '..')
export async function installInstructions(root: string) {
  const guide = await readFile(path.join(packageRoot, 'docs/PORTABLE.md'), 'utf8')
  await atomicFile(root, GUIDE_FILE, guide)
  for (const file of await readdir(path.join(packageRoot, 'schemas'))) {
    if (!file.endsWith('.json')) continue
    await atomicFile(root, `${SCHEMAS_DIR}/${file}`, await readFile(path.join(packageRoot, 'schemas', file), 'utf8'))
  }
  const catalogSkill = path.join(packageRoot, '.agents/skills/groundwork-system-catalog')
  await atomicFile(root, '.agents/skills/groundwork-system-catalog/SKILL.md', await readFile(path.join(catalogSkill, 'SKILL.md'), 'utf8'))
  for (const file of await readdir(path.join(catalogSkill, 'references'))) {
    if (!file.endsWith('.md')) continue
    const content = await readFile(path.join(catalogSkill, 'references', file), 'utf8')
    await atomicFile(root, `.agents/skills/groundwork-system-catalog/references/${file}`, content)
  }
  const packageFile = await safePath(root, 'package.json')
  const packageText = await readFile(packageFile, 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error })
  if (packageText) {
    const pkg = JSON.parse(packageText)
    pkg.scripts ??= {}
    let changed = false
    const scripts = { 'plans:start': 'groundwork-v2 start', 'plans:standalone': 'groundwork-v2 serve', 'plans:hub': 'groundwork-v2 hub' }
    for (const [name, command] of Object.entries(scripts)) {
      if (!(name in pkg.scripts)) { pkg.scripts[name] = command; changed = true }
    }
    if (changed) await atomicFile(root, 'package.json', JSON.stringify(pkg, null, 2) + '\n')
  }
  const instruction = `For Groundwork planning, read [${GUIDE_FILE}](${GUIDE_FILE}). Use the installed \`groundwork-v2\` CLI or MCP server `
    + 'and preserve checkout context and revision checks.'
  for (const name of ['AGENTS.md', 'CLAUDE.md']) {
    const file = await safePath(root, name)
    const before = await readFile(file, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error })
    if (!before.includes(`](${GUIDE_FILE})`)) await atomicFile(root, name, before + `\n\n## Groundwork planning\n\n${instruction}\n`)
  }
  const ignoreFile = await safePath(root, '.gitignore')
  const ignored = await readFile(ignoreFile, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error })
  let ignore = ignored
  for (const entry of IGNORED_PATHS) if (!ignore.split('\n').includes(entry)) ignore += `\n${entry}\n`
  if (ignore !== ignored) await atomicFile(root, '.gitignore', ignore)
}
export async function initialise(root: string, options: { name?: string; id?: string; domain?: string; files?: Files; assets?: string } = {}) {
  await mkdir(root, { recursive: true })
  return withLock(root, async () => {
    if (await lstat(await safePath(root, PROJECT_FILE)).catch(() => null)) throw new InvalidInput('Catalog already exists; initialisation never overwrites it')
    const target = await safePath(root, PLANS_DIR)
    if (await lstat(target).catch(() => null)) throw new InvalidInput('Plans already exist. Initialisation never overwrites an existing plan directory.')
    const manifest = manifestSchema.parse({
      schemaVersion: 2, id: options.id ?? randomUUID(), name: options.name ?? path.basename(root), ...(options.domain ? { domain: options.domain } : {}),
    })
    // A Git checkout has a repository name shared by its clones, even when their folder names differ. Until the
    // migration removes project.json, the product still uses the legacy on-disk shape without `repositories`.
    // Non-Git application folders retain their historical `app` product because they have no repository identity.
    const checkout = await context(root)
    const name = repositoryName(checkout.repository.id)
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app'
    const productId = checkout.isGit ? options.id ?? identitySlug(name) : 'app'
    const productSlug = checkout.isGit ? slug : 'app'
    const files = options.files ?? {
      'project.json': JSON.stringify(manifest, null, 2) + '\n',
      [`products/${productId}.json`]: JSON.stringify({ id: productId, slug: productSlug, name: manifest.name, kind: 'service-system' }, null, 2) + '\n',
      'members/owner.json': JSON.stringify({ id: 'owner', name: 'Project owner' }, null, 2) + '\n',
    }
    // Initialisation stages the legacy layout, so supplied documents are held to the same forms a write is.
    assertLegacyWriteForms(files)
    parsePlan(files)
    const staging = `${INIT_STAGING_PREFIX}${randomUUID()}`
    try {
      for (const [name, data] of Object.entries(files)) await atomicFile(root, `${staging}/${name}`, data)
      if (options.assets) {
        const assets = path.resolve(options.assets)
        await cp(assets, await safePath(root, `${staging}/assets`), { recursive: true, dereference: false, filter: source => assetFilter(assets, source) })
      }
      await rename(await safePath(root, staging), target)
    } finally { await rm(await safePath(root, staging), { recursive: true, force: true }) }
    // Prove the result is readable before reporting success; otherwise leave the folder as it was.
    try { await readPlanUnlocked(root) } catch (error) {
      await rm(target, { recursive: true, force: true })
      throw error
    }
    await installInstructions(root)
    return { root, project: parsePlan(files).manifest }
  })
}
/** Copies directories and raster assets; skips hidden files such as .DS_Store; rejects anything the reader would refuse. */
async function assetFilter(assets: string, source: string) {
  const relative = path.relative(assets, source).split(path.sep).join('/')
  const stat = await lstat(source)
  if (stat.isSymbolicLink()) throw new InvalidInput('Migration does not follow asset symlinks')
  if (relative && path.basename(source).startsWith('.')) return false
  if (stat.isDirectory()) return true
  if (!stat.isFile() || !assetPattern.test(`assets/${relative}`)) {
    throw new InvalidInput(`Unsupported asset ${relative}: use png, jpg, webp, gif or avif files named with letters, digits, _ or -`)
  }
  return true
}
/** Rewrites legacy /images/ mockup references to portable assets/ references; other text is left alone. */
function portableDesign(value: unknown) {
  const design = value as { mockups?: { ref?: unknown }[] }
  if (!Array.isArray(design?.mockups)) return value
  const mockups = design.mockups.map(mock => typeof mock?.ref === 'string' && mock.ref.startsWith('/images/')
    ? { ...mock, ref: `assets/${mock.ref.slice('/images/'.length)}` }
    : mock)
  return { ...design, mockups }
}
/** Explicitly export a legacy dataset; the source is never modified. */
export async function exportLegacy(
  source: string, target: string, options: { name: string; id?: string; product?: string; assets?: string; supplement?: string },
) {
  const docs = await readContentDirectory(source)
  const loaded = loadContent(docs)
  const products = loaded.products.filter(p => !options.product || p.id === options.product)
  if (!products.length) throw new NotFound('No matching product to export')
  const workspaceIds = new Set(products.map(p => p.workspaceId))
  if (workspaceIds.size > 1) throw new InvalidInput('Select a product with --product when exporting multiple legacy workspaces')
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
    else files[name] = JSON.stringify(name.endsWith('/design.json') ? portableDesign(value) : value, null, 2) + '\n'
  }
  if (options.supplement) {
    async function visit(directory: string, prefix = '') {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) throw new InvalidInput('Supplement symlinks are not supported')
        const name = prefix + entry.name
        if (entry.isDirectory()) await visit(path.join(directory, entry.name), name + '/')
        else if (entry.isFile()) {
          if (name in files) throw new InvalidInput(`Supplement would overwrite ${name}`)
          files[name] = await readFile(path.join(directory, entry.name), 'utf8')
        }
      }
    }
    await visit(options.supplement)
  }
  return initialise(target, { files, assets: options.assets })
}
