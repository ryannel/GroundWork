import { useHome, q, isCold, STALE_DAYS } from '@/data/store'
import { WorkspaceCard } from '@/components/workspace-card'
import { FeatureRow } from '@/components/feature-row'
import { Layers, LayoutGrid, Lightbulb, Clock3 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useRuntime } from '@/data/runtime'

export function HomePage() {
  const { summaries, inFlight, ideas } = useHome()
  const { plan } = useRuntime()
  const [params, setParams] = useSearchParams()
  const workspace = summaries.some(s => s.workspace.id === params.get('workspace')) ? params.get('workspace')! : 'all'
  const view = params.get('view') === 'ideas' ? 'ideas' : params.get('view') === 'quiet' ? 'quiet' : 'active'
  const updateFilter = (key: string, value: string) => setParams(previous => { const next = new URLSearchParams(previous); if (value === 'all' || value === 'active') next.delete(key); else next.set(key, value); return next }, { replace: true })
  const setWorkspace = (value: string) => updateFilter('workspace', value)
  const setView = (value: string) => updateFilter('view', value)
  const inWorkspace = (productId: string) => workspace === 'all' || q.product(productId)?.workspaceId === workspace
  const active = inFlight.filter(f => inWorkspace(f.productId))
  const parked = ideas.filter(f => inWorkspace(f.productId))
  const quiet = active.filter(isCold)
  const features = view === 'active' ? active : view === 'ideas' ? parked : quiet
  const views = [
    { id: 'active' as const, label: 'Active features', count: active.length, icon: Layers },
    { id: 'ideas' as const, label: 'Ideas', count: parked.length, icon: Lightbulb },
    { id: 'quiet' as const, label: 'No recent update', count: quiet.length, icon: Clock3 },
  ]
  return <div className="workspace-board">
    <header className="board-heading"><div><div className="board-eyebrow"><LayoutGrid size={13} />{plan ? 'This repository' : 'Your portfolio'}</div><h1>{plan ? plan.manifest.name : 'Workspaces'}<span>.</span></h1><p>{plan ? 'Feature plans and delivery, alongside your source.' : 'Products, plans, and the work connecting them.'}</p></div><dl className="board-totals"><div><dt>Active features</dt><dd>{inFlight.length}</dd></div><div><dt>Ideas to explore</dt><dd>{ideas.length}</dd></div></dl></header>
    <section aria-labelledby="workspace-directory-heading">
      <div className="board-section-heading"><h2 id="workspace-directory-heading">{plan ? 'Products' : 'Your workspaces'} <span className="section-count">{plan ? q.products().length : summaries.length}</span></h2></div>
      {plan ? <div className="project-grid">{q.products().map(product => <Link className="project-card" to={`/w/project/${product.slug}`} key={product.id}><h3>{product.name}</h3><p className="project-path">{product.description ?? 'Features, architecture, and the work ahead.'}</p><div className="project-counts"><span><strong>{q.features(product.id).length}</strong> feature plans</span><span><strong>{q.components(product.id).length}</strong> components</span></div></Link>)}</div> : <div className="workspace-directory">{summaries.map(s => <WorkspaceCard key={s.workspace.id} s={s} />)}</div>}
      {!summaries.length && <div className="board-empty"><strong>No workspaces yet</strong><p>Your AI assistant can add a workspace and populate its products and feature plans.</p></div>}
    </section>
    {summaries.length > 0 && <section className="board-work" aria-labelledby="board-work-heading">
      <div className="board-section-heading"><div><h2 id="board-work-heading">Feature work</h2><p>Across your products, from first idea to release.</p></div>{!plan && <label><span className="sr-only">Workspace</span><select value={workspace} onChange={event => setWorkspace(event.target.value)}><option value="all">All workspaces</option>{summaries.map(({workspace: w}) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}</div>
      <div className="board-work-tabs" role="group" aria-label="Feature work view">{views.map(item => <button key={item.id} aria-pressed={view === item.id} onClick={() => setView(item.id)}><item.icon size={14} aria-hidden="true" />{item.label}<span>{item.count}</span></button>)}</div>
      <div className="board-list-context"><p>{view === 'quiet' ? `No updates in ${STALE_DAYS}+ days` : view === 'ideas' ? 'Ideas awaiting exploration' : 'Work in progress'}</p><span aria-live="polite">{features.length} {features.length === 1 ? 'feature' : 'features'} · Latest updates first</span></div>
      {features.length > 0 ? <div className="board-feature-list"><div className="feature-list-labels" aria-hidden="true"><span>Feature / location</span><span>Stage</span><span>Owner</span><span>Updated</span></div>{features.map(f => <FeatureRow key={f.id} feature={f} showWorkspace />)}</div> : <div className="board-empty">{view === 'quiet' ? `No active features in this scope have gone ${STALE_DAYS}+ days without an update.` : view === 'ideas' ? 'No ideas in this workspace.' : 'No active features in this workspace.'}{q.features().length ? <button onClick={() => setParams({}, { replace: true })}>Show all active features</button> : <p>Talk with your agent to plan a feature. Its plan will appear here.</p>}</div>}
    </section>}
    <footer className="board-footer"><p>groundwork <span>·</span> A place to make the next thing clear.</p><Link to="/design">Design system</Link></footer>
  </div>
}
