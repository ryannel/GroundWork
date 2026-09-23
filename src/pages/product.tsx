import { useCallback, useMemo } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Layers, Lightbulb, CheckCheck, GitFork, Boxes, X, Network, TriangleAlert } from 'lucide-react'
import { useProduct, useQuery, byUpdated } from '@/data/store'
import { clearComponentScope } from '@/data/catalog-url'
import { connectedProductIds } from '@/data/workspace-view'
import { FeatureRow, FeatureWorkList } from '@/components/feature-row'
import { ComponentOptions } from '@/components/component-structure'
import { SystemDiagram } from '@/components/system-diagram'
import { componentAncestors, featureTouchesComponent, runtimeSystemGraph } from '@/data/component-structure'
import { kinds, hueStyle } from '@/lib/taxonomy'
import { productCoverage, scanStatusLabel } from '@/data/catalog-coverage'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { useUrlFilter } from '@/ui/use-url-filter'

export function ProductPage() {
  const { slug = '', product: pslug = '' } = useParams()
  const data = useProduct(slug, pslug)
  const [params, setParams] = useSearchParams()
  const filter = useUrlFilter({ scope: 'all', view: 'active' })
  // Inspector URL changes must not restart the map's layout and simulation.
  const componentList = useMemo(() => data?.components.map(c => c.component) ?? [], [data?.components])
  const query = useQuery()
  // A new component starts with a clean catalog: stale entity, flow, finding and filter params must not carry over.
  const inspectComponent = useCallback((id: string) => setParams(previous => {
    const next = clearComponentScope(previous)
    next.set('component', id)
    return next
  }, { preventScrollReset: true }), [setParams])
  if (!data) return <Navigate to={`/w/${slug}`} replace />
  const { workspace: w, product: p, active, ideas, shipped, components, incoming } = data
  const kind = kinds[p.kind]
  const requestedScope = components.find(({ component }) => component.id === filter.get('scope'))?.component
  const scope = requestedScope && componentAncestors(requestedScope.id, query.components())[0]
  const overviewComponents = componentList.filter(c => !c.parentId)
  const view = filter.get('view') === 'ideas' ? 'ideas' : filter.get('view') === 'shipped' ? 'shipped' : 'active'
  const allActive = [...active, ...incoming].sort(byUpdated)
  const inScope = (feature: typeof active[number]) => !scope || featureTouchesComponent(feature, scope.id, query.components())
  const activeRows = allActive.filter(inScope)
  const ideaRows = ideas.filter(inScope)
  const shippedRows = shipped.filter(inScope)
  const rows = view === 'ideas' ? ideaRows : view === 'shipped' ? shippedRows : activeRows
  const views = [
    { id: 'active' as const, label: 'Active', count: activeRows.length, icon: Layers },
    { id: 'ideas' as const, label: 'Ideas', count: ideaRows.length, icon: Lightbulb },
    { id: 'shipped' as const, label: 'Shipped', count: shippedRows.length, icon: CheckCheck },
  ]
  const scopedIncoming = incoming.filter(inScope).length
  const scopedOwned = active.filter(inScope).length
  const allComponents = query.components()
  const graph = runtimeSystemGraph(componentList, allComponents)
  const selectedComponent = graph.nodes.find(component => component.id === params.get('component'))
  const unresolvedCount = componentList.reduce((sum, component) => sum + (component.unresolvedDependencies?.length ?? 0), 0)
  const coverage = productCoverage(overviewComponents)
  const hasDelivery = allActive.length + ideas.length + shipped.length > 0
  const connections = allActive.filter(feature => feature.productId !== p.id || connectedProductIds(feature, allComponents).length > 0).filter(inScope)

  return <div className="product-overview" style={hueStyle(kind.hueVar)}>
    <header className="workspace-page-header">
      <Breadcrumbs workspace={w} product={p} current={{ label: 'Product', name: p.name }} />
      <div className="workspace-hero">
        <div className="workspace-page-title"><div><div className="board-eyebrow">Product <span>·</span> {kind.label}</div><h1>{p.name}</h1><p>{p.description ?? kind.blurb}</p></div></div>
      </div>
      <div className="product-system-facts" aria-label="Product architecture status">
        <span><strong>{overviewComponents.length}</strong> components</span>
        <span><Network size={14} aria-hidden="true" /><strong>{graph.edges.length}</strong> mapped relationships</span>
        <span className={unresolvedCount ? 'has-unresolved' : ''}><TriangleAlert size={14} aria-hidden="true" /><strong>{unresolvedCount}</strong> awaiting classification</span>
        <span><strong>{coverage.complete}/{coverage.total}</strong> catalogued</span>
      </div>
    </header>

    <section className="product-components-section" aria-labelledby="product-components-heading">
      <div className="board-section-heading"><div><div className="board-eyebrow">Architecture</div><h2 id="product-components-heading">System architecture</h2><p>Start with the system map, then select a component to explore its overview, interfaces, data, and messages.</p></div></div>
      {coverage.status !== 'complete' && <div className={`catalog-scan-warning is-${coverage.status}`} role="alert">
        <TriangleAlert size={16} />
        <div><strong>{coverage.status === 'not-scanned' ? 'This product has not been scanned' : coverage.status === 'scanning' ? 'Repository scan in progress' : coverage.status === 'failed' ? 'Repository scan failed' : coverage.status === 'partial' ? 'Repository scan incomplete' : scanStatusLabel(coverage.status)}</strong><span>Only known facts are shown. APIs, dependencies, data stores, and events may be missing.</span></div>
      </div>}
      <SystemDiagram components={componentList} allComponents={allComponents} selectedId={selectedComponent?.id} onSelect={inspectComponent} />
      {!components.length && <p className="board-empty">No system structure has been added yet.</p>}
    </section>

    {!hasDelivery ? <section className="product-change-section product-change-empty" aria-labelledby="product-feature-heading">
      <div><div className="board-eyebrow">Delivery</div><h2 id="product-feature-heading">No planned changes</h2><p>Feature plans connected to this product will appear here.</p></div>
      <span>0 active</span>
    </section> : <section className="product-change-section" aria-labelledby="product-feature-heading">
      <div className="product-change-heading">
        <div><div className="board-eyebrow">Delivery</div><h2 id="product-feature-heading">Change activity</h2><p>Planned work that may alter this system and its boundaries.</p></div>
        <span>{allActive.length} active</span>
      </div>
    <div className={`workspace-work-layout product-work-layout${connections.length ? '' : ' is-solo'}`}>
      <section className="workspace-feature-section product-feature-section" aria-labelledby="product-feature-heading">
        <div className="board-section-heading"><div><h3>Plans</h3><p>{view === 'active' && scopedIncoming ? `${scopedOwned} owned by ${p.name} · ${scopedIncoming} incoming from other products` : `Feature plans owned by ${p.name}.`}</p></div><label><span className="sr-only">Component scope</span><select value={scope?.id ?? 'all'} onChange={event => filter.set('scope', event.target.value)}><option value="all">All components</option><ComponentOptions components={overviewComponents} /></select></label></div>
        <FeatureWorkList
          label="Product feature view"
          views={views}
          view={view}
          onView={id => filter.set('view', id)}
          summary={<p>{scope ? <>Touching <strong>{scope.name}</strong><button className="product-clear-filter" onClick={() => filter.set('scope', 'all')} aria-label="Clear component filter"><X size={12} /></button></> : 'Across this product'}{view === 'active' && scopedIncoming > 0 && <span> · Includes incoming work</span>}</p>}
          titleColumn="Feature / intent"
          rows={rows}
          renderRow={feature => <FeatureRow
            key={feature.id}
            feature={feature}
            showProduct={false}
            context={feature.productId !== p.id ? `Incoming from ${query.product(feature.productId)?.name ?? 'another product'}` : undefined}
          />}
          empty={<div className="workspace-list-empty">
            <Boxes size={24} />
            <h3>{view === 'ideas' ? 'No ideas here yet' : view === 'shipped' ? 'Nothing shipped here yet' : 'No active plans here'}</h3>
            <p>{scope
              ? `${view === 'ideas' ? 'No ideas' : view === 'shipped' ? 'No shipped plans' : 'No active plans'} touch ${scope.name}.`
              : view === 'active' ? 'Active plans will appear here, including work arriving from other products.'
                : view === 'ideas' ? 'Early feature ideas for this product will appear here.'
                  : 'Completed feature plans for this product will appear here.'}</p>
            {(scope || view !== 'active') && <button onClick={filter.reset}>Show all active work <ArrowRight size={13} /></button>}
          </div>}
        />
      </section>

      {connections.length > 0 && <aside className="workspace-coordination" aria-labelledby="product-connections-heading">
        <div className="coordination-heading"><span><GitFork size={17} /></span><div><h2 id="product-connections-heading">Across products</h2><p>{connections.length} active {connections.length === 1 ? 'feature' : 'features'}</p></div></div>
        <p className="coordination-intro">Work arriving here or reaching into another product.</p>
        {connections.length ? <div className="coordination-items">{connections.map(feature => {
          const isIncoming = feature.productId !== p.id
          const destinations = isIncoming
            ? p.name
            : connectedProductIds(feature, allComponents).map(id => query.product(id)?.name).filter(Boolean).join(', ')
          return <Link key={feature.id} to={`/f/${feature.id}`} className="coordination-item">
            <div className="product-connection-direction">{isIncoming ? 'Incoming change' : 'Outgoing change'}</div>
            <h3>{feature.title}<ArrowUpRight size={14} /></h3>
            <div className="coordination-route">
              <span>{query.product(feature.productId)?.name}</span><ArrowRight size={12} aria-label="touches" /><span>{destinations}</span>
            </div>
            <span className="coordination-owner">{feature.owner}</span>
          </Link>
        })}</div> : <div className="coordination-empty">No active plans cross product boundaries{scope ? ' in this component' : ' here'}.</div>}
        <div className="coordination-footnote">Follow these plans to coordinate changes between products.</div>
      </aside>}
    </div>
    </section>}
  </div>
}
