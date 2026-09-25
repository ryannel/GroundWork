import { AlertTriangle, ArrowUpRight } from 'lucide-react'
import { useRuntime } from '@/data/runtime'
import { summarizeHubProducts, type HubProduct } from '@/data/view-models'

const cloneStatus = { different: 'default branch commits differ', diverged: 'default branches diverged', unknown: 'clone history could not be compared' }

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
    {!!product.cloneWarnings.length && <p className="product-clone-warning">
      <AlertTriangle size={14} aria-hidden="true" style={{ color: 'var(--warning)' }} />{' '}
      <strong>Clone differences:</strong>{' '}
      {product.cloneWarnings.map(warning => `${warning.repository}: ${cloneStatus[warning.status]}`).join('; ')}
    </p>}
  </>
  // Products open in their own checkout's viewer, outside this router's basename.
  return product.href
    ? <a className="product-card product-summary-card" href={product.href} aria-label={`Open ${product.name}${product.cloneWarnings.length ? '; clone differences reported' : ''}`}>{content}</a>
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
      <p>Register a folder to discover its repositories. Products are read from their home repositories.</p>
      <pre>npx --no-install groundwork-v2 register .</pre>
      <p>The Hub will pick it up automatically.</p>
    </section>}
    {workspaces.map(workspace => <section className="central-workspace" key={workspace.name}>
      <h2>{workspace.name}</h2>
      <div className="product-grid">{workspace.products.map(product => <ProductSummary key={product.id} product={product} />)}</div>
    </section>)}
    <footer className="central-footer">Plans travel with the repository. Workspace organisation stays on this computer.</footer>
  </div>
}
