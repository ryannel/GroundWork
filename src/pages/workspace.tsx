import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Layers, Lightbulb, CheckCheck, GitFork, Boxes } from 'lucide-react'
import { useWorkspace, useQuery } from '@/data/store'
import type { Component, Feature, Product } from '@shared/model'
import { featureInProduct, connectedProductIds } from '@/data/workspace-view'
import { FeatureRow, FeatureWorkList, FeatureImpact } from '@/components/feature-row'
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
  const components = owned.filter(c => !c.parentId).length
  return <Link to={`/w/${workspaceSlug}/${product.slug}`} className="workspace-product-card">
    <div className="workspace-product-top">
      <span className="product-card-kicker">Product</span>
      <span className="product-open" aria-hidden="true"><ArrowUpRight size={22} /></span>
    </div>
    <h3>{product.name}</h3><p>{product.description ?? kinds[product.kind].blurb}</p>
    <div className="product-card-meta">
      <span>{services ? `${services} ${services === 1 ? 'service' : 'services'}` : `${components} ${components === 1 ? 'component' : 'components'}`}</span>
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

export function WorkspacePage() {
  const q = useQuery()
  const { slug = '' } = useParams()
  const ws = useWorkspace(slug)
  const filter = useUrlFilter({ product: 'all', view: 'active', involvement: 'all' })
  if (!ws) return <Navigate to="/" replace />
  const { workspace: w, products, active, ideas, shipped } = ws
  const components = q.components()
  const scope = products.find(p => p.product.id === filter.get('product'))?.product
  const productFilter = scope?.id ?? 'all'
  const view: WorkspaceView = filter.get('view') === 'ideas' ? 'ideas' : filter.get('view') === 'shipped' ? 'shipped' : 'active'
  const sharedOnly = filter.get('involvement') === 'shared'
  const inScope = (feature: Feature) => featureInProduct(feature, productFilter, components, q.products())
    && (!sharedOnly || connectedProductIds(feature, components, q.products()).length > 0)
  const activeRows = active.filter(inScope)
  const ideaRows = ideas.filter(inScope)
  const shippedRows = shipped.filter(inScope)
  const rows = view === 'ideas' ? ideaRows : view === 'shipped' ? shippedRows : activeRows
  const connected = active.filter(feature => connectedProductIds(feature, components, q.products()).length > 0)
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
          <div><dt>Multi-product plans</dt><dd>{connected.length}</dd></div>
        </dl>
      </div>
    </header>

    <section className="workspace-product-section" aria-labelledby="workspace-products-heading">
      <div className="board-section-heading">
        <h2 id="workspace-products-heading">Products <span className="section-count">{products.length}</span></h2>
        <span className="workspace-section-note">Architecture, contracts, and planned work</span>
      </div>
      <div className="workspace-product-grid">{products.map(({ product, components: owned, active: ownedActive }) => <ProductCard
        key={product.id}
        workspaceSlug={w.slug}
        product={product}
        owned={owned}
        active={ownedActive.length}
        incoming={active.filter(feature => feature.productId !== product.id && featureInProduct(feature, product.id, components, q.products())).length}
      />)}</div>
      {!products.length && <p className="board-empty">No products in this workspace yet.</p>}
    </section>

    <div className="workspace-work-layout is-unified">
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
          summary={<div className="work-filters"><label>
            <span className="sr-only">Product involvement</span>
            <select value={sharedOnly ? 'shared' : 'all'} onChange={event => filter.set('involvement', event.target.value)}>
              <option value="all">All work</option>
              <option value="shared">Involves multiple products</option>
            </select>
          </label></div>}
          titleColumn="Feature / owning product"
          rows={rows}
          renderRow={feature => <FeatureRow key={feature.id} feature={feature} detail={<FeatureImpact feature={feature} />} />}
          empty={<div className="workspace-list-empty">
            <Boxes size={24} />
            <h3>{emptyHeading[view]}</h3>
            <p>{scope
              ? 'Try another product or return to the full workspace.'
              : 'Plan a feature with your agent to connect upcoming work to this workspace.'}</p>
            {(scope || sharedOnly || view !== 'active') && <button onClick={filter.reset}>Show all active work <ArrowRight size={13} /></button>}
          </div>}
        />
      </section>
    </div>
  </div>
}
