import { useId, useRef, useState } from 'react'
import { Link, NavLink, useNavigate, useParams, useLocation } from 'react-router-dom'
import { Moon, Sun, Search, Layers, Monitor } from 'lucide-react'
import { useTheme } from '@/lib/theme-context'
import type { ThemePref } from '@/lib/theme-context'
import { useQuery } from '@/data/store'
import { useRuntime } from '@/data/runtime'
import { navigationSearch } from '@/data/navigation-search'
import { cn } from '@/lib/cn'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { CheckoutMenu } from './checkout-menu'

const themes: Record<ThemePref, { label: string; next: ThemePref; icon: typeof Sun }> = {
  system: { label: 'System', next: 'light', icon: Monitor },
  light: { label: 'Light', next: 'dark', icon: Sun },
  dark: { label: 'Dark', next: 'system', icon: Moon },
}

/** Cycles System → Light → Dark, so a user can always return to following the OS setting. */
function ThemeButton() {
  const { pref, setPref } = useTheme()
  const theme = themes[pref]
  return <button className="theme-button" aria-label={`Theme: ${theme.label}. Switch to ${themes[theme.next].label.toLowerCase()}`}
    title={`Theme: ${theme.label}`} onClick={() => setPref(theme.next)}>
    <theme.icon size={16} />
  </button>
}

/** ARIA 1.2 combobox: the input owns a listbox of feature links; arrow keys move into it, Escape returns. */
function GlobalSearch() {
  const q = useQuery()
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const resultList = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const listId = useId()
  const term = query.trim().toLowerCase()
  const results = navigationSearch(term, { products: q.products(), workspaces: q.workspaces(), components: q.components(), features: q.features() })
  const expanded = focused && !!term
  const closeSearch = () => { setQuery('');
    setFocused(false) }
  return <div className="global-search" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false) }}>
    <Search size={14} />
    <input
      ref={input}
      role="combobox"
      aria-label="Search products, components, features"
      aria-autocomplete="list"
      aria-expanded={expanded}
      aria-controls={listId}
      placeholder="Search your workspace…"
      value={query}
      onFocus={() => setFocused(true)}
      onChange={e => { setQuery(e.target.value);
        setFocused(true) }}
      onKeyDown={e => {
        if (e.key === 'Escape') closeSearch()
        if (e.key === 'ArrowDown' && results.length) { e.preventDefault();
          resultList.current?.querySelector('a')?.focus() }
        if (e.key === 'Enter' && results[0]) { e.preventDefault();
          navigate(results[0].href);
          closeSearch();
          input.current?.blur() }
      }}
    />
    {/* Mounted permanently so the count is announced when results change. */}
    <span className="sr-only" role="status">{expanded ? `${results.length} matching results` : ''}</span>
    <div ref={resultList} id={listId} role="listbox" aria-label="Search results" className="search-results" hidden={!expanded} onKeyDown={e => {
      const links = Array.from(resultList.current?.querySelectorAll('a') ?? [])
      const index = links.indexOf(document.activeElement as HTMLAnchorElement)
      if (e.key === 'ArrowDown') { e.preventDefault();
        links[Math.min(index + 1, links.length - 1)]?.focus() }
      if (e.key === 'ArrowUp') { e.preventDefault();
        if (index <= 0) input.current?.focus(); else links[index - 1]?.focus() }
      if (e.key === 'Escape') { e.preventDefault();
        input.current?.focus();
        closeSearch() }
    }}>
      {expanded && <>
        <div className="eyebrow" aria-hidden="true">{results.length} matching results</div>
        {results.map(f => <Link key={f.id} role="option" aria-selected={false} to={f.href} onClick={closeSearch}>
          {f.title}<small>{f.context}</small>
        </Link>)}
        {!results.length && <p>No matches. Try a product, component, or feature name.</p>}
      </>}
    </div>
  </div>
}

export function TopBar() {
  const q = useQuery()
  const { plan } = useRuntime()
  const { pathname } = useLocation()
  const { id } = useParams()
  const feature = id ? q.features().find(f => f.id === id) : undefined
  const product = feature && q.product(feature.productId)
  const workspace = product && q.workspace(product.workspaceId)
  const brand = <><span><Layers size={17} /></span><span className="brand-wordmark">groundwork</span></>
  return <header className="app-topbar"><div className="app-topbar-inner">
    <a href="/" className="app-brand" aria-label="Groundwork Hub" title="Back to Groundwork Hub">{brand}</a>
    {plan
      ? <div className="header-project">
        {pathname === '/'
          ? <span aria-current="page" title={plan.manifest.name}>{plan.manifest.name}</span>
          : <Link to="/" title="Project overview">{plan.manifest.name}</Link>}
      </div>
      : product && workspace
        ? <Breadcrumbs workspace={workspace} product={product} className="topbar-breadcrumb" />
        : <NavLink to="/" end className={({ isActive }) => cn('top-nav', isActive && 'selected')}>Workspaces</NavLink>}
    {plan && <GlobalSearch />}
    <CheckoutMenu />
    <ThemeButton />
  </div></header>
}
