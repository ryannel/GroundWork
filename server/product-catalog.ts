import path from 'node:path'
import { componentMembership, productRepositories } from '../src/data/content.ts'
import { repositoryIdentity } from '../src/data/repository-identity.ts'
import type { Component } from '../src/data/model.ts'
import { buildRevisionHistory } from './catalog-history.ts'
import { localDefaultBranch, readProductCatalogPlan, type CatalogReadSource } from './catalog-branches.ts'
import { readCatalogCache } from './catalog-cache.ts'
import { catalogCandidateFromComponents, materializeResolvedCatalog, resolveCatalogForProduct,
  type CatalogCandidate, type ResolvedCatalog, type ResolvedDetail, type RevisionHistory } from './catalog-resolution.ts'
import { InvalidInput, NotFound } from './errors.ts'
import { readCatalogTarget, readPlan } from './repository.ts'

export interface ProductCatalogRepository {
  repository: string
  /** Which source checkout and branch supplied the source candidate, if one is available. */
  source: CatalogReadSource | null
  /** The product home's local catalog is read at this committed revision, or from its working tree. */
  local: CatalogReadSource
  resolution: ResolvedCatalog
  components: Component[]
  incompatible: ResolvedDetail[]
}

/** The caller selects one clone per repository, normally the Hub's preferred default-branch clone. */
export async function resolveProductCatalog(homeRoot: string, productId: string, clones: Readonly<Record<string, string>>,
  editingRoot = homeRoot, options: { useCache?: boolean; cacheRoot?: string; homeRef?: string } = {}):
  Promise<{ productId: string; homeRepository: string; repositories: ProductCatalogRepository[] }> {
  const homeRead = options.homeRef ? await (async () => {
    const plan = await readPlan(homeRoot, options.homeRef)
    const repository = repositoryIdentity(plan.repository.id)
    const commit = plan.context.head
    return { plan, source: { repository, branch: options.homeRef!, commit, workingTree: false,
      label: `${repository}@${options.homeRef} ${commit?.slice(0, 12) ?? 'unknown'} (committed ref)`,
    } satisfies CatalogReadSource }
  })() : await readProductCatalogPlan(homeRoot, editingRoot)
  const homePlan = homeRead.plan
  const homeRepository = repositoryIdentity(homePlan.repository.id)
  const product = homePlan.snapshot.products.find(item => item.id === productId)
  if (!product) throw new NotFound(`Product ${productId} is not in home repository ${homeRepository}`)
  const declared = [...new Set(productRepositories(product, homePlan.snapshot.products, homePlan.snapshot.components, homeRepository)
    .map(entry => repositoryIdentity(entry.repository)))].sort()
  const selectedClones = new Map(Object.entries(clones).map(([repository, root]) => [repositoryIdentity(repository), root]))
  const repositories: ProductCatalogRepository[] = []
  for (const repository of declared) {
    const cloneRoot = repository === homeRepository && options.homeRef ? homeRoot
      : selectedClones.get(repository) ?? (repository === homeRepository ? homeRoot : undefined)
    const cached = !cloneRoot && options.useCache !== false
      ? await readCatalogCache(repository, options.cacheRoot ? { cacheRoot: options.cacheRoot } : {}) : null
    const sourceRead = cloneRoot && repository === homeRepository && path.resolve(cloneRoot) === path.resolve(homeRoot)
      && options.homeRef ? homeRead : cloneRoot ? await readProductCatalogPlan(cloneRoot, editingRoot)
      : cached?.status === 'ready' ? { plan: await readPlan(cached.root, cached.ref), source: {
        repository, branch: cached.defaultBranch, commit: cached.ref, workingTree: false,
        label: `${repository}@${cached.defaultBranch} ${cached.ref.slice(0, 12)} (Hub cache, fetched ${cached.fetchedAt})`,
      } satisfies CatalogReadSource } : null
    // Cache metadata binds its source identity at refresh. Its sparse checkout may have an opaque remote path,
    // so the pinned cache entry supplies the canonical repository identity.
    if (sourceRead && !cached && repositoryIdentity(sourceRead.plan.repository.id) !== repository) {
      throw new InvalidInput(`Selected checkout is not repository ${repository}`)
    }
    const localRead = await readCatalogTarget(homeRoot, repository, 'local',
      homeRead.source.workingTree ? undefined : homeRead.source.commit ?? undefined)
    const belongs = (component: Component) => {
      const candidate = { ...component, repo: component.repo ?? repository }
      const declaredMembership = componentMembership(candidate, homePlan.snapshot.products, homeRepository)
      if (declaredMembership.productIds.includes(productId)) return true
      // Legacy source-only catalogs have no product declarations or productId. Keep a known home component's identity.
      return !product.repositories && homePlan.snapshot.components.some(homeComponent =>
        homeComponent.id === component.id && repositoryIdentity(homeComponent.repo ?? homeRepository) === repository
        && homeComponent.productId === productId)
    }
    const sourceComponents = sourceRead?.plan.snapshot.components.filter(belongs) ?? []
    // In an unmigrated home, the legacy "local" read is the same catalog as its own source read. Comparing it
    // against itself would manufacture unknown-order conflicts for areas that never recorded a revision.
    const localComponents = repository === homeRepository && localRead.layout !== 'catalog-v3' ? []
      : localRead.plan.snapshot.components.filter(belongs)
    const source: CatalogCandidate = catalogCandidateFromComponents(repository, sourceComponents)
    const local: CatalogCandidate = catalogCandidateFromComponents(repository, localComponents, homeRepository)
    const observations = [...source.units, ...local.units]
    const revisions = observations.flatMap(item => item.revision ? [item.revision] : [])
    const trees = observations.flatMap(item => item.tree ? [item.tree] : [])
    // A cache without Groundwork documents still carries the commit graph needed to order a home's local
    // observations and retirements. Its source candidate is empty, but its history is useful.
    const historyRoot = cloneRoot ?? cached?.root ?? null
    const defaultBranch = cloneRoot ? await localDefaultBranch(cloneRoot) : null
    const history: RevisionHistory = historyRoot
      ? await buildRevisionHistory(historyRoot, revisions, trees, cloneRoot ? defaultBranch?.ref : cached?.ref)
      : { relation: () => 'unknown' }
    const resolution = resolveCatalogForProduct(homeRepository, source, local, history)
    const materialized = materializeResolvedCatalog(resolution)
    repositories.push({ repository, source: sourceRead?.source ?? null, local: homeRead.source,
      resolution, components: materialized.components, incompatible: materialized.incompatible })
  }
  return { productId, homeRepository, repositories }
}
