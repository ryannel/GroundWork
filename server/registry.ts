import { homedir } from 'node:os'
import { lstat, mkdir, readFile, realpath, readdir } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { Conflict, InvalidInput, NotFound } from './errors.ts'
import { NotInitialised } from './format.ts'
import { atomicFile, readPlan, safePath, withLock } from './repository.ts'
import { context, discover, git } from './git.ts'
import { componentMembership, productRepositories } from '../src/data/content.ts'
import { repositoryIdentity } from '../src/data/repository-identity.ts'
import { rankClones } from './clone-rank.ts'
import { readHubRegistry, writeHubRegistry, previewRegistryMigration, emptyHubRegistry, type HubRegistry, type LabelMappings, type ProductRef } from './registry-v3.ts'
export { readHubRegistry, previewRegistryMigration, labelMappingKey, registrationMappingKey } from './registry-v3.ts'
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
const hasLegacyRegistry = () => lstat(path.join(configRoot(), 'registry.json')).then(() => true, error => {
  if (error.code === 'ENOENT') return false
  throw error
})
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
    .filter(component => componentMembership(component, plan.snapshot.products, plan.repository.id).productIds
      .some(productId => productIds.has(productId)))
    .map(component => ({ id: component.id, name: component.name, repository: component.repo ?? null, sourcePath: component.sourcePath ?? '.' }))
  const repositories = matched.flatMap(item => productRepositories(item, plan.snapshot.products, plan.snapshot.components, plan.repository.id)
    .map(entry => entry.repository))
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
  if (await readHubRegistry(configRoot()) || !await hasLegacyRegistry()) {
    const ctx = await context(root)
    const repository = repositoryIdentity(ctx.repository.id)
    await writeHubRegistry(configRoot(), config => {
      const roots = config.checkouts[repository] ?? []
      config.checkouts[repository] = [...new Set([...roots, root])]
      return config
    })
    return { root, repository, workspace, product: product ?? plan?.manifest.name ?? path.basename(root), projectId: plan?.manifest.id ?? null }
  }
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
  if (await readHubRegistry(configRoot())) {
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
  if (!await hasLegacyRegistry()) return emptyHubRegistry()
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
  if (!standalone) {
    const config = await readHubRegistry(configRoot())
    if (config) return inventoryV3(config)
  }
  const roots = standalone
    ? [{ root: standalone, workspace: 'This repository', product: path.basename(standalone), projectId: null }]
    : (await registry()).projects
  const entries = []
  const seen = new Set<string>()
  for (const record of roots) {
    const registered = { registryVersion: 2 as const, authoritativeHome: false, repositoryRoot: record.root, workspace: record.workspace, product: record.product, name: path.basename(record.root),
      productRefs: [] as { repository: string; product: string; slug: string; name: string; workspaceNames: string[]; path: string;
        componentIds: string[]; componentKeys: string[]; declaredRepositories: string[];
        features: { id: string; title: string; stage: string }[] }[],
      workspaceNames: [record.workspace], preferred: true, homeRepositoryId: null as string | null, productId: null as string | null }
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
            ...ctx, ...registered, repositoryId: repositoryIdentity(ctx.repository.id), ...catalog,
            projectId: plan.manifest.id, planName: plan.manifest.name, features, error: null as string | null,
          })
        } catch (error) { entries.push({ ...ctx, ...registered, repositoryId: repositoryIdentity(ctx.repository.id), ...unreadable(error) }) }
      }
    } catch (error) {
      const noCheckout = { root: record.root, checkoutId: '', branch: null, head: null, isGit: false, token: '' }
      entries.push({ ...noCheckout, ...registered, repositoryId: null, ...unreadable(error) })
    }
  }
  return entries
}
export async function selectRoot(checkoutId: string | undefined, standalone?: string) {
  if (!checkoutId && standalone) return (await context(standalone)).root
  if (!checkoutId) throw new NotFound('Unknown checkout. List projects and select a registered checkout ID.')
  const registryRoot = standalone ? null : configRoot()
  const hub = standalone ? null : await readHubRegistry(configRoot())
  const roots = standalone ? [{ root: standalone }] : hub
    ? Object.values(hub.checkouts).flat().map(root => ({ root })) : (await registry()).projects
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

/** Preview v2 labels and candidate fixed IDs. Confirmation writes only registry-v3.json. */
export async function previewHubMigration(mappings: LabelMappings = {}) {
  return previewRegistryMigration((await registry()).projects, mappings)
}
export async function migrateHubRegistry(mappings: LabelMappings, confirmed: boolean) {
  if (!confirmed) throw new InvalidInput('Confirm the registry migration after reviewing its label mappings.')
  if (await readHubRegistry(configRoot())) throw new Conflict('The v3 Hub registry already exists.')
  const preview = await previewHubMigration(mappings)
  if (preview.unresolved.length) throw new InvalidInput(`Unconfirmed registry labels: ${preview.unresolved.map(item => `${item.workspace} / ${item.product}`).join(', ')}`)
  return writeHubRegistry(configRoot(), () => preview.registry)
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
  if (!await readHubRegistry(configRoot()) && (await registry()).projects.length) {
    throw new Conflict('Preview and migrate the v2 registry before adding a folder to v3.')
  }
  return writeHubRegistry(configRoot(), config => {
    for (const item of preview.repositories) if (selected.has(item.root)) {
      config.checkouts[item.repository] = [...new Set([...(config.checkouts[item.repository] ?? []), item.root])]
    }
    return config
  })
}

/** One entry per checkout; registered clones are ranked so callers can open the most advanced one. */
async function inventoryV3(config: HubRegistry) {
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
  const selections = await rankClones(contexts.filter(ctx => registeredRoots.has(ctx.root)).map(ctx =>
    ({ root: ctx.root, checkoutId: ctx.checkoutId, repository: repositoryIdentity(ctx.repository.id) })))
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
  const preferred = new Map([...selections].map(([repository, selection]) => [repository, selection.preferredCheckoutId]))
  const homeSelections = await rankClones(homes.map(home => ({ root: home.ctx.root, checkoutId: home.ctx.checkoutId,
    repository: repositoryIdentity(home.plan.repository.id) })))
  const chosenHomes = new Map<string, (typeof homes)[number]>()
  for (const home of homes) {
    const repository = repositoryIdentity(home.plan.repository.id)
    if (homeSelections.get(repository)?.preferredCheckoutId === home.ctx.checkoutId) chosenHomes.set(repository, home)
  }
  const repositoryRefs = (repository: string): (ProductRef & { relation: 'home' | 'owned' | 'used' })[] => {
    const refs = new Map<string, ProductRef & { relation: 'home' | 'owned' | 'used' }>()
    for (const { plan } of chosenHomes.values()) for (const product of plan.snapshot.products) {
      const ref = { repository: repositoryIdentity(plan.repository.id), product: product.id }
      const key = `${ref.repository}\0${ref.product}`
      if (ref.repository === repository) refs.set(key, { ...ref, relation: 'home' })
      for (const entry of productRepositories(product, plan.snapshot.products, plan.snapshot.components, plan.repository.id)) {
        if (![entry.repository, ...(entry.aliases ?? [])].some(identity => repositoryIdentity(identity) === repository)) continue
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
      ...ctx, registryVersion: 3 as const, repositoryId, homeRepositoryId: routeRef?.repository ?? null, productId: routeRef?.product ?? null,
      productRefs, workspaceNames, preferred: preferred.get(repositoryId) === ctx.checkoutId,
      cloneDisagreement: selections.get(repositoryId)?.disagreement ?? null,
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
