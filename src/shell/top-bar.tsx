import { useRef, useState } from 'react'
import { Link, NavLink, useNavigate, useParams, useLocation } from 'react-router-dom'
import { Moon, Sun, Search, Layers } from 'lucide-react'
import { useTheme } from '@/lib/theme-context'
import { q } from '@/data/store'
import { useRuntime } from '@/data/runtime'
import { CheckoutMenu } from './repository-bar'
import { cn } from '@/lib/cn'
import { Breadcrumbs } from '@/components/breadcrumbs'

export function TopBar() {
  const { resolved, setPref } = useTheme()
  const { plan, mode } = useRuntime()
  const { pathname } = useLocation()
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
    {mode === 'central' ? <a href="/" className="app-brand" aria-label="Groundwork Hub" title="Back to Groundwork Hub"><span><Layers size={17} /></span><span className="brand-wordmark">groundwork</span></a> : <span className="app-brand" title={plan ? 'Groundwork standalone viewer' : 'Groundwork'}><span><Layers size={17} /></span><span className="brand-wordmark">groundwork</span></span>}
    {plan ? <div className="header-project">{pathname === '/' ? <span aria-current="page" title={plan.manifest.name}>{plan.manifest.name}</span> : <Link to="/" title="Project overview">{plan.manifest.name}</Link>}{mode === 'standalone' && <small>Standalone</small>}</div> : product && workspace ? <Breadcrumbs workspace={workspace} product={product} className="topbar-breadcrumb" /> : <NavLink to="/" end className={({ isActive }) => cn('top-nav', isActive && 'selected')}>{plan ? 'Project' : 'Workspaces'}</NavLink>}
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
    <CheckoutMenu />
    <button className="theme-button" aria-label={`Switch to ${displayedTheme === 'dark' ? 'light' : 'dark'} theme`} onClick={() => setPref(displayedTheme === 'dark' ? 'light' : 'dark')}>{displayedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
    {!plan && viewer && <span className="owner-avatar top-avatar" aria-label={viewer.name}>{viewer.name.split(' ').map(part => part[0]).join('')}</span>}
  </div></header>
}
