import { useRef } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, ChevronRight, Layers, Lightbulb, CheckCheck, GitFork, Boxes, X } from 'lucide-react'
import { useProduct, q, byUpdated } from '@/data/store'
import { connectedProductIds } from '@/data/workspace-view'
import { FeatureRow } from '@/components/feature-row'
import { ComponentOptions, ProductArchitecture } from '@/components/component-structure'
import { SystemDiagram } from '@/components/system-diagram'
import { componentAncestors, featureTouchesComponent } from '@/data/component-structure'
import { kinds, hueStyle } from '@/lib/taxonomy'

export function ProductPage() {
  const { slug = '', product: pslug = '' } = useParams()
  const data = useProduct(slug, pslug)
  const [params, setParams] = useSearchParams()
  const featureSection = useRef<HTMLElement>(null)
  if (!data) return <Navigate to={`/w/${slug}`} replace />
  const { workspace: w, product: p, active, ideas, shipped, components, incoming } = data
  const kind = kinds[p.kind]
  const requestedScope = components.find(({ component }) => component.id === params.get('component'))?.component
  const scope = requestedScope && componentAncestors(requestedScope.id, q.components())[0]
  const overviewComponents = components.map(c => c.component).filter(c => !c.parentId)
  const view = params.get('view') === 'ideas' ? 'ideas' : params.get('view') === 'shipped' ? 'shipped' : 'active'
  const allActive = [...active, ...incoming].sort(byUpdated)
  const inScope = (feature: typeof active[number]) => !scope || featureTouchesComponent(feature, scope.id, q.components())
  const views = [
    { id: 'active', label: 'Active', rows: allActive.filter(inScope), icon: Layers },
    { id: 'ideas', label: 'Ideas', rows: ideas.filter(inScope), icon: Lightbulb },
    { id: 'shipped', label: 'Shipped', rows: shipped.filter(inScope), icon: CheckCheck },
  ]
  const rows = views.find(item => item.id === view)!.rows
  const scopedIncoming = incoming.filter(inScope).length
  const scopedOwned = active.filter(inScope).length
  const allComponents = q.components()
  const connections = allActive.filter(feature => feature.productId !== p.id || connectedProductIds(feature, allComponents).length > 0).filter(inScope)
  const update = (key: string, value: string) => setParams(previous => {
    const next = new URLSearchParams(previous)
    if (value === 'all' || value === 'active') next.delete(key)
    else next.set(key, value)
    return next
  }, { replace: true })
  const showComponentWork = (id: string) => {
    setParams({ component: id }, { replace: true })
    featureSection.current?.scrollIntoView({ block: 'start' })
    featureSection.current?.focus({ preventScroll: true })
  }

  return <div className="product-overview" style={hueStyle(kind.hueVar)}>
    <header className="workspace-page-header">
      <nav aria-label="Breadcrumb" className="workspace-breadcrumb"><Link to="/">Workspaces</Link><ChevronRight size={13} /><Link to={`/w/${w.slug}`}>{w.name}</Link><ChevronRight size={13} /><span aria-current="page">{p.name}</span></nav>
      <div className="workspace-hero">
        <div className="workspace-page-title"><span className="workspace-emblem workspace-emblem-large" aria-hidden="true"><kind.icon strokeWidth={1.6} /></span><div><div className="board-eyebrow">Product <span>·</span> {kind.label}</div><h1 className="text-display">{p.name}</h1><p>{p.description ?? kind.blurb}</p></div></div>
        <dl className="board-totals"><div><dt>Active plans</dt><dd>{allActive.length}</dd></div><div><dt>{components.some(c => c.component.kind === 'service') ? 'Services' : 'Components'}</dt><dd>{components.some(c => c.component.kind === 'service') ? components.filter(c => c.component.kind === 'service').length : components.filter(c => !c.component.parentId).length}</dd></div></dl>
      </div>
    </header>

    <div className="workspace-work-layout product-work-layout">
      <section className="workspace-feature-section product-feature-section" aria-labelledby="product-feature-heading" ref={featureSection} tabIndex={-1}>
        <div className="board-section-heading"><div><h2 id="product-feature-heading">Feature work</h2><p>{view === 'active' && scopedIncoming ? `${scopedOwned} owned by ${p.name} · ${scopedIncoming} incoming from other products` : `Feature plans owned by ${p.name}.`}</p></div><label><span className="sr-only">Component scope</span><select value={scope?.id ?? 'all'} onChange={event => update('component', event.target.value)}><option value="all">All components</option><ComponentOptions components={overviewComponents} /></select></label></div>
        <div className="board-work-tabs" role="group" aria-label="Product feature view">{views.map(item => <button key={item.id} aria-pressed={view === item.id} onClick={() => update('view', item.id)}><item.icon size={14} aria-hidden="true" />{item.label}<span>{item.rows.length}</span></button>)}</div>
        <div className="board-list-context"><p>{scope ? <>Touching <strong>{scope.name}</strong><button className="product-clear-filter" onClick={() => update('component', 'all')} aria-label="Clear component filter"><X size={12} /></button></> : 'Across this product'}{view === 'active' && scopedIncoming > 0 && <span> · Includes incoming work</span>}</p><span aria-live="polite">{rows.length} {rows.length === 1 ? 'feature' : 'features'} · Latest updates first</span></div>
        {rows.length ? <div className="board-feature-list"><div className="feature-list-labels" aria-hidden="true"><span>Feature / intent</span><span>Stage</span><span>Owner</span><span>Updated</span></div>{rows.map(feature => <FeatureRow key={feature.id} feature={feature} showProduct={false} context={feature.productId !== p.id ? `Incoming from ${q.product(feature.productId)?.name ?? 'another product'}` : undefined} />)}</div> : <div className="workspace-list-empty"><Boxes size={24} /><h3>{view === 'ideas' ? 'No ideas here yet' : view === 'shipped' ? 'Nothing shipped here yet' : 'No active plans here'}</h3><p>{scope ? `${view === 'ideas' ? 'No ideas' : view === 'shipped' ? 'No shipped plans' : 'No active plans'} touch ${scope.name}.` : view === 'active' ? 'Active plans will appear here, including work arriving from other products.' : view === 'ideas' ? 'Early feature ideas for this product will appear here.' : 'Completed feature plans for this product will appear here.'}</p>{(scope || view !== 'active') && <button onClick={() => setParams({}, { replace: true })}>Show all active work <ArrowRight size={13} /></button>}</div>}
      </section>

      <aside className="workspace-coordination" aria-labelledby="product-connections-heading">
        <div className="coordination-heading"><span><GitFork size={17} /></span><div><h2 id="product-connections-heading">Across products</h2><p>{connections.length} active {connections.length === 1 ? 'feature' : 'features'}</p></div></div>
        <p className="coordination-intro">Work arriving here or reaching into another product.</p>
        {connections.length ? <div className="coordination-items">{connections.map(feature => {
          const isIncoming = feature.productId !== p.id
          const destinations = isIncoming ? p.name : connectedProductIds(feature, allComponents).map(id => q.product(id)?.name).filter(Boolean).join(', ')
          return <Link key={feature.id} to={`/f/${feature.id}`} className="coordination-item"><div className="product-connection-direction">{isIncoming ? 'Incoming change' : 'Outgoing change'}</div><h3>{feature.title}<ArrowUpRight size={14} /></h3><div className="coordination-route"><span>{q.product(feature.productId)?.name}</span><ArrowRight size={12} aria-label="touches" /><span>{destinations}</span></div><span className="coordination-owner">{feature.owner}</span></Link>
        })}</div> : <div className="coordination-empty">No active plans cross product boundaries{scope ? ' in this component' : ' here'}.</div>}
        <div className="coordination-footnote">Follow these plans to coordinate changes between products.</div>
      </aside>
    </div>

    <section className="product-components-section" aria-labelledby="product-components-heading">
      <div className="board-section-heading"><div><h2 id="product-components-heading">System structure</h2><p>How the services connect to each other, infrastructure, and external providers.</p></div></div>
      <SystemDiagram components={components.map(c => c.component)} allComponents={allComponents} onSelect={showComponentWork} />
      <ProductArchitecture components={components.map(c => c.component)} allComponents={allComponents} active={allActive} selected={scope?.id} onSelect={showComponentWork} />
      {!components.length && <p className="board-empty">No system structure has been added yet.</p>}
    </section>
  </div>
}
