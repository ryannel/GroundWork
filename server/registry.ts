import { homedir } from 'node:os'
import { lstat, mkdir, readFile, realpath, readdir } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { InvalidInput, NotFound } from './errors.ts'
import { NotInitialised } from './format.ts'
import { atomicFile, readPlan, withLock } from './repository.ts'
import { context, discover, git } from './git.ts'
import { componentMembership, productRepositories } from '../shared/content.ts'
import { repositoryIdentity } from '../shared/repository-identity.ts'
const productRefSchema = z.strictObject({ repository: z.string().min(1), product: z.string().min(1) })
export const hubRegistrySchema = z.strictObject({
  checkouts: z.record(z.string().min(1), z.array(z.string().min(1))),
  workspaces: z.array(z.strictObject({ name: z.string().min(1), products: z.array(productRefSchema) })),
})
export type HubRegistry = z.infer<typeof hubRegistrySchema>
export type ProductRef = z.infer<typeof productRefSchema>
export const emptyHubRegistry = (): HubRegistry => ({ checkouts: {}, workspaces: [] })
export const configRoot = () => path.resolve(process.env.GROUNDWORK_HOME ?? path.join(homedir(), '.config', 'groundwork-v2'))
const checkoutRoots = new Map<string, { root: string; registrationRoot: string; registryRoot: string }>()
export async function readHubRegistry(directory = configRoot()): Promise<HubRegistry> {
  const file = path.join(directory, 'registry.json')
  const raw = await readFile(file, 'utf8').catch(error => {
    if (error.code === 'ENOENT') return null
    throw error
  })
  if (raw === null) return emptyHubRegistry()
  let parsed: unknown
  try { parsed = JSON.parse(raw) }
  catch (error) { throw new InvalidInput(`${file}: ${(error as Error).message}`) }
  const result = hubRegistrySchema.safeParse(parsed)
  if (!result.success) throw new InvalidInput(`${file}: ${z.prettifyError(result.error)}`)
  return result.data
}
export const registry = readHubRegistry
export async function writeHubRegistry(directory: string, update: (current: HubRegistry) => HubRegistry) {
  await mkdir(directory, { recursive: true })
  return withLock(directory, async () => {
    const next = hubRegistrySchema.parse(update(await readHubRegistry(directory)))
    await atomicFile(directory, 'registry.json', JSON.stringify(next, null, 2) + '\n')
    return next
  }, 'registry.lock')
}
export async function register(root: string, workspace = 'My projects', product?: string) {
  root = await realpath(root)
  const ctx = await context(root)
  const repository = repositoryIdentity(ctx.repository.id)
  const plan = await readPlan(root).catch(error => {
    if (error instanceof NotInitialised) return null
    throw error
  })
  const matched = product ? plan?.snapshot.products.find(item => item.id === product || item.name === product) :
    plan?.snapshot.products.length === 1 ? plan.snapshot.products[0] : undefined
  await writeHubRegistry(configRoot(), config => {
    config.checkouts[repository] = [...new Set([...(config.checkouts[repository] ?? []), root])]
    if (matched) {
      let group = config.workspaces.find(item => item.name === workspace)
      if (!group) { group = { name: workspace, products: [] };
        config.workspaces.push(group) }
      if (!group.products.some(item => item.repository === repository && item.product === matched.id)) {
        group.products.push({ repository, product: matched.id })
      }
    }
    return config
  })
  return { root, repository, workspace, product: matched?.name ?? product ?? path.basename(root), projectId: plan?.manifest.id ?? null }
}
export async function unregister(root: string) {
  root = await realpath(root).catch(error => {
    if (error.code === 'ENOENT') return path.resolve(root)
    throw error
  })
  const result = await writeHubRegistry(configRoot(), config => {
    for (const [repository, roots] of Object.entries(config.checkouts)) {
      config.checkouts[repository] = roots.filter(candidate => candidate !== root)
      if (!config.checkouts[repository].length) delete config.checkouts[repository]
    }
    return config
  })
  for (const [id, cached] of checkoutRoots) if (cached.registryRoot === configRoot() && cached.registrationRoot === root) checkoutRoots.delete(id)
  return result
}
export async function inventory() { return inventoryCurrent(await readHubRegistry()) }
export async function selectRoot(checkoutId: string | undefined) {
  if (!checkoutId) throw new NotFound('Unknown checkout. List projects and select a registered checkout ID.')
  const roots = Object.values((await readHubRegistry()).checkouts).flat()
  const cached = checkoutRoots.get(checkoutId)
  if (cached?.registryRoot === configRoot() && roots.includes(cached.registrationRoot)) {
    if (await lstat(cached.root).then(stat => stat.isDirectory(), () => false)) return cached.root
    checkoutRoots.delete(checkoutId)
  }
  for (const root of roots) {
    for (const ctx of await discover(root).catch(() => [])) {
      checkoutRoots.set(ctx.checkoutId, { root: ctx.root, registrationRoot: root, registryRoot: configRoot() })
      if (ctx.checkoutId === checkoutId) return ctx.root
    }
  }
  throw new NotFound('Unknown checkout. List projects and select a registered checkout ID.')
}

/** Bounded discovery: the selected paths must come from this preview, not arbitrary folder children. */
export async function previewFolderRegistration(folder: string, maxDepth = 2) {
  if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 4) throw new InvalidInput('Folder depth must be between 0 and 4.')
  folder = await realpath(folder)
  const found: { root: string; repository: string; hasProducts: boolean }[] = []
  const visit = async (directory: string, depth: number): Promise<void> => {
    const top = await git(directory, ['rev-parse', '--show-toplevel']).catch(() => null)
    if (top && await realpath(top) === directory) {
      const ctx = await context(directory)
      const plan = await readPlan(directory).catch(error => {
        if (error instanceof NotInitialised) return null
        throw error
      })
      found.push({ root: directory, repository: repositoryIdentity(ctx.repository.id), hasProducts: !!plan?.snapshot.products.length })
      return
    }
    if (depth >= maxDepth) return
    const children = await readdir(directory, { withFileTypes: true })
    for (const child of children) {
      if (!child.isDirectory() || child.name.startsWith('.') || child.name === 'node_modules') continue
      await visit(path.join(directory, child.name), depth + 1)
    }
  }
  await visit(folder, 0)
  return { folder, maxDepth, repositories: found.sort((a, b) => a.root.localeCompare(b.root)) }
}
export async function registerFolder(folder: string, selectedRoots: string[], maxDepth = 2) {
  const preview = await previewFolderRegistration(folder, maxDepth)
  const selected = new Set(selectedRoots.map(root => path.resolve(root)))
  if (selected.size !== selectedRoots.length || [...selected].some(root => !preview.repositories.some(item => item.root === root))) {
    throw new InvalidInput('Select repositories from the folder preview by their exact root paths.')
  }
  return writeHubRegistry(configRoot(), config => {
    for (const item of preview.repositories) if (selected.has(item.root)) {
      config.checkouts[item.repository] = [...new Set([...(config.checkouts[item.repository] ?? []), item.root])]
    }
    return config
  })
}

/** One entry per checkout; the first registered clone represents each repository. */
async function inventoryCurrent(config: HubRegistry) {
  const contexts = [] as Awaited<ReturnType<typeof context>>[]
  const origin = new Map<string, string>()
  for (const roots of Object.values(config.checkouts)) for (const root of roots) {
    for (const ctx of await discover(root).catch(() => [])) {
      if (contexts.some(item => item.checkoutId === ctx.checkoutId)) continue
      contexts.push(ctx)
      origin.set(ctx.checkoutId, root)
      checkoutRoots.set(ctx.checkoutId, { root: ctx.root, registrationRoot: root, registryRoot: configRoot() })
    }
  }
  const plans = await Promise.all(contexts.map(async ctx => {
    try { return { ctx, plan: await readPlan(ctx.root), readError: null as string | null } }
    catch (error) {
      return { ctx, plan: null, readError: error instanceof NotInitialised ? null : (error as Error).message }
    }
  }))
  const registeredRoots = new Set(Object.values(config.checkouts).flat())
  const preferred = new Map<string, string>()
  for (const ctx of contexts) {
    const repository = repositoryIdentity(ctx.repository.id)
    if (registeredRoots.has(ctx.root) && !preferred.has(repository)) preferred.set(repository, ctx.checkoutId)
  }
  const defaultBranches = await Promise.all(contexts.map(ctx => git(ctx.root,
    ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']).then(value => value.slice('origin/'.length), () => null)))
  // A feature worktree of a source-only registration may contain an independent, unpushed plan. It is not a Hub
  // home just because Git lists it as another checkout. A registered root or default-branch worktree is authoritative.
  const homes = plans.filter((item): item is typeof item & { plan: NonNullable<typeof item.plan> } => {
    if (!item.plan?.snapshot.products.length) return false
    const index = contexts.findIndex(ctx => ctx.checkoutId === item.ctx.checkoutId)
    return registeredRoots.has(item.ctx.root) || item.ctx.branch === (defaultBranches[index] ?? 'main')
      || !defaultBranches[index] && item.ctx.branch === 'master'
  })
  const chosenHomes = new Map<string, (typeof homes)[number]>()
  for (const home of homes) {
    const repository = repositoryIdentity(home.plan.repository.id)
    if (!chosenHomes.has(repository)) chosenHomes.set(repository, home)
  }
  const repositoryRefs = (repository: string): (ProductRef & { relation: 'home' | 'owned' | 'used' })[] => {
    const refs = new Map<string, ProductRef & { relation: 'home' | 'owned' | 'used' }>()
    for (const { plan } of chosenHomes.values()) for (const product of plan.snapshot.products) {
      const ref = { repository: repositoryIdentity(plan.repository.id), product: product.id }
      const key = `${ref.repository}\0${ref.product}`
      if (ref.repository === repository) refs.set(key, { ...ref, relation: 'home' })
      for (const entry of productRepositories(product, plan.snapshot.products, plan.snapshot.components, plan.repository.id)) {
        if (repositoryIdentity(entry.repository) !== repository) continue
        const previous = refs.get(key)
        if (entry.role === 'owned' || !previous) refs.set(key, { ...ref, relation: entry.role })
      }
    }
    return [...refs.values()]
  }
  return plans.map(({ ctx, plan, readError }) => {
    const repositoryId = repositoryIdentity(ctx.repository.id)
    const refs = repositoryRefs(repositoryId)
    const productRefs = refs.map(({ relation: _relation, ...ref }) => {
      const home = chosenHomes.get(ref.repository)!.plan
      const product = home.snapshot.products.find(item => item.id === ref.product)!
      const workspaceNames = config.workspaces.filter(workspace => workspace.products.some(item =>
        repositoryIdentity(item.repository) === ref.repository && item.product === ref.product)).map(item => item.name)
      const scopedComponents = home.snapshot.components.filter(component =>
        (repositoryId === ref.repository || repositoryIdentity(component.repo ?? home.repository.id) === repositoryId)
        && componentMembership(component, home.snapshot.products, home.repository.id).productIds.includes(ref.product))
      const componentIds = scopedComponents.map(component => component.id)
      const componentKeys = scopedComponents.map(component =>
        `${repositoryIdentity(component.repo ?? home.repository.id)}#${component.id}`)
      const declaredRepositories = [...new Set(productRepositories(product, home.snapshot.products, home.snapshot.components,
        home.repository.id).map(entry => repositoryIdentity(entry.repository)))].sort()
      const features = repositoryId === ref.repository ? home.snapshot.features.filter(feature => feature.productId === ref.product)
        .map(feature => ({ id: feature.id, title: feature.title, stage: feature.stage })) : []
      return { ...ref, slug: product.slug, name: product.name, workspaceNames, componentIds, componentKeys, declaredRepositories, features,
        path: `/r/${encodeURIComponent(ref.repository)}/${encodeURIComponent(product.slug)}` }
    })
    const workspaceNames = config.workspaces.filter(workspace => workspace.products.some(ref => refs.some(owner =>
      owner.repository === repositoryIdentity(ref.repository) && owner.product === ref.product))).map(item => item.name)
    const owners = refs.filter(ref => ref.relation === 'owned')
    const routeRef = owners.length === 1 ? productRefs.find(ref =>
      ref.repository === owners[0].repository && ref.product === owners[0].product) : undefined
    const components = plan?.snapshot.components.map(component => ({ id: component.id, name: component.name,
      repository: component.repo ?? null, sourcePath: component.sourcePath ?? '.' })) ?? []
    return {
      ...ctx, repositoryId, homeRepositoryId: routeRef?.repository ?? null, productId: routeRef?.product ?? null,
      productRefs, workspaceNames, preferred: preferred.get(repositoryId) === ctx.checkoutId,
      authoritativeHome: chosenHomes.get(repositoryId)?.ctx.checkoutId === ctx.checkoutId,
      repositoryRoot: origin.get(ctx.checkoutId) ?? ctx.root, workspace: workspaceNames[0] ?? 'My projects',
      product: routeRef?.name ?? path.basename(ctx.root), name: path.basename(ctx.root),
      productPath: routeRef?.path ?? null, projectId: plan?.manifest.id ?? null, planName: plan?.manifest.name ?? null,
      features: plan?.snapshot.features.map(feature => ({ id: feature.id, title: feature.title, stage: feature.stage })) ?? [],
      components, repositories: productRefs.length ? [repositoryId, ...productRefs.map(ref => ref.repository)] : [repositoryId],
      error: readError,
    }
  })
}
