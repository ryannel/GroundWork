import { homedir } from 'node:os'
import { mkdir, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
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
const checkoutRoots = new Map<string, string>()
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
  const raw = await readFile(await safePath(configRoot(), 'registry.json'), 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error })
  if (!raw) return { version: 2 as const, projects: [] as z.infer<typeof registrySchema>['projects'] }
  const data = JSON.parse(raw)
  const current = registrySchema.safeParse(data)
  if (current.success) return current.data
  const legacy = legacyRegistrySchema.parse(data)
  return {
    version: 2 as const,
    projects: legacy.projects.map(project => ({ ...project, product: project.workspace })),
  }
}
export async function register(root: string, workspace = 'My projects', product?: string) {
  root = await realpath(root)
  const plan = await readPlan(root).catch(error => {
    if ((error as Error).message.includes('project.json')) return null
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
  root = path.resolve(root)
  await mkdir(configRoot(), { recursive: true })
  return withLock(configRoot(), async () => {
    const config = await registry()
    config.projects = config.projects.filter(p => p.root !== root)
    await atomicFile(configRoot(), 'registry.json', JSON.stringify(config, null, 2) + '\n')
    return config
  }, 'registry.lock')
}
export async function inventory(standalone?: string) {
  const roots = standalone
    ? [{ root: standalone, workspace: 'This repository', product: path.basename(standalone), projectId: null }]
    : (await registry()).projects
  const entries = []
  const seen = new Set<string>()
  for (const record of roots) {
    try {
      for (const ctx of await discover(record.root)) {
        checkoutRoots.set(ctx.checkoutId, ctx.root)
        if (seen.has(ctx.checkoutId)) continue
        seen.add(ctx.checkoutId)
        try {
          const plan = await readPlan(ctx.root)
          const catalog = productCatalog(plan, record.product, record.root)
          entries.push({ ...ctx, repositoryRoot: record.root, ...catalog, workspace: record.workspace, product: record.product, projectId: plan.manifest.id, name: path.basename(record.root), planName: plan.manifest.name, features: plan.snapshot.features.map(f => ({ id: f.id, title: f.title, stage: f.stage })), error: null as string | null })
        } catch (error) { entries.push({ ...ctx, repositoryRoot: record.root, repositories: [record.root], components: [], productPath: null, workspace: record.workspace, product: record.product, projectId: record.projectId, name: path.basename(record.root), planName: null, features: [], error: (error as Error).message }) }
      }
    } catch (error) {
      entries.push({ root: record.root, repositoryRoot: record.root, repositories: [record.root], components: [], productPath: null, checkoutId: '', branch: null, head: null, isGit: false, token: '', workspace: record.workspace, product: record.product, projectId: record.projectId, name: path.basename(record.root), planName: null, features: [], error: (error as Error).message })
    }
  }
  return entries
}
export async function selectRoot(checkoutId: string | undefined, standalone?: string) {
  if (!checkoutId && standalone) return (await context(standalone)).root
  if (!checkoutId) throw new Error('Unknown checkout. List projects and select a registered checkout ID.')
  const cached = checkoutRoots.get(checkoutId)
  if (cached) return cached
  const roots = standalone ? [{ root: standalone }] : (await registry()).projects
  for (const record of roots) {
    for (const ctx of await discover(record.root)) {
      checkoutRoots.set(ctx.checkoutId, ctx.root)
      if (ctx.checkoutId === checkoutId) return ctx.root
    }
  }
  throw new Error('Unknown checkout. List projects and select a registered checkout ID.')
}
