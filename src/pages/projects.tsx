import { ArrowUpRight } from 'lucide-react'
import { useRuntime } from '@/data/runtime'
import { summarizeHubProducts, type HubProduct } from '@/data/view-models'

function ProductSummary({ product }: { product: HubProduct }) {
  const content = <>
    <div className="product-card-heading">
      <div><small>Product</small><h3>{product.name}</h3></div>
      {product.href && <span className="product-open" aria-hidden="true"><ArrowUpRight size={22} /></span>}
    </div>
    <p className="product-repository-count">
      <strong>{product.components}</strong> {product.components === 1 ? 'component' : 'components'} <span>across</span>{' '}
      <strong>{product.repositories}</strong> source {product.repositories === 1 ? 'repository' : 'repositories'}
    </p>
    <div className="project-counts">
      <span><strong>{product.active}</strong> active</span>
      <span><strong>{product.ideas}</strong> ideas</span>
      <span><strong>{product.shipped}</strong> shipped</span>
    </div>
  </>
  // Products open in their own checkout's viewer, outside this router's basename.
  return product.href
    ? <a className="product-card product-summary-card" href={product.href} aria-label={`Open ${product.name}`}>{content}</a>
    : <article className="product-card product-summary-card">{content}</article>
}

export function ProjectsPage() {
  const { projects, error } = useRuntime()
  const workspaces = summarizeHubProducts(projects)
  return <div className="central-board">
    <header className="central-heading">
      <p className="board-eyebrow">All products</p>
      <h1>Groundwork Hub<span>.</span></h1>
      <p>Workspaces group products. Products contain architectural components; source repositories show where those components live.</p>
    </header>
    {error && <p className="runtime-error" role="alert">{error}</p>}
    {!projects.length && <section className="central-empty">
      <h2>Bring your first repository</h2>
      <p>Register repositories beneath a workspace and product. Plans stay with their source.</p>
      <pre>npx --no-install groundwork-v2 register --workspace Personal --product "My product"</pre>
      <p>The Hub will pick it up automatically.</p>
    </section>}
    {workspaces.map(workspace => <section className="central-workspace" key={workspace.name}>
      <h2>{workspace.name}</h2>
      <div className="product-grid">{workspace.products.map(product => <ProductSummary key={product.name} product={product} />)}</div>
    </section>)}
    <footer className="central-footer">Plans travel with the repository. Workspace organisation stays on this computer.</footer>
  </div>
}
