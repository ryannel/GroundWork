import { useCallback, useEffect, useMemo } from 'react'
import { Link, Navigate, useParams, useSearchParams, useLocation } from 'react-router-dom'
import { ArrowRight, Layers, Lightbulb, CheckCheck, Boxes, Search, Network, TriangleAlert, X } from 'lucide-react'
import { useRuntime } from '@/data/runtime'
import { useProduct, useQuery } from '@/data/store'
import { clearComponentScope } from '@shared/catalog-url'
import { productWork, type WorkInvolvement } from '@/data/product-work'
import { FeatureRow, FeatureWorkList, FeatureImpact } from '@/components/feature-row'
import { ComponentOptions } from '@/components/component-structure'
import { SystemDiagram } from '@/components/system-diagram'
import { componentAncestors, runtimeSystemGraph } from '@shared/component-structure'
import { kinds, hueStyle, stages } from '@/lib/taxonomy'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { ProductRepositories } from '@/components/product-repositories'
import { useProductCatalog } from '@/ui/use-product-catalog'
import { qualifyViewerComponents, selectViewerComponentId } from '@/ui/qualified-components'
import { buildIndex } from '@shared/spec-index'
import { sectionKinds } from '@shared/spec'
import { featureNextStep } from '@shared/view-models'
import type { Feature } from '@shared/model'
import { useUrlFilter } from '@/ui/use-url-filter'

const planningStages = ['exploring', 'designing', 'specced', 'building'] as const

function ProductPlanRow({ feature, productId }: { feature: Feature; productId: string }) {
  const { plan } = useRuntime()
  const delivery = plan?.delivery[feature.id]
  const blocked = delivery?.tasks.filter(task => task.status === 'blocked').length ?? 0
  const spec = feature.spec ?? {}
  const next = featureNextStep(spec, buildIndex(spec))
  const drafted = sectionKinds.filter(key => spec[key]).length
  return <div className="product-plan-entry">
    <FeatureRow feature={feature} showProduct={false} detail={<FeatureImpact feature={feature} productId={productId} />} />
    <div className="product-plan-progress">
      <span title="Drafted sections describe the plan; they do not indicate validation or delivery progress.">
        {drafted} of {sectionKinds.length} sections drafted
      </span>
      {!!delivery?.tasks.length && <span>{delivery.tasks.filter(task => task.status === 'done').length} of {delivery.tasks.length} tasks marked done</span>}
      {feature.stage !== 'shipped' && <Link
        className={blocked ? 'has-blocked-work' : undefined}
        to={`/f/${feature.id}/${blocked ? 'delivery' : next.section}`}
      >{blocked ? `${blocked} blocked ${blocked === 1 ? 'task' : 'tasks'}` : next.heading}<ArrowRight size={12} /></Link>}
    </div>
  </div>
}

export function ProductPage() {
  const { slug = '', product: pslug = '' } = useParams()
  const data = useProduct(slug, pslug)
  const { plan } = useRuntime()
  const resolvedCatalog = useProductCatalog(data?.product.id ?? '')
  const [params, setParams] = useSearchParams()
  const filter = useUrlFilter({ scope: 'all', view: 'active', stage: 'all', involvement: 'all', search: '' })
  const area = params.get('area') === 'work' ? 'work' : 'architecture'
  const { hash } = useLocation()
  const componentId = params.get('component')
  const areaHref = (next: 'architecture' | 'work') => {
    const updated = new URLSearchParams(params)
    if (next === 'architecture') updated.delete('area')
    else updated.set('area', next)
    return { search: updated.toString() ? `?${updated}` : '' }
  }
  const resetWork = () => setParams(previous => {
    const next = new URLSearchParams(previous)
    for (const key of ['scope', 'view', 'stage', 'involvement', 'search']) next.delete(key)
    return next
  }, { replace: true })
  useEffect(() => {
    if (componentId && hash === '#component-details' && area === 'architecture') {
      document.getElementById('component-details')?.scrollIntoView({ block: 'start' })
    }
  }, [componentId, area, hash])
  // Keep the architecture mounted and stable while viewing work or inspecting a contract.
  const query = useQuery()
  const homeRepository = plan?.identity.repository?.id ?? resolvedCatalog.result?.homeRepository ?? ''
  const resolvedComponents = useMemo(() => (resolvedCatalog.result?.repositories ?? []).flatMap(repository =>
    repository.components.map(component => ({ ...component, repo: component.repo ?? repository.repository }))), [resolvedCatalog.result])
  const allComponents = useMemo(() => qualifyViewerComponents(query.components(), homeRepository, resolvedComponents),
    [query, homeRepository, resolvedComponents])
  // The graph needs unique viewer IDs when two repositories use the same local component ID.
  const componentList = useMemo(() => {
    const ids = new Set([...data?.components.map(entry => entry.component) ?? [], ...resolvedComponents]
      .map(component => selectViewerComponentId(allComponents, component.repo ?? homeRepository, component.id)))
    return allComponents.filter(component => ids.has(component.id))
  }, [data?.components, resolvedComponents, allComponents, homeRepository])
  const inspectComponent = useCallback((id: string) => setParams(previous => {
    const next = clearComponentScope(previous)
    next.set('component', id)
    return next
  }, { preventScrollReset: true }), [setParams])
  if (!data) return <Navigate to="/" replace />
  const { workspace: w, product: p, active, incoming } = data
  const kind = kinds[p.kind]
  const requestedScope = componentList.find(component => component.id === filter.get('scope'))
  const scope = requestedScope && componentAncestors(requestedScope.id, allComponents)[0]
  const overviewComponents = componentList.filter(c => !c.parentId)
  const view = filter.get('view') === 'ideas' ? 'ideas' : filter.get('view') === 'shipped' ? 'shipped' : 'active'
  const stage = planningStages.find(item => item === filter.get('stage'))
  const involvement: WorkInvolvement = ['owned', 'incoming', 'shared'].includes(filter.get('involvement'))
    ? filter.get('involvement') as WorkInvolvement : 'all'
  const work = productWork(query.features(), allComponents, query.products(), p.id, {
    status: view,
    stage,
    involvement,
    componentIds: scope ? query.scope(scope.id) : undefined,
    search: filter.get('search'),
  })
  const views = [
    { id: 'active' as const, label: 'Active', count: work.counts.active, icon: Layers },
    { id: 'ideas' as const, label: 'Ideas', count: work.counts.ideas, icon: Lightbulb },
    { id: 'shipped' as const, label: 'Shipped', count: work.counts.shipped, icon: CheckCheck },
  ]
  const graph = runtimeSystemGraph(componentList, allComponents)
  const selectedComponent = [...graph.nodes, ...graph.supporting].find(component => component.id === componentId)
  const unresolvedCount = componentList.reduce((sum, component) => sum + (component.unresolvedDependencies?.length ?? 0), 0)
  const hasFilters = !!scope || !!stage || involvement !== 'all' || !!filter.get('search') || view !== 'active'

  return <div className="product-overview" style={hueStyle(kind.hueVar)}>
    <header className="workspace-page-header product-header">
      <Breadcrumbs workspace={w} product={p} current={{ label: 'Product', name: p.name }} />
      <div className="workspace-page-title">
        <div>
          <div className="board-eyebrow">{kind.label}</div>
          <h1>{p.name}</h1>
          <p>{p.description ?? kind.blurb}</p>
        </div>
      </div>
      <nav className="product-navigation" aria-label="Product pages">
        <Link to={areaHref('architecture')} aria-current={area === 'architecture' ? 'page' : undefined} onClick={() => window.scrollTo({ top: 0 })}>
          <Network size={16} aria-hidden="true" />Architecture
        </Link>
        <Link to={areaHref('work')} aria-current={area === 'work' ? 'page' : undefined} onClick={() => window.scrollTo({ top: 0 })}>
          <Layers size={16} aria-hidden="true" />Work
          <span className="product-nav-count" aria-label={`${active.length + incoming.length} active features`}>
            {active.length + incoming.length}
          </span>
        </Link>
      </nav>
    </header>

    <ProductRepositories product={p} resolved={resolvedCatalog} />

    <section className="product-page-body" aria-labelledby="product-architecture-heading" hidden={area !== 'architecture'}>
      <div className="product-view-heading">
        <div><h2 id="product-architecture-heading">Architecture</h2><p>Explore the components, connections and contracts that make up {p.name}.</p></div>
        {!!componentList.length && <a href="#component-details" className="board-action" onClick={event => {
          event.preventDefault()
          const target = document.getElementById('component-details')
          target?.scrollIntoView({ block: 'start' })
          target?.focus({ preventScroll: true })
        }}>Component directory<ArrowRight size={14} /></a>}
      </div>
      <div className="product-system-facts" aria-label="Product architecture status">
        <span><strong>{overviewComponents.length}</strong> {overviewComponents.length === 1 ? 'component' : 'components'}</span>
        <span><strong>{graph.edges.length}</strong> direct dependencies</span>
        <span><strong>{resolvedComponents.length}</strong> catalog documents</span>
        {!!unresolvedCount && <span className="has-unresolved">
          <TriangleAlert size={13} aria-hidden="true" /><strong>{unresolvedCount}</strong> awaiting classification
        </span>}
      </div>
      <SystemDiagram components={componentList} allComponents={allComponents} selectedId={selectedComponent?.id} onSelect={inspectComponent} />
    </section>

    <section className="product-page-body product-work-page" aria-labelledby="product-work-heading" hidden={area !== 'work'}>
      <div className="product-view-heading"><div>
        <h2 id="product-work-heading">Feature work</h2>
        <p>Plans owned by {p.name}, plus changes from other products that affect it.</p>
      </div></div>
      {work.relevant.length ? <>
        <FeatureWorkList
          label="Feature status"
          views={views}
          view={view}
          onView={id => setParams(previous => {
            const next = new URLSearchParams(previous)
            next.set('view', id)
            next.delete('stage')
            return next
          }, { replace: true })}
          controls={<label className="work-search">
            <Search size={15} aria-hidden="true" />
            <span className="sr-only">Search feature work</span>
            <input type="search" placeholder="Find a feature…" value={filter.get('search')} onChange={event => filter.set('search', event.target.value)} />
          </label>}
          summary={<div className="work-filters">
            <label><span className="sr-only">Product involvement</span>
              <select aria-label="Product involvement" value={involvement} onChange={event => filter.set('involvement', event.target.value)}>
              <option value="all">All relevant work</option>
              <option value="owned">Owned by {p.name}</option>
              <option value="incoming">From other products</option>
              <option value="shared">Involves other products</option>
            </select></label>
            <label><span className="sr-only">Component scope</span>
              <select value={scope?.id ?? 'all'} onChange={event => filter.set('scope', event.target.value)}>
                <option value="all">All components</option><ComponentOptions components={overviewComponents} />
              </select>
            </label>
            {view === 'active' && <label><span className="sr-only">Planning stage</span>
              <select value={stage ?? 'all'} onChange={event => filter.set('stage', event.target.value)}>
                <option value="all">All stages</option>
                {planningStages.map(item => <option key={item} value={item}>
                  {stages[item].label} ({work.active.filter(feature => feature.stage === item).length})
                </option>)}
              </select>
            </label>}
            {hasFilters && <button className="work-reset" onClick={resetWork}><X size={13} />Clear filters</button>}
          </div>}
          titleColumn="Feature"
          rows={work.rows}
          renderRow={feature => <ProductPlanRow key={feature.id} feature={feature} productId={p.id} />}
          empty={<div className="workspace-list-empty">
            <Search size={22} />
            <h3>No features match this view</h3>
            <p>Adjust the status, product involvement or component filters to see more work.</p>
            <button onClick={resetWork}>Show all active work<ArrowRight size={13} /></button>
          </div>}
        />
      </> : <div className="product-work-empty">
        <Boxes size={28} aria-hidden="true" />
        <h3>No feature plans yet</h3>
        <p>Describe a change to your agent to start a plan. Its purpose, affected components and delivery progress will appear here.</p>
      </div>}
    </section>
  </div>
}
