import { useLayoutEffect, useMemo, useRef, type ComponentType, type Ref } from 'react'
import { Link, Navigate, useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowLeft, LayoutDashboard, Circle, CheckCircle2, Layers, AlertCircle } from 'lucide-react'
import type { Component, Feature, Product } from '@shared/model'
import { useQuery, relTime } from '@/data/store'
import { useRuntime } from '@/data/runtime'
import { productRoute } from '@shared/view-models'
import { sectionKinds, type FeatureSpec, type SectionKind } from '@shared/spec'
import { buildIndex, lensFor } from '@shared/spec-index'
import { componentScopeIds, featureComponents } from '@shared/component-structure'
import { sectionMeta, sectionRenderers, sectionCount, SpecContext } from '@/components/spec'
import type { SpecCtx } from '@/components/spec/context'
import { ComponentOptions } from '@/components/component-structure'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { StageBadge } from '@/ui/badge'
import { Avatar } from '@/ui/avatar'
import { cn } from '@/lib/cn'
import { DeliveryPage } from './delivery'
import { FeatureOverview, OverviewHeader, type SectionGroup, type SectionHref } from './feature-overview'

const groups: SectionGroup[] = [
  { label: 'Define', sections: ['purpose'] },
  { label: 'Experience', sections: ['journey', 'design'] },
  { label: 'Build', sections: ['flow', 'api', 'storage'] },
  { label: 'Validate', sections: ['tests'] },
]
const groupTitle = (group: SectionGroup) => `0${groups.indexOf(group) + 1} · ${group.label}`
const questions: Record<SectionKind, string> = {
  purpose: 'What problem are we solving, and what does success look like?',
  journey: 'Follow the experience, from the first action to the final outcome.',
  design: 'Explore the screens and try the interactions behind the journey.',
  flow: 'Trace a user action through the components that make it happen.',
  api: 'Explore each component’s API and the changes needed to support this feature.',
  storage: 'Understand what we store, who owns it, and how the schema changes.',
  tests: 'Separate what is covered from what has actually passed.',
}
/** Sections whose content follows the component scope selector. */
const scopedSections: SectionKind[] = ['journey', 'flow', 'tests']
const emptySpec: FeatureSpec = {}
const deliveryLabel = 'Deliverables & tasks'

function FeatureNav({ spec, product, productHref, current, href }: {
  spec: FeatureSpec
  product: Product
  productHref: string
  current: SectionKind | 'delivery' | undefined
  href: SectionHref
}) {
  const navigate = useNavigate()
  const present = sectionKinds.filter(k => spec[k])
  const linkProps = (k: SectionKind | 'delivery' | undefined) => ({
    to: href(k),
    'aria-current': current === k ? 'page' as const : undefined,
    className: cn('plan-nav-link', current === k && 'is-active'),
  })
  return <>
    <label className="mobile-section-picker">Explore this feature
      <select value={current ?? ''} onChange={e => navigate(href(e.target.value ? e.target.value as SectionKind | 'delivery' : undefined))}>
        <option value="">Overview</option>
        {groups.map(g => <optgroup key={g.label} label={groupTitle(g)}>
          {g.sections.map(k => <option key={k} value={k}>{sectionMeta[k].label}{!spec[k] ? ' · Not drafted' : ''}</option>)}
        </optgroup>)}
        <option value="delivery">{deliveryLabel}</option>
      </select>
    </label>
    <aside className="feature-nav">
      <Link to={`${productHref}?area=work`} className="back-product"><ArrowLeft size={14} />{product.name}</Link>
      <div className="eyebrow mb-3 mt-7">Feature plan</div>
      <Link {...linkProps(undefined)}><LayoutDashboard size={16} />Overview</Link>
      {groups.map(g => <div className="nav-group" key={g.label}>
        <div className="eyebrow">{groupTitle(g)}</div>
        {g.sections.map(k => {
          const Icon = sectionMeta[k].icon
          return <Link key={k} {...linkProps(k)}>
            <Icon className="size-4" /><span>{sectionMeta[k].label}</span>
            <span className="nav-count">{spec[k] ? sectionCount(spec, k) ?? <CheckCircle2 size={12} /> : <Circle size={10} />}</span>
          </Link>
        })}
      </div>)}
      <div className="nav-group">
        <div className="eyebrow">05 · Deliver</div>
        <Link {...linkProps('delivery')}><Layers size={16} />{deliveryLabel}</Link>
      </div>
      <div className="nav-foot"><Layers size={15} />
        <span>{present.length} of {sectionKinds.length} sections drafted<br /><small>Drafted does not mean validated</small></span>
      </div>
    </aside>
  </>
}

function FocusedHeader({ feature, product, productHref }: {
  feature: Feature
  product: Product
  productHref: string
}) {
  return <>
    <header className="feature-heading">
      <Link to={`${productHref}?area=work`} aria-label={`Back to ${product.name} work`}><ArrowLeft size={16} /></Link>
      <span className="feature-id">{feature.id.toUpperCase()}</span><h1>{feature.title}</h1><StageBadge stage={feature.stage} />
      <div className="feature-meta">
        <span className="meta-owner-label">Owner</span><Avatar name={feature.owner} className="owner-avatar" /><span>{feature.owner}</span>
        <time dateTime={feature.updatedAt} title={new Date(feature.updatedAt).toLocaleString()}>Updated {relTime(feature.updatedAt)}</time>
      </div>
    </header>

  </>
}

function FocusedSection({ target, spec, item, lensId, lensName, participants, headingRef, href, exampleFeature }: {
  target: SectionKind
  spec: FeatureSpec
  item?: string
  lensId?: string
  lensName?: string
  participants: Component[]
  headingRef: Ref<HTMLHeadingElement>
  href: SectionHref
  exampleFeature?: Feature
}) {
  const [, setParams] = useSearchParams()
  const meta = sectionMeta[target]
  const Render = sectionRenderers[target] as ComponentType<{ data: unknown; focus?: string }>
  const index = sectionKinds.indexOf(target)
  const previous = sectionKinds[index - 1]
  const next = sectionKinds[index + 1]
  const setScope = (component: string) => setParams(p => {
    const n = new URLSearchParams(p)
    if (component) n.set('component', component)
    else n.delete('component')
    return n
  })
  const scopeNote = scopedSections.includes(target)
    ? `Showing ${lensName} and its internals. Dependencies remain separate scopes.`
    : `Showing full ${meta.label.toLowerCase()}. Component scope applies to journey, system, and tests.`
  return <section className="focused-section">
    <div className="section-intro">
      <div>
        <div className="eyebrow">{groupTitle(groups.find(g => g.sections.includes(target))!)}</div>
        <h2 ref={headingRef} tabIndex={-1}>{meta.label}</h2>
        <p>{questions[target]}</p>
      </div>
      {scopedSections.includes(target) && <label className="component-filter">Component scope
        <select value={lensId ?? ''} onChange={e => setScope(e.target.value)}>
          <option value="">All components</option><ComponentOptions components={participants} />
        </select>
      </label>}
    </div>
    {lensName && target !== 'api' && target !== 'storage' && <div className="scope-banner">
      <Layers size={15} /><span>{scopeNote}</span><button onClick={() => setScope('')}>Clear scope</button>
    </div>}
    {spec[target] ? <Render data={spec[target]} focus={item} /> : <div className="section-empty">
      <AlertCircle size={28} />
      <h3>{meta.label} has not been drafted</h3>
      <p>{meta.blurb}</p>
      <p className="text-small">Your AI assistant can populate this section from the feature intent and supporting context.</p>
      {exampleFeature && <Link to={`/f/${exampleFeature.id}/${target}`}>See {meta.label.toLowerCase()} in {exampleFeature.title}<ArrowRight size={14} /></Link>}
    </div>}
    <footer className="section-footer">
      <Link to={href(previous)}><ArrowLeft size={14} />{previous ? sectionMeta[previous].label : 'Overview'}</Link>
      <Link to={href(next ?? 'delivery')}>{next ? sectionMeta[next].label : deliveryLabel}<ArrowRight size={14} /></Link>
    </footer>
  </section>
}

export function FeaturePage() {
  const { id = '', section, item } = useParams()
  const q = useQuery()
  const { plan } = useRuntime()
  const [params] = useSearchParams()
  const feature = q.features().find(x => x.id === id)
  const spec = feature?.spec ?? emptySpec
  const ix = useMemo(() => buildIndex(spec), [spec])
  const allComponents = q.components()
  const participants = useMemo(() => feature ? featureComponents(feature, allComponents) : [], [feature, allComponents])
  const lensComponent = participants.find(c => c.id === params.get('component'))
  const lens = useMemo(() => lensComponent && lensFor(spec, ix, componentScopeIds(lensComponent.id, allComponents)), [spec, ix, lensComponent, allComponents])
  const lensName = lensComponent && q.componentLabel(lensComponent.id)
  const context = useMemo<SpecCtx>(() => ({ featureId: id, spec, ix, lens, lensName }), [id, spec, ix, lens, lensName])
  const heading = useRef<HTMLHeadingElement>(null)
  // Before paint: start a new section at the top and move focus to its heading so screen readers announce it.
  // A deep-linked item handles its own scroll and focus. A ref tracks the navigation this effect last
  // handled, since id and section are not read in its body (only item is).
  const navigationKey = `${id}:${section ?? ''}:${item ?? ''}`
  const handledNavigation = useRef<string | undefined>(undefined)
  useLayoutEffect(() => {
    if (handledNavigation.current === navigationKey) return
    handledNavigation.current = navigationKey
    if (item) return
    window.scrollTo({ top: 0 })
    heading.current?.focus({ preventScroll: true })
  })

  const isDelivery = section === 'delivery'
  const target = sectionKinds.includes(section as SectionKind) ? section as SectionKind : undefined
  const product = feature && q.product(feature.productId)
  const workspace = product && q.workspace(product.workspaceId)
  if (!feature || !product) return <Navigate to="/" replace />
  const homeRepository = plan?.identity.repository?.id
  const productHref = workspace ? `/w/${workspace.slug}/${product.slug}`
    : homeRepository ? productRoute(homeRepository, product.slug) : '/'
  if (section && !target && !isDelivery) return <Navigate to={`/f/${id}`} replace />
  const current = isDelivery ? 'delivery' : target
  const trace = params.get('trace')
  const currentAction = trace?.startsWith('journey:') ? ix.step[trace.slice(8)] : undefined
  const href: SectionHref = k => {
    const query = new URLSearchParams()
    if (lensComponent) query.set('component', lensComponent.id)
    if (currentAction) query.set('trace', `journey:${currentAction.id}`)
    return `/f/${id}${k ? `/${k}` : ''}${query.size ? `?${query}` : ''}`
  }
  const componentHref = (componentId: string) => {
    const scope = componentScopeIds(componentId, allComponents)
    const includesComponent = (step: typeof currentAction) => step?.flow?.some(nodeId => scope.has(ix.node[nodeId]?.component ?? ''))
    const action = includesComponent(currentAction) ? currentAction : spec.journey?.steps.find(includesComponent)
    if (action) return `/f/${id}/flow?${new URLSearchParams({ component: componentId, trace: `journey:${action.id}` })}`
    const owner = q.componentOwner(componentId)
    const parent = owner && q.workspace(owner.workspaceId)
    const ownerHref = owner && (parent ? `/w/${parent.slug}/${owner.slug}`
      : homeRepository ? productRoute(homeRepository, owner.slug) : undefined)
    return ownerHref ? `${ownerHref}?component=${encodeURIComponent(componentId)}` : href('flow')
  }
  const exampleFeature = target && q.features().find(other => other.id !== id && other.spec?.[target])

  return <SpecContext.Provider value={context}>
    <div className={cn('feature-workspace', !current && 'is-overview', current && 'is-focused', target === 'flow' && 'is-flow')}>
      <FeatureNav spec={spec} product={product} productHref={productHref} current={current} href={href} />
      <div className="feature-main">
        <Breadcrumbs workspace={workspace} product={product} current={{ label: 'Feature', name: feature.title }} className="feature-page-breadcrumb" />
        {current
          ? <FocusedHeader feature={feature} product={product} productHref={productHref} />
          : <OverviewHeader
            feature={feature}
            headingRef={heading}
            updated={relTime(feature.updatedAt)}
          />}
        {isDelivery
          ? <DeliveryPage embedded headingRef={heading} />
          : target
            ? <FocusedSection key={`${id}-${target}`} target={target} spec={spec} item={item}
              lensId={lensComponent?.id} lensName={lensName} participants={participants}
              headingRef={heading} href={href} exampleFeature={exampleFeature} />
            : <FeatureOverview feature={feature} spec={spec} ix={ix} groups={groups} href={href} componentHref={componentHref}
              participants={participants} allComponents={allComponents} delivery={plan?.delivery[id]} />}
      </div>
    </div>
  </SpecContext.Provider>
}
