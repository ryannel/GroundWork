import { useRuntime } from '@/data/runtime'
import { Layers, GitBranch, ArrowUpRight } from 'lucide-react'
export function ProjectsPage() {
  const { projects, error } = useRuntime()
  const workspaces = [...new Set(projects.map(p => p.workspace))]
  return <main className="central-board">
    <header className="central-heading"><div className="central-brand"><Layers size={20} />groundwork</div><p className="board-eyebrow">Your local planning dashboard</p><h1>Make the next thing clear<span>.</span></h1><p>One place to follow your projects, plans, and work in progress.</p></header>
    {error && <p className="runtime-error" role="alert">{error}</p>}
    {!projects.length && <section className="central-empty"><h2>Bring your first project</h2><p>Run these commands in an application folder. Its plans stay with its source.</p><pre>npx --no-install groundwork-v2 init --name "My app"<br />npx --no-install groundwork-v2 register --workspace Personal</pre><p>This dashboard will pick it up automatically.</p></section>}
    {workspaces.map(workspace => <section className="central-workspace" key={workspace}><h2>{workspace}</h2><div className="project-grid">{projects.filter(p => p.workspace === workspace).map(p => <article className="project-card" key={p.root}>
      <div className="project-card-heading"><h3>{p.name}</h3>{p.checkoutId && <a href={`/p/${p.checkoutId}/`} aria-label={`Open ${p.name}`}><ArrowUpRight size={22} /></a>}</div>
      <p className="project-branch"><GitBranch size={14} />{p.branch ?? (p.isGit === false ? 'Not yet in Git' : 'Detached HEAD')}</p>
      <p className="project-path" title={p.root}>{p.root}</p>
      {p.error ? <p className="project-error">{p.error}</p> : <><div className="project-counts"><span><strong>{p.features.filter(f => !['idea', 'shipped'].includes(f.stage)).length}</strong> active</span><span><strong>{p.features.filter(f => f.stage === 'idea').length}</strong> ideas</span><span><strong>{p.features.filter(f => f.stage === 'shipped').length}</strong> shipped</span></div>
      <div className="project-features">{p.features.slice(0, 4).map(f => <a key={f.id} href={`/p/${p.checkoutId}/f/${f.id}`}><span>{f.title}</span><small>{f.stage}</small></a>)}{!p.features.length && <p>Ready for your first feature plan.</p>}</div></>}
    </article>)}</div></section>)}
    <footer className="central-footer">Plans travel with the repository. Workspace organisation stays on this computer.</footer>
  </main>
}
