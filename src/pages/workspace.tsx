import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, ChevronRight, Layers, Lightbulb, CheckCheck, GitFork, Boxes } from 'lucide-react'
import { useWorkspace, q } from '@/data/store'
import { featureInProduct, connectedProductIds } from '@/data/workspace-view'
import { FeatureRow } from '@/components/feature-row'
import { kinds, hueStyle } from '@/lib/taxonomy'
import { WorkspaceEmblem } from '@/components/workspace-emblem'

export function WorkspacePage() {
  const { slug = '' } = useParams()
  const ws = useWorkspace(slug)
  const [params, setParams] = useSearchParams()
  if (!ws) return <Navigate to="/" replace />
  const { workspace: w, products, active, ideas, shipped } = ws
  const components = q.components()
  const scope = products.find(p => p.product.id === params.get('product'))?.product
  const filter = scope?.id ?? 'all'
  const view = params.get('view') === 'ideas' ? 'ideas' : params.get('view') === 'shipped' ? 'shipped' : 'active'
  const update = (key: string, value: string) => setParams(previous => { const next = new URLSearchParams(previous); if (value === 'all' || value === 'active') next.delete(key); else next.set(key, value); return next }, { replace: true })
  const inScope = (feature: typeof active[number]) => featureInProduct(feature, filter, components)
  const activeRows = active.filter(inScope)
  const ideaRows = ideas.filter(inScope)
  const shippedRows = shipped.filter(inScope)
  const rows = view === 'ideas' ? ideaRows : view === 'shipped' ? shippedRows : activeRows
  const connected = active.filter(feature => connectedProductIds(feature, components).length > 0)
  const connections = connected.filter(inScope)
  const views = [
    { id: 'active', label: 'Active', count: activeRows.length, icon: Layers },
    { id: 'ideas', label: 'Ideas', count: ideaRows.length, icon: Lightbulb },
    { id: 'shipped', label: 'Shipped', count: shippedRows.length, icon: CheckCheck },
  ]
  return <div className="workspace-overview" style={hueStyle(w.hue)}>
    <header className="workspace-page-header">
      <nav aria-label="Breadcrumb" className="workspace-breadcrumb"><Link to="/">Workspaces</Link><ChevronRight size={13} /><span aria-current="page">{w.name}</span></nav>
      <div className="workspace-hero">
        <div className="workspace-page-title"><WorkspaceEmblem workspace={w} size="large" /><div><div className="board-eyebrow">Workspace <span>·</span> {products.length} products</div><h1 className="text-display">{w.name}</h1>{w.description && <p>{w.description}</p>}</div></div>
        <dl className="board-totals"><div><dt>Active features</dt><dd>{active.length}</dd></div><div><dt>Cross-product</dt><dd>{connected.length}</dd></div></dl>
      </div>
    </header>

    <section className="workspace-product-section" aria-labelledby="workspace-products-heading">
      <div className="board-section-heading"><h2 id="workspace-products-heading">Products <span className="section-count">{products.length}</span></h2><span className="workspace-section-note">Open a product to explore its features</span></div>
      <div className="workspace-product-grid">{products.map(({ product, components: ownedComponents, active: ownedActive }) => {
        const Icon = kinds[product.kind].icon
        const incoming = active.filter(feature => feature.productId !== product.id && featureInProduct(feature, product.id, components)).length
        return <Link key={product.id} to={`/w/${w.slug}/${product.slug}`} className="workspace-product-card" style={hueStyle(kinds[product.kind].hueVar)}>
          <div className="workspace-product-top"><span className="product-symbol"><Icon size={19} strokeWidth={1.6} /></span><ArrowUpRight size={16} className="product-open-icon" /></div>
          <h3>{product.name}</h3><p>{product.description ?? kinds[product.kind].blurb}</p>
          <div className="product-card-meta"><span>{ownedComponents.some(c => c.kind === 'service') ? `${ownedComponents.filter(c => c.kind === 'service').length} services` : `${ownedComponents.filter(c => !c.parentId).length} components`}</span><span>{kinds[product.kind].label}</span></div>
          <footer><span title="Active features owned by this product"><strong>{ownedActive.length}</strong> active {ownedActive.length === 1 ? 'feature' : 'features'}</span>{incoming > 0 && <span className="product-shared" title="Active features from other products that touch components here"><GitFork size={12} /><strong>{incoming}</strong> incoming</span>}</footer>
        </Link>
      })}</div>
      {!products.length && <p className="board-empty">No products in this workspace yet.</p>}
    </section>

    <div className="workspace-work-layout">
      <section className="workspace-feature-section" aria-labelledby="workspace-feature-heading">
        <div className="board-section-heading"><div><h2 id="workspace-feature-heading">Feature work</h2><p>From exploration to release.</p></div><label><span className="sr-only">Product scope</span><select value={filter} onChange={event => update('product', event.target.value)}><option value="all">All products</option>{products.map(({product}) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label></div>
        <div className="board-work-tabs" role="group" aria-label="Workspace feature view">{views.map(item => <button key={item.id} aria-pressed={view === item.id} onClick={() => update('view', item.id)}><item.icon size={14} aria-hidden="true" />{item.label}<span>{item.count}</span></button>)}</div>
        <div className="board-list-context"><p>{scope ? `Owned by or touching ${scope.name}` : 'Across all products'}</p><span aria-live="polite">{rows.length} {rows.length === 1 ? 'feature' : 'features'} · Latest updates first</span></div>
        {rows.length ? <div className="board-feature-list"><div className="feature-list-labels" aria-hidden="true"><span>Feature / owning product</span><span>Stage</span><span>Owner</span><span>Updated</span></div>{rows.map(feature => <FeatureRow key={feature.id} feature={feature} />)}</div> : <div className="workspace-list-empty"><Boxes size={24} /><h3>{view === 'ideas' ? 'No ideas in this scope' : view === 'shipped' ? 'Nothing shipped in this scope yet' : 'No active features in this scope'}</h3><p>{scope ? 'Try another product or return to the full workspace.' : 'This view will show feature plans as they reach this stage.'}</p>{(scope || view !== 'active') && <button onClick={() => setParams({}, { replace: true })}>Show all active work <ArrowRight size={13} /></button>}</div>}
      </section>

      <aside className="workspace-coordination" aria-labelledby="workspace-connections-heading">
        <div className="coordination-heading"><span><GitFork size={17} /></span><div><h2 id="workspace-connections-heading">Across products</h2><p>{connections.length} active {connections.length === 1 ? 'feature' : 'features'}</p></div></div>
        <p className="coordination-intro">Changes that reach beyond their owning product.</p>
        {connections.length ? <div className="coordination-items">{connections.map(feature => <Link key={feature.id} to={`/f/${feature.id}`} className="coordination-item"><h3>{feature.title}<ArrowUpRight size={14} /></h3><div className="coordination-route"><span>{q.product(feature.productId)?.name}</span><ArrowRight size={12} aria-label="touches" /><span>{connectedProductIds(feature, components).map(id => q.product(id)?.name).filter(Boolean).join(', ')}</span></div><span className="coordination-owner">{feature.owner}</span></Link>)}</div> : <div className="coordination-empty">No active features cross product boundaries{scope ? ' in this scope' : ''}.</div>}
        <div className="coordination-footnote">Follow these plans to coordinate changes between products.</div>
      </aside>
    </div>
  </div>
}
