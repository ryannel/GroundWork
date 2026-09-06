import { useRef, useState } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom'
import { Moon, Sun, Search, Layers } from 'lucide-react'
import { useTheme } from '@/lib/theme-context'
import { q } from '@/data/store'
import { useRuntime } from '@/data/runtime'
import { cn } from '@/lib/cn'

export function TopBar() {
  const { resolved, setPref } = useTheme()
  const { plan } = useRuntime()
  const viewer = q.viewer()
  const { id } = useParams()
  const feature = q.features().find(f => f.id === id)
  const product = feature && q.product(feature.productId)
  const workspace = product && q.workspace(product.workspaceId)
  const displayedTheme = resolved
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const resultList = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const closeSearch = () => { setQuery(''); setFocused(false) }
  const results = query.trim() ? q.features().filter(f => `${f.title} ${q.product(f.productId)?.name}`.toLowerCase().includes(query.trim().toLowerCase())) : []
  return <header className="app-topbar"><div className="app-topbar-inner">
    <Link to="/" className="app-brand"><span><Layers size={17} /></span>groundwork<span className="brand-divider" /></Link>
    {product && workspace ? <nav className="workbench-breadcrumb" aria-label="Workspace and product"><Link to={`/w/${workspace.slug}`}><small>{plan ? 'Project' : 'Workspace'}</small>{workspace.name}</Link><Link to={`/w/${workspace.slug}/${product.slug}`}><small>Product</small>{product.name}</Link></nav> : <NavLink to="/" end className={({ isActive }) => cn('top-nav', isActive && 'selected')}>{plan ? 'Project' : 'Workspaces'}</NavLink>}
    <div className="global-search" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false) }}><Search size={14} /><input ref={input} aria-label="Find a feature" aria-controls={focused && query.trim() ? 'feature-search-results' : undefined} placeholder="Find a feature…" value={query} onFocus={() => setFocused(true)} onKeyDown={e => {
      if (e.key === 'Escape') closeSearch()
      if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); resultList.current?.querySelector('a')?.focus() }
      if (e.key === 'Enter' && results[0]) { e.preventDefault(); navigate(`/f/${results[0].id}`); closeSearch(); input.current?.blur() }
    }} onChange={e => { setQuery(e.target.value); setFocused(true) }} />
      {focused && query.trim() && <div ref={resultList} id="feature-search-results" className="search-results" onKeyDown={e => {
        const links = Array.from(resultList.current?.querySelectorAll('a') ?? [])
        const index = links.indexOf(document.activeElement as HTMLAnchorElement)
        if (e.key === 'ArrowDown') { e.preventDefault(); links[Math.min(index + 1, links.length - 1)]?.focus() }
        if (e.key === 'ArrowUp') { e.preventDefault(); if (index <= 0) input.current?.focus(); else links[index - 1]?.focus() }
        if (e.key === 'Escape') { e.preventDefault(); input.current?.focus(); closeSearch() }
      }}><div className="eyebrow" role="status">{results.length} matching features</div>{results.map(f => <Link key={f.id} to={`/f/${f.id}`} onClick={closeSearch}>{f.title}<small>{q.product(f.productId)?.name}</small></Link>)}{!results.length && <p>No matches. Try a feature or product name.</p>}</div>}
    </div>
    <button className="theme-button" aria-label={`Switch to ${displayedTheme === 'dark' ? 'light' : 'dark'} theme`} onClick={() => setPref(displayedTheme === 'dark' ? 'light' : 'dark')}>{displayedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
    {viewer && <span className="owner-avatar top-avatar" aria-label={viewer.name}>{viewer.name.split(' ').map(part => part[0]).join('')}</span>}
  </div></header>
}
