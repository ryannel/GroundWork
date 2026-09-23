/**
 * Pure view models for the viewer pages. Everything here is plain data in, plain data out, so the
 * decisions users act on (what to do next, what a product contains) are tested without React.
 */
import type { FeatureSpec, SectionKind } from './spec.ts'
import type { SpecIndex } from './spec-index.ts'
import type { Delivery, Validation } from './delivery.ts'

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
  name: string
  /** Link to the product in its primary checkout; absent when every checkout failed to load. */
  href?: string
  components: number
  repositories: number
  active: number
  ideas: number
  shipped: number
}
export interface HubWorkspace { name: string; products: HubProduct[] }

/**
 * Hub project list. A product can be registered from several checkouts of the same repository; each
 * repository counts once, through its primary checkout (the one at the repository root, else any
 * checkout that loaded). Components are de-duplicated per source repository.
 */
export function summarizeHubProducts(projects: HubCheckout[]): HubWorkspace[] {
  const unique = (values: string[]) => [...new Set(values)]
  return unique(projects.map(p => p.workspace)).map(workspace => {
    const inWorkspace = projects.filter(p => p.workspace === workspace)
    const products = unique(inWorkspace.map(p => p.product)).map(name => {
      const checkouts = inWorkspace.filter(p => p.product === name)
      const primary = unique(checkouts.map(p => p.repositoryRoot)).flatMap(root => {
        const candidates = checkouts.filter(p => p.repositoryRoot === root)
        const found = candidates.find(p => p.root === root && !p.error) ?? candidates.find(p => !p.error)
        return found ? [found] : []
      })
      const components = new Set(primary.flatMap(c => c.components).map(c => `${c.repository ?? ''}:${c.id}`))
      const features = primary.flatMap(c => c.features)
      const entry = primary[0]
      return {
        name,
        href: entry && `/p/${entry.checkoutId}${entry.productPath ?? '/'}`,
        components: components.size,
        repositories: unique(primary.flatMap(c => c.repositories)).length,
        active: features.filter(f => f.stage !== 'idea' && f.stage !== 'shipped').length,
        ideas: features.filter(f => f.stage === 'idea').length,
        shipped: features.filter(f => f.stage === 'shipped').length,
      }
    })
    return { name: workspace, products }
  })
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
