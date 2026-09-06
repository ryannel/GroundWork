import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import type { WorkspaceSummary } from '@/data/store'
import { q, relTime } from '@/data/store'
import { hueStyle, kinds } from '@/lib/taxonomy'
import { WorkspaceEmblem } from './workspace-emblem'

export function WorkspaceCard({ s }: { s: WorkspaceSummary }) {
  const { workspace: w, products, active } = s
  const ideas = q.featuresInWorkspace(w.id).filter(f => f.stage === 'idea').length
  return <Link to={`/w/${w.slug}`} className="workspace-destination" style={hueStyle(w.hue)}>
    <div className="workspace-card-top"><WorkspaceEmblem workspace={w} /><span className="workspace-card-open" aria-hidden="true"><ArrowUpRight size={18} /></span></div>
    <h3>{w.name}</h3>
    <p className="workspace-purpose">{w.description ?? 'Products and feature plans in this workspace.'}</p>
    <div className="workspace-products" aria-label={`${products.length} ${products.length === 1 ? 'product' : 'products'}: ${products.map(p => p.name).join(', ')}`}>{products.map(p => { const Icon = kinds[p.kind].icon; return <span key={p.id}><Icon size={12} aria-hidden="true" />{p.name}</span> })}{!products.length && <span>No products yet</span>}</div>
    <footer><div className="workspace-activity"><span><strong>{active.length}</strong> active</span><span><strong>{ideas}</strong> {ideas === 1 ? 'idea' : 'ideas'}</span></div>{s.lastActivity && <time dateTime={s.lastActivity} title={`Latest feature update: ${new Date(s.lastActivity).toLocaleString()}`}>Updated {relTime(s.lastActivity)}</time>}</footer>
  </Link>
}
