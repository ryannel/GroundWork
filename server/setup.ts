import { mkdir, readFile, readdir, cp, rm, lstat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { InvalidInput } from './errors.ts'
import { assetPattern, parsePlan, type Files } from './format.ts'
import { GUIDE_FILE, IGNORED_PATHS, PLANS_DIR, PRODUCTS_DIR, CATALOG_DIR, SCHEMAS_DIR } from './paths.ts'
import { atomicFile, readPlanUnlocked, safePath, withLock } from './repository.ts'
import { identitySlug, repositoryName } from '../shared/repository-identity.ts'
import { context } from './git.ts'
import { encodeStorage } from './catalog-storage.ts'

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
  const packageText = await readFile(packageFile, 'utf8').catch(error => { if (error.code === 'ENOENT') return null;
    throw error })
  if (packageText) {
    const pkg = JSON.parse(packageText)
    pkg.scripts ??= {}
    let changed = false
    const scripts = { 'plans:start': 'groundwork-v2 start', 'plans:hub': 'groundwork-v2 hub' }
    for (const [name, command] of Object.entries(scripts)) {
      if (!(name in pkg.scripts)) { pkg.scripts[name] = command;
        changed = true }
    }
    if (changed) await atomicFile(root, 'package.json', JSON.stringify(pkg, null, 2) + '\n')
  }
  const instruction = `For Groundwork planning, read [${GUIDE_FILE}](${GUIDE_FILE}). Use the installed \`groundwork-v2\` CLI or MCP server `
    + 'and preserve checkout context and revision checks.'
  for (const name of ['AGENTS.md', 'CLAUDE.md']) {
    const file = await safePath(root, name)
    const before = await readFile(file, 'utf8').catch(error => { if (error.code === 'ENOENT') return '';
      throw error })
    if (!before.includes(`](${GUIDE_FILE})`)) await atomicFile(root, name, before + `\n\n## Groundwork planning\n\n${instruction}\n`)
  }
  const ignoreFile = await safePath(root, '.gitignore')
  const ignored = await readFile(ignoreFile, 'utf8').catch(error => { if (error.code === 'ENOENT') return '';
    throw error })
  let ignore = ignored
  for (const entry of IGNORED_PATHS) if (!ignore.split('\n').includes(entry)) ignore += `\n${entry}\n`
  if (ignore !== ignored) await atomicFile(root, '.gitignore', ignore)
}
export async function initialise(root: string, options: { name?: string; id?: string; domain?: string; files?: Files; assets?: string } = {}) {
  await mkdir(root, { recursive: true })
  return withLock(root, async () => {
    for (const directory of [PRODUCTS_DIR, PLANS_DIR, CATALOG_DIR]) {
      if (await lstat(await safePath(root, directory)).catch(() => null)) {
        throw new InvalidInput('Groundwork documents already exist; initialisation never overwrites them')
      }
    }
    const checkout = await context(root)
    const name = repositoryName(checkout.repository.id)
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app'
    const productId = options.id ?? (checkout.isGit ? identitySlug(name) : 'app')
    const files = options.files ?? {
      [`products/${productId}.json`]: JSON.stringify({ id: productId, slug: checkout.isGit ? slug : 'app',
        name: options.name ?? name, kind: 'service-system', ...(options.domain ? { domain: options.domain } : {}),
        repositories: [{ repository: checkout.repository.id, role: 'owned' }] }, null, 2) + '\n',
      'members/owner.json': JSON.stringify({ id: 'owner', name: 'Project owner' }, null, 2) + '\n',
    }
    const plan = parsePlan(files, { repository: checkout.repository })
    const physical = encodeStorage(files)
    const written: string[] = []
    try {
      for (const [name, data] of Object.entries(physical)) {
        if (await lstat(await safePath(root, name)).catch(() => null)) throw new InvalidInput(`${name} already exists`)
        await atomicFile(root, name, data)
        written.push(name)
      }
      if (options.assets) {
        const assets = path.resolve(options.assets)
        await cp(assets, await safePath(root, `${PLANS_DIR}/assets`), { recursive: true, dereference: false,
          filter: source => assetFilter(assets, source) })
      }
      await readPlanUnlocked(root)
    } catch (error) {
      for (const name of written.reverse()) await atomicFile(root, name, null)
      for (const directory of [PLANS_DIR, PRODUCTS_DIR, CATALOG_DIR]) {
        await rm(await safePath(root, directory), { recursive: true, force: true })
      }
      throw error
    }
    await installInstructions(root)
    return { root, project: plan.manifest }
  })
}
/** Copies directories and raster assets; skips hidden files such as .DS_Store; rejects anything the reader would refuse. */
async function assetFilter(assets: string, source: string) {
  const relative = path.relative(assets, source).split(path.sep).join('/')
  const stat = await lstat(source)
  if (stat.isSymbolicLink()) throw new InvalidInput('Groundwork does not follow asset symlinks')
  if (relative && path.basename(source).startsWith('.')) return false
  if (stat.isDirectory()) return true
  if (!stat.isFile() || !assetPattern.test(`assets/${relative}`)) {
    throw new InvalidInput(`Unsupported asset ${relative}: use png, jpg, webp, gif or avif files named with letters, digits, _ or -`)
  }
  return true
}
