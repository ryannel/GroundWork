import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Layers, Lightbulb, CheckCheck, GitFork, Boxes } from 'lucide-react'
import { useWorkspace, useQuery } from '@/data/store'
import type { Component, Feature, Product } from '@/data/model'
import { featureInProduct, connectedProductIds } from '@/data/workspace-view'
import { FeatureWorkList } from '@/components/feature-row'
import { kinds } from '@/lib/taxonomy'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { useUrlFilter } from '@/ui/use-url-filter'

type WorkspaceView = 'active' | 'ideas' | 'shipped'
const emptyHeading: Record<WorkspaceView, string> = {
  active: 'No active features in this scope',
  ideas: 'No ideas in this scope',
  shipped: 'Nothing shipped in this scope yet',
}

function ProductCard({ workspaceSlug, product, owned, active, incoming }: {
  workspaceSlug: string
  product: Product
  owned: Component[]
  active: number
  incoming: number
}) {
  const services = owned.filter(c => c.kind === 'service').length
  return <Link to={`/w/${workspaceSlug}/${product.slug}`} className="workspace-product-card">
    <div className="workspace-product-top">
      <span className="product-card-kicker">Product</span>
      <span className="product-open" aria-hidden="true"><ArrowUpRight size={22} /></span>
    </div>
    <h3>{product.name}</h3><p>{product.description ?? kinds[product.kind].blurb}</p>
    <div className="product-card-meta">
      <span>{services ? `${services} services` : `${owned.filter(c => !c.parentId).length} components`}</span>
      <span>{kinds[product.kind].label}</span>
    </div>
    <footer>
      <span title="Active features owned by this product"><strong>{active}</strong> active {active === 1 ? 'feature' : 'features'}</span>
      {incoming > 0 && <span className="product-shared" title="Active features from other products that touch components here">
        <GitFork size={12} /><strong>{incoming}</strong> incoming
      </span>}
    </footer>
  </Link>
}

function CrossProductWork({ connections, components, scoped }: { connections: Feature[]; components: Component[]; scoped: boolean }) {
  const q = useQuery()
  return <aside className="workspace-coordination" aria-labelledby="workspace-connections-heading">
    <div className="coordination-heading">
      <span><GitFork size={17} /></span>
      <div>
        <h2 id="workspace-connections-heading">Across products</h2>
        <p>{connections.length} active {connections.length === 1 ? 'feature' : 'features'}</p>
      </div>
    </div>
    <p className="coordination-intro">Changes that reach beyond their owning product.</p>
    {connections.length ? <div className="coordination-items">{connections.map(feature => <Link key={feature.id} to={`/f/${feature.id}`} className="coordination-item">
      <h3>{feature.title}<ArrowUpRight size={14} /></h3>
      <div className="coordination-route">
        <span>{q.product(feature.productId)?.name}</span>
        <ArrowRight size={12} aria-label="touches" />
        <span>{connectedProductIds(feature, components).map(id => q.product(id)?.name).filter(Boolean).join(', ')}</span>
      </div>
      <span className="coordination-owner">{feature.owner}</span>
    </Link>)}</div> : <div className="coordination-empty">No active features cross product boundaries{scoped ? ' in this scope' : ''}.</div>}
    <div className="coordination-footnote">Follow these plans to coordinate changes between products.</div>
  </aside>
}

export function WorkspacePage() {
  const q = useQuery()
  const { slug = '' } = useParams()
  const ws = useWorkspace(slug)
  const filter = useUrlFilter({ product: 'all', view: 'active' })
  if (!ws) return <Navigate to="/" replace />
  const { workspace: w, products, active, ideas, shipped } = ws
  const components = q.components()
  const scope = products.find(p => p.product.id === filter.get('product'))?.product
  const productFilter = scope?.id ?? 'all'
  const view: WorkspaceView = filter.get('view') === 'ideas' ? 'ideas' : filter.get('view') === 'shipped' ? 'shipped' : 'active'
  const inScope = (feature: Feature) => featureInProduct(feature, productFilter, components)
  const activeRows = active.filter(inScope)
  const ideaRows = ideas.filter(inScope)
  const shippedRows = shipped.filter(inScope)
  const rows = view === 'ideas' ? ideaRows : view === 'shipped' ? shippedRows : activeRows
  const connected = active.filter(feature => connectedProductIds(feature, components).length > 0)
  const views = [
    { id: 'active' as const, label: 'Active', count: activeRows.length, icon: Layers },
    { id: 'ideas' as const, label: 'Ideas', count: ideaRows.length, icon: Lightbulb },
    { id: 'shipped' as const, label: 'Shipped', count: shippedRows.length, icon: CheckCheck },
  ]
  return <div className="workspace-overview">
    <header className="workspace-page-header">
      <Breadcrumbs workspace={w} current={{ label: 'Workspace', name: w.name }} />
      <div className="workspace-hero">
        <div className="workspace-page-title"><div>
          <div className="board-eyebrow">Workspace <span>·</span> {products.length} {products.length === 1 ? 'product' : 'products'}</div>
          <h1>{w.name}</h1>
          {w.description && <p>{w.description}</p>}
        </div></div>
        <dl className="board-totals">
          <div><dt>Active features</dt><dd>{active.length}</dd></div>
          <div><dt>Cross-product</dt><dd>{connected.length}</dd></div>
        </dl>
      </div>
    </header>

    <section className="workspace-product-section" aria-labelledby="workspace-products-heading">
      <div className="board-section-heading">
        <h2 id="workspace-products-heading">Products <span className="section-count">{products.length}</span></h2>
        <span className="workspace-section-note">Open a product to explore its features</span>
      </div>
      <div className="workspace-product-grid">{products.map(({ product, components: owned, active: ownedActive }) => <ProductCard
        key={product.id}
        workspaceSlug={w.slug}
        product={product}
        owned={owned}
        active={ownedActive.length}
        incoming={active.filter(feature => feature.productId !== product.id && featureInProduct(feature, product.id, components)).length}
      />)}</div>
      {!products.length && <p className="board-empty">No products in this workspace yet.</p>}
    </section>

    <div className="workspace-work-layout">
      <section className="workspace-feature-section" aria-labelledby="workspace-feature-heading">
        <div className="board-section-heading">
          <div><h2 id="workspace-feature-heading">Feature work</h2><p>From exploration to release.</p></div>
          <label><span className="sr-only">Product scope</span>
            <select value={productFilter} onChange={event => filter.set('product', event.target.value)}>
              <option value="all">All products</option>
              {products.map(({ product }) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
          </label>
        </div>
        <FeatureWorkList
          label="Workspace feature view"
          views={views}
          view={view}
          onView={id => filter.set('view', id)}
          summary={<p>{scope ? `Owned by or touching ${scope.name}` : 'Across all products'}</p>}
          titleColumn="Feature / owning product"
          rows={rows}
          empty={<div className="workspace-list-empty">
            <Boxes size={24} />
            <h3>{emptyHeading[view]}</h3>
            <p>{scope ? 'Try another product or return to the full workspace.' : 'This view will show feature plans as they reach this stage.'}</p>
            {(scope || view !== 'active') && <button onClick={filter.reset}>Show all active work <ArrowRight size={13} /></button>}
          </div>}
        />
      </section>
      <CrossProductWork connections={connected.filter(inScope)} components={components} scoped={!!scope} />
    </div>
  </div>
}
