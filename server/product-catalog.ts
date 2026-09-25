import path from 'node:path'
import { componentMembership, productRepositories } from '../shared/content.ts'
import { repositoryIdentity } from '../shared/repository-identity.ts'
import type { Component } from '../shared/model.ts'
import { readProductCatalogPlan, type CatalogReadSource } from './catalog-branches.ts'
import { InvalidInput, NotFound } from './errors.ts'
import { readCatalogTarget, readPlan } from './repository.ts'

export interface ProductCatalogRepository {
  repository: string
  selected: 'source' | 'local'
  source: CatalogReadSource | null
  local: CatalogReadSource | null
  components: Component[]
}

/** A product selects one catalog per repository. Source is the default; local must be declared. */
export async function resolveProductCatalog(
  homeRoot: string,
  productId: string,
  clones: Readonly<Record<string, string>>,
  editingRoot = homeRoot,
  options: { homeRef?: string } = {},
): Promise<{ productId: string; homeRepository: string; repositories: ProductCatalogRepository[] }> {
  const homeRead = options.homeRef ? await (async () => {
    const plan = await readPlan(homeRoot, options.homeRef)
    const repository = repositoryIdentity(plan.repository.id)
    const commit = plan.context.head
    return { plan, source: {
      repository, branch: options.homeRef!, commit, workingTree: false,
      label: `${repository}@${options.homeRef} ${commit?.slice(0, 12) ?? 'unknown'} (committed ref)`,
    } satisfies CatalogReadSource }
  })() : await readProductCatalogPlan(homeRoot, editingRoot)
  const homePlan = homeRead.plan
  const homeRepository = repositoryIdentity(homePlan.repository.id)
  const product = homePlan.snapshot.products.find(item => item.id === productId)
  if (!product) throw new NotFound(`Product ${productId} is not in home repository ${homeRepository}`)
  const entries = productRepositories(product, homePlan.snapshot.products, homePlan.snapshot.components, homeRepository)
  const choices = new Map<string, 'source' | 'local'>()
  for (const entry of entries) {
    const repository = repositoryIdentity(entry.repository)
    const choice = entry.catalog ?? 'source'
    if (choices.has(repository) && choices.get(repository) !== choice) {
      throw new InvalidInput(`Product ${productId} selects both source and local catalogs for ${repository}`)
    }
    choices.set(repository, choice)
  }
  const selectedClones = new Map(Object.entries(clones).map(([repository, root]) => [repositoryIdentity(repository), root]))
  const repositories: ProductCatalogRepository[] = []
  for (const [repository, selected] of [...choices].sort(([a], [b]) => a.localeCompare(b))) {
    const cloneRoot = selectedClones.get(repository) ?? (repository === homeRepository ? homeRoot : undefined)
    const sourceRead = selected === 'source' && cloneRoot
      ? repository === homeRepository && path.resolve(cloneRoot) === path.resolve(homeRoot)
        ? homeRead : await readProductCatalogPlan(cloneRoot, editingRoot)
      : null
    if (sourceRead && repositoryIdentity(sourceRead.plan.repository.id) !== repository) {
      throw new InvalidInput(`Selected checkout is not repository ${repository}`)
    }
    const localRead = selected === 'local' ? await readCatalogTarget(homeRoot, repository, 'local',
      homeRead.source.workingTree ? undefined : homeRead.source.commit ?? undefined) : null
    const belongs = (component: Component) => componentMembership(
      { ...component, repo: component.repo ?? repository }, homePlan.snapshot.products, homeRepository,
    ).productIds.includes(productId)
    const components = (selected === 'source' ? sourceRead?.plan.snapshot.components : localRead?.plan.snapshot.components)
      ?.filter(belongs) ?? []
    repositories.push({ repository, selected, source: sourceRead?.source ?? null,
      local: selected === 'local' ? homeRead.source : null, components })
  }
  return { productId, homeRepository, repositories }
}
