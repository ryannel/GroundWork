import { useRuntime } from '@/data/runtime'
import { Layers, ArrowUpRight } from 'lucide-react'
export function ProjectsPage() {
  const { projects, error } = useRuntime()
  const workspaces = [...new Set(projects.map(p => p.workspace))]
  return <main className="central-board">
    <header className="central-heading"><div className="central-brand"><Layers size={20} />groundwork</div><p className="board-eyebrow">All products</p><h1>Groundwork Hub<span>.</span></h1><p>Workspaces group products. Products contain architectural components; source repositories show where those components live.</p></header>
    {error && <p className="runtime-error" role="alert">{error}</p>}
    {!projects.length && <section className="central-empty"><h2>Bring your first repository</h2><p>Register repositories beneath a workspace and product. Plans stay with their source.</p><pre>npx --no-install groundwork-v2 register --workspace Personal --product "My product"</pre><p>The Hub will pick it up automatically.</p></section>}
    {workspaces.map(workspace => {
      const workspaceProjects = projects.filter(p => p.workspace === workspace)
      const products = [...new Set(workspaceProjects.map(p => p.product))]
      return <section className="central-workspace" key={workspace}><h2>{workspace}</h2><div className="product-grid">{products.map(product => {
        const productCheckouts = workspaceProjects.filter(p => p.product === product)
        const registeredRepositories = [...new Set(productCheckouts.map(p => p.repositoryRoot))]
        const primaryCheckouts = registeredRepositories.map(repositoryRoot => {
            const checkouts = productCheckouts.filter(p => p.repositoryRoot === repositoryRoot)
            return checkouts.find(p => p.root === repositoryRoot && !p.error) ?? checkouts.find(p => !p.error)
          }).filter(checkout => checkout !== undefined)
        const repositories = [...new Set(primaryCheckouts.flatMap(checkout => checkout.repositories))]
        const components = new Map(primaryCheckouts.flatMap(checkout => checkout.components).map(component => [`${component.repository ?? ''}:${component.id}`, component]))
        const entry = primaryCheckouts[0]
        const features = primaryCheckouts.flatMap(checkout => checkout.features)
        const content = <>
          <div className="product-card-heading"><div><small>Product</small><h3>{product}</h3></div>{entry && <span className="product-open" aria-hidden="true"><ArrowUpRight size={22} /></span>}</div>
          <p className="product-repository-count"><strong>{components.size}</strong> {components.size === 1 ? 'component' : 'components'} <span>across</span> <strong>{repositories.length}</strong> source {repositories.length === 1 ? 'repository' : 'repositories'}</p>
          <div className="project-counts"><span><strong>{features.filter(f => !['idea', 'shipped'].includes(f.stage)).length}</strong> active</span><span><strong>{features.filter(f => f.stage === 'idea').length}</strong> ideas</span><span><strong>{features.filter(f => f.stage === 'shipped').length}</strong> shipped</span></div>
        </>
        return entry
          ? <a className="product-card product-summary-card" href={`/p/${entry.checkoutId}${entry.productPath ?? '/'}`} aria-label={`Open ${product}`} key={product}>{content}</a>
          : <article className="product-card product-summary-card" key={product}>{content}</article>
      })}</div></section>
    })}
    <footer className="central-footer">Plans travel with the repository. Workspace organisation stays on this computer.</footer>
  </main>
}
