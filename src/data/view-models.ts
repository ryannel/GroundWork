/**
 * Pure view models for the viewer pages. Everything here is plain data in, plain data out, so the
 * decisions users act on (what to do next, what a product contains) are tested without React.
 */
import type { FeatureSpec, SectionKind } from './spec.ts'
import type { SpecIndex } from './spec-index.ts'
import type { Delivery, Validation } from './delivery.ts'

/** A product's address is stable across workspace reorganisation and checkout folder names. */
export const productRoute = (homeRepository: string, slug: string) =>
  `/r/${encodeURIComponent(homeRepository)}/${encodeURIComponent(slug)}`

/** Resolve a pre-migration product bookmark in the catalog currently open in this checkout. */
export function legacyProductRoute(
  homeRepository: string | undefined,
  snapshot: { workspaces: { id: string; slug: string }[]; products: { slug: string; workspaceId?: string }[] } | undefined,
  workspaceSlug: string,
  productSlug: string,
): string | null {
  if (!homeRepository || !snapshot) return null
  const workspace = snapshot.workspaces.find(item => item.slug === workspaceSlug)
  const product = snapshot.products.find(item => item.slug === productSlug
    && (workspace ? item.workspaceId === workspace.id : workspaceSlug === 'project'))
  return product ? productRoute(homeRepository, product.slug) : null
}

/**
 * Key for the app's routes. It names the checkout only, so plan edits (new revisions) re-render in place and keep
 * scroll, focus and open panels; switching checkout remounts.
 */
export function routesKey(plan: { context: { token: string } } | null | undefined): string {
  return plan?.context.token ?? 'unavailable'
}

/** The registered-checkout fields the Hub list reads; structurally the runtime's Checkout. */
export interface HubCheckout {
  checkoutId: string
  registryVersion: 2 | 3
  repositoryId: string
  productRefs: { repository: string; product: string; slug: string; name: string; path: string; workspaceNames: string[];
    componentIds: string[]; componentKeys: string[]; declaredRepositories: string[]; features: { stage: string }[] }[]
  preferred: boolean
  authoritativeHome: boolean
  cloneDisagreement?: { status: 'different' | 'diverged' | 'unknown'; heads: { root: string; head: string | null }[] } | null
  root: string
  repositoryRoot: string
  repositories: string[]
  components: { id: string; repository: string | null }[]
  productPath: string | null
  workspace: string
  product: string
  features: { stage: string }[]
  error: string | null
}

/** Items a test ought to prove that have no linked test: criteria, journey steps, contracts and stored records. */
export function featureGaps(spec: FeatureSpec, ix: SpecIndex): number {
  const tableGaps = (spec.storage?.tables ?? []).filter(t => t.change !== 'removed' && !ix.tableTests[t.id]?.length)
  return ix.untestedSteps.length + ix.untestedContracts.length + ix.unprovenCriteria.length + tableGaps.length
}

export interface NextStep {
  /** Coverage gaps; when non-zero the panel asks for evidence rather than suggesting a step. */
  gaps: number
  heading: string
  body: string
  section: Extract<SectionKind, 'purpose' | 'tests'>
  linkLabel: string
  cases: number
  passing: number
}

const gapSummary = (gaps: number, firstGap?: string) => {
  const items = `${gaps} ${gaps === 1 ? 'item has' : 'items have'} no linked test`
  if (!firstGap) return `${items}.`
  return `${items}${gaps === 1 ? ': ' : '. One gap: '}${firstGap.replace(/[.!?]$/, '')}.`
}

/** The single next step on a feature overview: brief first, then coverage gaps, then test evidence. */
export function featureNextStep(spec: FeatureSpec, ix: SpecIndex): NextStep {
  const cases = spec.tests?.cases ?? []
  const passing = cases.filter(c => c.status === 'passing').length
  const gaps = featureGaps(spec, ix)
  const counts = { gaps, cases: cases.length, passing }
  if (!spec.purpose) {
    return {
      ...counts, section: 'purpose', linkLabel: 'Start with the brief', heading: 'Shape the brief',
      body: 'Turn the intent into a clear outcome, scope, and success criteria.',
    }
  }
  const review = { ...counts, section: 'tests' as const, linkLabel: 'Review tests & coverage' }
  if (gaps) {
    const firstGap = ix.unprovenCriteria.length ? ix.criterion[ix.unprovenCriteria[0]]?.text : undefined
    return { ...review, heading: 'Close the validation gaps', body: gapSummary(gaps, firstGap) }
  }
  if (!cases.length) return { ...review, heading: 'Plan the validation', body: 'Connect tests to the outcomes and changes this feature promises.' }
  if (passing < cases.length) {
    return { ...review, heading: 'Review test evidence', body: `${cases.length - passing} of ${cases.length} tests are not marked passing yet.` }
  }
  return { ...review, heading: 'Review the plan', body: 'All listed tests are marked passing. Review the results alongside the intended outcome.' }
}

export interface HubProduct {
  id: string
  name: string
  /** Link to the product in its primary checkout; absent when every checkout failed to load. */
  href?: string
  components: number
  repositories: number
  active: number
  ideas: number
  shipped: number
  cloneWarnings: { repository: string; status: 'different' | 'diverged' | 'unknown' }[]
}
export interface HubWorkspace { name: string; products: HubProduct[] }

/** Transitional display while the local v2 registry awaits confirmed label mappings. */
function summarizeLegacyHub(projects: HubCheckout[]): HubWorkspace[] {
  const unique = (values: string[]) => [...new Set(values)]
  return unique(projects.map(p => p.workspace)).map(workspace => ({
    name: workspace,
    products: unique(projects.filter(p => p.workspace === workspace).map(p => p.product)).map(name => {
      const checkouts = projects.filter(p => p.workspace === workspace && p.product === name)
      const primary = unique(checkouts.map(p => p.repositoryRoot)).flatMap(root => {
        const candidates = checkouts.filter(p => p.repositoryRoot === root)
        const found = candidates.find(p => p.root === root && !p.error) ?? candidates.find(p => !p.error)
        return found ? [found] : []
      })
      const components = new Set(primary.flatMap(c => c.components).map(c => `${c.repository ?? ''}:${c.id}`))
      const features = primary.flatMap(c => c.features)
      const entry = primary[0]
      return {
        id: JSON.stringify([workspace, name]), name,
        href: entry ? `/p/${entry.checkoutId}${entry.productPath ?? '/'}` : undefined,
        components: components.size,
        repositories: unique(primary.flatMap(c => c.repositories)).length,
        active: features.filter(f => f.stage !== 'idea' && f.stage !== 'shipped').length,
        ideas: features.filter(f => f.stage === 'idea').length,
        shipped: features.filter(f => f.stage === 'shipped').length,
        cloneWarnings: [],
      }
    }),
  }))
}

/**
 * Hub workspace views group exact product references, independent of checkout labels or display names.
 * A product can occur in several views, and a source repository can contribute to several products.
 */
export function summarizeHubProducts(projects: HubCheckout[]): HubWorkspace[] {
  if (projects.length && projects.every(p => p.registryVersion === 2)) return summarizeLegacyHub(projects)
  const views = new Map<string, Map<string, { id: string; name: string; repository: string; path: string; checkouts: HubCheckout[] }>>()
  for (const checkout of projects) for (const ref of checkout.productRefs) for (const workspace of ref.workspaceNames.length ? ref.workspaceNames : ['Other products']) {
    const products = views.get(workspace) ?? new Map()
    views.set(workspace, products)
    const key = JSON.stringify([ref.repository, ref.product])
    const entry = products.get(key) ?? { id: key, name: ref.name, repository: ref.repository, path: ref.path, checkouts: [] }
    if (!entry.checkouts.includes(checkout)) entry.checkouts.push(checkout)
    products.set(key, entry)
  }
  return [...views].map(([name, products]) => ({ name, products: [...products.values()].map(product => {
    const byRepository = new Map<string, HubCheckout[]>()
    for (const checkout of product.checkouts) {
      const candidates = byRepository.get(checkout.repositoryId) ?? []
      candidates.push(checkout)
      byRepository.set(checkout.repositoryId, candidates)
    }
    const primary = [...byRepository].flatMap(([repository, candidates]) => {
      const found = (repository === product.repository ? candidates.find(p => p.authoritativeHome && !p.error) : undefined)
        ?? candidates.find(p => p.preferred && !p.error)
        ?? candidates.find(p => p.root === p.repositoryRoot && !p.error)
        ?? candidates.find(p => !p.error)
      return found ? [found] : []
    })
    const home = primary.find(item => item.repositoryId === product.repository && item.authoritativeHome)
    const scopedRef = (checkout: HubCheckout) => checkout.productRefs.find(ref =>
      JSON.stringify([ref.repository, ref.product]) === product.id)
    const components = new Set(primary.flatMap(checkout => scopedRef(checkout)?.componentKeys ?? []))
    const features = home ? scopedRef(home)?.features ?? [] : []
    const cloneWarnings = primary.flatMap(checkout => checkout.cloneDisagreement
      ? [{ repository: checkout.repositoryId, status: checkout.cloneDisagreement.status }] : [])
    return {
      id: product.id,
      name: product.name,
      href: home ? `/p/${home.checkoutId}${product.path}` : undefined,
      components: components.size,
      repositories: home ? new Set(scopedRef(home)?.declaredRepositories ?? []).size : 0,
      active: features.filter(f => f.stage !== 'idea' && f.stage !== 'shipped').length,
      ideas: features.filter(f => f.stage === 'idea').length,
      shipped: features.filter(f => f.stage === 'shipped').length,
      cloneWarnings,
    }
  }) }))
}

/** Branches in the checkout that no feature delivery links to. */
export function unlinkedBranches(plan: { delivery: Record<string, Pick<Delivery, 'branches'>>; activity: { branches: string[] } }): string[] {
  const linked = new Set(Object.values(plan.delivery).flatMap(d => d.branches.map(b => b.branch)))
  return plan.activity.branches.filter(branch => !linked.has(branch))
}

export const validationLevelLabel: Record<Validation['level'], string> = {
  'end-to-end': 'End-to-end · connected system',
  'component-integration': 'Honeycomb · component boundary',
  unit: 'Unit · isolated logic',
}

/** Reverse a one-to-many index. A Map, so IDs such as `constructor` never resolve to Object.prototype members. */
export function invert(index: Record<string, string[]>): Map<string, string[]> {
  const reversed = new Map<string, string[]>()
  for (const [key, values] of Object.entries(index)) for (const value of values) reversed.set(value, [...reversed.get(value) ?? [], key])
  return reversed
}
