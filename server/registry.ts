import { homedir } from 'node:os'
import { lstat, mkdir, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { InvalidInput, NotFound } from './errors.ts'
import { NotInitialised } from './format.ts'
import { atomicFile, readPlan, safePath, withLock } from './repository.ts'
import { context, discover } from './git.ts'
const registrationSchema = z.strictObject({
  root: z.string(),
  workspace: z.string().min(1),
  product: z.string().min(1),
  projectId: z.string().nullable(),
})
const registrySchema = z.strictObject({ version: z.literal(2), projects: z.array(registrationSchema) })
const legacyRegistrySchema = z.strictObject({
  version: z.literal(1),
  projects: z.array(z.strictObject({ root: z.string(), workspace: z.string().min(1), projectId: z.string() })),
})
export const configRoot = () => path.resolve(process.env.GROUNDWORK_HOME ?? path.join(homedir(), '.config', 'groundwork-v2'))
const checkoutRoots = new Map<string, { root: string; registrationRoot: string; registryRoot: string | null }>()
const productKey = (value: string) => value.toLowerCase().replaceAll(/[^a-z0-9]+/g, '')
function productCatalog(plan: Awaited<ReturnType<typeof readPlan>>, product: string, fallback: string) {
  const key = productKey(product)
  const exact = plan.snapshot.products.filter(item => productKey(item.name) === key)
  const prefix = plan.snapshot.products.filter(item => productKey(item.name).startsWith(key) || key.startsWith(productKey(item.name)))
  const matched = exact.length ? exact : prefix.length === 1 ? prefix : plan.snapshot.products.length === 1 ? plan.snapshot.products : []
  const matchedProduct = matched.length === 1 ? matched[0] : undefined
  const matchedWorkspace = matchedProduct && plan.snapshot.workspaces.find(item => item.id === matchedProduct.workspaceId)
  const productIds = new Set(matched.map(item => item.id))
  const components = plan.snapshot.components
    .filter(component => productIds.has(component.productId))
    .map(component => ({ id: component.id, name: component.name, repository: component.repo ?? null, sourcePath: component.sourcePath ?? '.' }))
  const repositories = components.flatMap(component => component.repository ? [component.repository] : [])
  const productPath = matchedProduct && matchedWorkspace ? `/w/${matchedWorkspace.slug}/${matchedProduct.slug}` : null
  return { components, repositories: [...new Set(repositories.length ? repositories : [fallback])], productPath }
}
export async function registry() {
  await mkdir(configRoot(), { recursive: true })
  const file = await safePath(configRoot(), 'registry.json')
  const raw = await readFile(file, 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error })
  if (!raw) return { version: 2 as const, projects: [] as z.infer<typeof registrySchema>['projects'] }
  let data: unknown
  try { data = JSON.parse(raw) } catch (error) { throw new InvalidInput(`${file}: ${(error as Error).message}`, { cause: error }) }
  const version = (data as { version?: unknown } | null)?.version
  const parsed = (version === 1 ? legacyRegistrySchema : registrySchema).safeParse(data)
  if (!parsed.success) throw new InvalidInput(`${file}: ${z.prettifyError(parsed.error)}`, { cause: parsed.error })
  if (parsed.data.version === 2) return parsed.data
  const legacy = parsed.data
  return {
    version: 2 as const,
    projects: legacy.projects.map(project => ({ ...project, product: project.workspace })),
  }
}
export async function register(root: string, workspace = 'My projects', product?: string) {
  root = await realpath(root)
  const plan = await readPlan(root).catch(error => {
    if (error instanceof NotInitialised) return null
    throw error
  })
  await mkdir(configRoot(), { recursive: true })
  return withLock(configRoot(), async () => {
    const config = await registry()
    const record = { root, workspace, product: product ?? plan?.manifest.name ?? path.basename(root), projectId: plan?.manifest.id ?? null }
    config.projects = [...config.projects.filter(p => p.root !== root), record]
    registrySchema.parse(config)
    await atomicFile(configRoot(), 'registry.json', JSON.stringify(config, null, 2) + '\n')
    return record
  }, 'registry.lock')
}
export async function unregister(root: string) {
  root = await realpath(root).catch(error => {
    if (error.code === 'ENOENT') return path.resolve(root)
    throw error
  })
  await mkdir(configRoot(), { recursive: true })
  const result = await withLock(configRoot(), async () => {
    const config = await registry()
    config.projects = config.projects.filter(p => p.root !== root)
    await atomicFile(configRoot(), 'registry.json', JSON.stringify(config, null, 2) + '\n')
    return config
  }, 'registry.lock')
  for (const [id, cached] of checkoutRoots) if (cached.registryRoot === configRoot() && cached.registrationRoot === root) checkoutRoots.delete(id)
  return result
}
export async function inventory(standalone?: string) {
  const roots = standalone
    ? [{ root: standalone, workspace: 'This repository', product: path.basename(standalone), projectId: null }]
    : (await registry()).projects
  const entries = []
  const seen = new Set<string>()
  for (const record of roots) {
    const registered = { repositoryRoot: record.root, workspace: record.workspace, product: record.product, name: path.basename(record.root) }
    const unreadable = (error: unknown) => ({
      repositories: [record.root], components: [], productPath: null, projectId: record.projectId, planName: null, features: [],
      error: (error as Error).message,
    })
    try {
      for (const ctx of await discover(record.root)) {
        checkoutRoots.set(ctx.checkoutId, { root: ctx.root, registrationRoot: record.root, registryRoot: standalone ? null : configRoot() })
        if (seen.has(ctx.checkoutId)) continue
        seen.add(ctx.checkoutId)
        try {
          const plan = await readPlan(ctx.root)
          const catalog = productCatalog(plan, record.product, record.root)
          const features = plan.snapshot.features.map(f => ({ id: f.id, title: f.title, stage: f.stage }))
          entries.push({
            ...ctx, ...registered, ...catalog, projectId: plan.manifest.id, planName: plan.manifest.name, features, error: null as string | null,
          })
        } catch (error) { entries.push({ ...ctx, ...registered, ...unreadable(error) }) }
      }
    } catch (error) {
      const noCheckout = { root: record.root, checkoutId: '', branch: null, head: null, isGit: false, token: '' }
      entries.push({ ...noCheckout, ...registered, ...unreadable(error) })
    }
  }
  return entries
}
export async function selectRoot(checkoutId: string | undefined, standalone?: string) {
  if (!checkoutId && standalone) return (await context(standalone)).root
  if (!checkoutId) throw new NotFound('Unknown checkout. List projects and select a registered checkout ID.')
  const registryRoot = standalone ? null : configRoot()
  const roots = standalone ? [{ root: standalone }] : (await registry()).projects
  const cached = checkoutRoots.get(checkoutId)
  if (cached?.registryRoot === registryRoot && roots.some(record => record.root === cached.registrationRoot)) {
    if (await lstat(cached.root).then(stat => stat.isDirectory(), () => false)) return cached.root
    checkoutRoots.delete(checkoutId)
  }
  for (const record of roots) {
    // One moved or deleted registration must not hide the others.
    const checkouts = await discover(record.root).catch(() => [])
    for (const ctx of checkouts) {
      checkoutRoots.set(ctx.checkoutId, { root: ctx.root, registrationRoot: record.root, registryRoot })
      if (ctx.checkoutId === checkoutId) return ctx.root
    }
  }
  throw new NotFound('Unknown checkout. List projects and select a registered checkout ID.')
}
