import { ArrowUpRight } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { useRuntime } from '@/data/runtime'
import { summarizeHubProducts, type HubProduct } from '@shared/view-models'

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
  const [params] = useSearchParams()
  const selectedWorkspace = params.get('workspace')
  const workspaces = summarizeHubProducts(projects).filter(workspace => !selectedWorkspace || workspace.name === selectedWorkspace)
  return <div className="central-board">
    {selectedWorkspace && <Breadcrumbs workspace={{ name: selectedWorkspace, slug: '' }} current={{ label: 'Workspace', name: selectedWorkspace }} />}
    <header className="central-heading">
      <p className="board-eyebrow">{selectedWorkspace ? 'Workspace' : 'Your engineering workspace'}</p>
      <h1>{selectedWorkspace ?? 'Your products'}</h1>
      <p>Understand your systems. Explore their architecture, inspect contracts, and plan what comes next.</p>
    </header>
    {error && <p className="runtime-error" role="alert">{error}</p>}
    {!projects.length && <section className="central-empty">
      <h2>Bring your first repository</h2>
      <p>Register a folder to discover its repositories. Products are read from their home repositories.</p>
      <pre>npx --no-install groundwork-v2 register .</pre>
      <p>The Hub will pick it up automatically.</p>
    </section>}
    {workspaces.map(workspace => <section className="central-workspace" key={workspace.name}>
      {!selectedWorkspace && <h2>{workspace.name}</h2>}
      <div className="product-grid">{workspace.products.map(product => <ProductSummary key={product.id} product={product} />)}</div>
    </section>)}
    {selectedWorkspace && !workspaces.length && <p className="central-empty">No products are registered in this workspace.</p>}
    <footer className="central-footer">Plans travel with the repository. Workspace organisation stays on this computer.</footer>
  </div>
}
