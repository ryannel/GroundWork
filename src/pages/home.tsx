import { Link } from 'react-router-dom'
import { Layers, LayoutGrid, Lightbulb, Clock3 } from 'lucide-react'
import { useHome, useQuery, isCold, STALE_DAYS } from '@/data/store'
import { useRuntime } from '@/data/runtime'
import { WorkspaceCard } from '@/components/workspace-card'
import { FeatureRow, FeatureWorkList } from '@/components/feature-row'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { useUrlFilter } from '@/ui/use-url-filter'

type HomeView = 'active' | 'ideas' | 'quiet'
const emptyText: Record<HomeView, string> = {
  active: 'No active features in this workspace.',
  ideas: 'No ideas in this workspace.',
  quiet: `No active features in this scope have gone ${STALE_DAYS}+ days without an update.`,
}
const summaryText: Record<HomeView, string> = {
  active: 'Work in progress',
  ideas: 'Ideas awaiting exploration',
  quiet: `No updates in ${STALE_DAYS}+ days`,
}

export function HomePage() {
  const q = useQuery()
  const { summaries, inFlight, ideas } = useHome()
  const { plan, projects, mode } = useRuntime()
  const filter = useUrlFilter({ workspace: 'all', view: 'active' })
  const registration = mode === 'central' && plan
    ? projects.find(project => project.checkoutId === plan.context.checkoutId)
    : undefined
  const registeredWorkspace = registration && q.workspaces().find(item => item.name === registration.workspace)
  const registeredProduct = registeredWorkspace && q.products(registeredWorkspace.id).find(item => item.name === registration.product)
  const requested = filter.get('workspace')
  const workspace = summaries.some(s => s.workspace.id === requested) ? requested : 'all'
  const view: HomeView = filter.get('view') === 'ideas' ? 'ideas' : filter.get('view') === 'quiet' ? 'quiet' : 'active'
  const inWorkspace = (productId: string) => workspace === 'all' || q.product(productId)?.workspaceId === workspace
  const active = inFlight.filter(f => inWorkspace(f.productId))
  const parked = ideas.filter(f => inWorkspace(f.productId))
  const quiet = active.filter(isCold)
  const rows = view === 'active' ? active : view === 'ideas' ? parked : quiet
  const views = [
    { id: 'active' as const, label: 'Active features', count: active.length, icon: Layers },
    { id: 'ideas' as const, label: 'Ideas', count: parked.length, icon: Lightbulb },
    { id: 'quiet' as const, label: 'No recent update', count: quiet.length, icon: Clock3 },
  ]
  return <div className="workspace-board">
    {plan && (registeredWorkspace && registeredProduct
      ? <Breadcrumbs workspace={registeredWorkspace} product={registeredProduct} current={{ label: 'Repository', name: plan.manifest.name }} />
      : <Breadcrumbs current={{ label: 'Repository', name: plan.manifest.name }} />)}
    <header className="board-heading">
      <div>
        <div className="board-eyebrow"><LayoutGrid size={13} />{plan ? 'This repository' : 'Workspaces'}</div>
        <h1>{plan ? plan.manifest.name : 'Workspaces'}<span>.</span></h1>
        <p>{plan ? 'Feature plans and delivery, alongside your source.' : 'Products, plans, and the work connecting them.'}</p>
      </div>
      <dl className="board-totals">
        <div><dt>Active features</dt><dd>{inFlight.length}</dd></div>
        <div><dt>Ideas to explore</dt><dd>{ideas.length}</dd></div>
      </dl>
    </header>
    <section aria-labelledby="workspace-directory-heading">
      <div className="board-section-heading">
        <h2 id="workspace-directory-heading">{plan ? 'Products' : 'Your workspaces'} <span className="section-count">{plan ? q.products().length : summaries.length}</span></h2>
      </div>
      {plan
        ? <div className="project-grid">{q.products().map(product => <Link className="project-card" to={`/w/project/${product.slug}`} key={product.id}>
          <h3>{product.name}</h3>
          <p className="project-path">{product.description ?? 'Features, architecture, and the work ahead.'}</p>
          <div className="project-counts">
            <span><strong>{q.features(product.id).length}</strong> feature plans</span>
            <span><strong>{q.components(product.id).length}</strong> components</span>
          </div>
        </Link>)}</div>
        : <div className="workspace-directory">{summaries.map(s => <WorkspaceCard key={s.workspace.id} s={s} />)}</div>}
      {!summaries.length && <div className="board-empty">
        <strong>No workspaces yet</strong>
        <p>Your AI assistant can add a workspace and populate its products and feature plans.</p>
      </div>}
    </section>
    {summaries.length > 0 && <section className="board-work" aria-labelledby="board-work-heading">
      <div className="board-section-heading">
        <div><h2 id="board-work-heading">Feature work</h2><p>Across your products, from first idea to release.</p></div>
        {!plan && <label><span className="sr-only">Workspace</span>
          <select value={workspace} onChange={event => filter.set('workspace', event.target.value)}>
            <option value="all">All workspaces</option>
            {summaries.map(({ workspace: w }) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>}
      </div>
      <FeatureWorkList
        label="Feature work view"
        views={views}
        view={view}
        onView={id => filter.set('view', id)}
        summary={<p>{summaryText[view]}</p>}
        titleColumn="Feature / location"
        rows={rows}
        renderRow={f => <FeatureRow key={f.id} feature={f} showWorkspace />}
        empty={<div className="board-empty">
          {emptyText[view]}
          {q.features().length
            ? <button onClick={filter.reset}>Show all active features</button>
            : <p>Talk with your agent to plan a feature. Its plan will appear here.</p>}
        </div>}
      />
    </section>}
    <footer className="board-footer"><p>groundwork <span>·</span> A place to make the next thing clear.</p></footer>
  </div>
}
