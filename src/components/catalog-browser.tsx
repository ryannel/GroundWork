import { useId, useState, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { catalogSelection, filterCatalog, type CatalogEntry } from '@/data/catalog-navigation'
import { browserParam, type CatalogBrowserKey, type CatalogLocation } from '@shared/catalog-url'
import { useCatalogLocation } from './inspector/use-catalog-location'

const scrollPositions = new Map<string, number>()
const MAX_SCROLL_POSITIONS = 100

function showMobileDetail(container: HTMLDivElement | null) {
  const detail = container?.querySelector<HTMLElement>('.catalog-detail')
  if (detail && window.matchMedia('(max-width: 760px)').matches) {
    detail.scrollIntoView({ block: 'start' })
    detail.focus({ preventScroll: true })
  }
}

/**
 * With `urlKey`, search, group and selection live in the URL (`<key>Query|Group|Entity`); without it (compact
 * embedded catalogs) they are local. `resetPatch` clears the caller's own URL filters in the same navigation.
 */
export function CatalogBrowser({ label, entries, total = entries.length, filters, filtered = false, resetPatch, groupLabel, renderDetail, urlKey }: {
  urlKey?: CatalogBrowserKey; label: string; entries: CatalogEntry[]; total?: number; filters?: ReactNode; filtered?: boolean
  resetPatch?: CatalogLocation; groupLabel: string; renderDetail: (id: string) => ReactNode
}) {
  const id = useId()
  const container = useRef<HTMLDivElement>(null)
  const [location, navigate] = useCatalogLocation()
  const [localQuery, setLocalQuery] = useState('')
  const [localGroup, setLocalGroup] = useState('all')
  const [localSelectedId, setLocalSelectedId] = useState('')
  const revealDetail = useRef(false)
  const query = urlKey ? location[browserParam(urlKey, 'Query')] ?? '' : localQuery
  const group = urlKey ? location[browserParam(urlKey, 'Group')] ?? 'all' : localGroup
  const selectedId = urlKey ? location[browserParam(urlKey, 'Entity')] ?? '' : localSelectedId
  const setQuery = (value: string) => {
    if (urlKey) navigate({ catalog: urlKey, [browserParam(urlKey, 'Query')]: value })
    else setLocalQuery(value)
  }
  const setGroup = (value: string) => {
    if (urlKey) navigate({ catalog: urlKey, [browserParam(urlKey, 'Group')]: value === 'all' ? undefined : value })
    else setLocalGroup(value)
  }
  const setSelectedId = (value: string) => {
    if (value === selected?.id) { showMobileDetail(container.current);
      return }
    revealDetail.current = true
    if (urlKey) navigate({ catalog: urlKey, [browserParam(urlKey, 'Entity')]: value })
    else setLocalSelectedId(value)
  }
  const reset = () => {
    if (urlKey) navigate({ [browserParam(urlKey, 'Query')]: undefined, [browserParam(urlKey, 'Group')]: undefined, ...resetPatch })
    else { setLocalQuery('');
      setLocalGroup('all') }
  }
  // Only this browser's own state positions its lists; other URL changes must not restore stale offsets.
  const scrollKey = `${urlKey ?? label}:${entries.map(entry => entry.id).join(',')}:${query}:${group}`
  useLayoutEffect(() => {
    const index = container.current?.querySelector<HTMLElement>('.catalog-index')
    if (index) index.scrollTop = scrollPositions.get(scrollKey) ?? 0
    return () => {
      scrollPositions.set(scrollKey, index?.scrollTop ?? 0)
      if (scrollPositions.size > MAX_SCROLL_POSITIONS) scrollPositions.delete(scrollPositions.keys().next().value!)
    }
  }, [scrollKey])
  const groups = useMemo(() => [...new Set(entries.map(entry => entry.group))].sort((a, b) => a.localeCompare(b)), [entries])
  const visible = useMemo(
    () => filterCatalog(entries, query, group).sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name)),
    [entries, query, group],
  )
  const selected = catalogSelection(visible, selectedId)
  const visibleSelectedId = selected?.id
  useLayoutEffect(() => {
    if (!visibleSelectedId) return
    const index = container.current?.querySelector<HTMLElement>('.catalog-index')
    const button = index?.querySelector<HTMLElement>('[aria-current="true"]')
    // Reveal deep-linked selections inside the navigator without moving the page.
    if (index && button) {
      const list = index.getBoundingClientRect()
      const item = button.getBoundingClientRect()
      if (item.top < list.top) index.scrollTop += item.top - list.top
      else if (item.bottom > list.bottom) index.scrollTop += item.bottom - list.bottom
    }
    if (!revealDetail.current) return
    revealDetail.current = false
    showMobileDetail(container.current)
  }, [visibleSelectedId])
  const groupOptions = group !== 'all' && !groups.includes(group) ? [...groups, group] : groups
  return <div className="catalog-browser" ref={container}>
    <div className="catalog-toolbar">
      <label className="catalog-search">
        <Search size={16} aria-hidden="true" />
        <span className="sr-only">Search {label}</span>
        <input
          type="search" aria-label={`Search ${label}`} placeholder={`Search ${label.toLowerCase()}…`}
          value={query} onChange={event => setQuery(event.target.value)}
        />
        {query && <button aria-label={`Clear ${label.toLowerCase()} search`} onClick={() => setQuery('')}><X size={14} /></button>}
      </label>
      <label className="catalog-filter">
        <span>{groupLabel}</span>
        <select value={group} onChange={event => setGroup(event.target.value)}>
          <option value="all">All {groupLabel.toLowerCase()}</option>
          {groupOptions.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      {filters}
    </div>
    <div className="catalog-results">
      <span role="status">{visible.length} of {total} {label.toLowerCase()}</span>
      {(query || group !== 'all' || filtered) && <button onClick={reset}>Reset filters</button>}
      <span>Search names, paths and fields</span>
    </div>
    {selected ? <div className="catalog-split">
      <nav className="catalog-index" aria-label={`${label} catalog`}>
        {groups.filter(name => visible.some(entry => entry.group === name)).map(name => {
          const members = visible.filter(entry => entry.group === name)
          return <section key={name}>
            <h5>{name}<span>{members.length}</span></h5>
            {members.map(entry => <button
              key={entry.id} aria-current={selected.id === entry.id ? 'true' : undefined} aria-controls={id} onClick={() => setSelectedId(entry.id)}
            >
              <span className="catalog-entry-name">
                {entry.badge && <small className={`catalog-badge method-${entry.badge.toLowerCase()}`}>{entry.badge}</small>}
                <strong>{entry.name}</strong>
              </span>
              <small className="catalog-entry-detail">{entry.detail}</small>
              {entry.annotation && <span className="catalog-entry-annotation">{entry.annotation}</span>}
            </button>)}
          </section>
        })}
      </nav>
      <div className="catalog-detail" id={id} role="region" aria-label={`Selected ${label.toLowerCase()} detail`} tabIndex={0} key={selected.id}>
        <button className="catalog-back-to-list" onClick={() => {
          const index = container.current?.querySelector<HTMLElement>('.catalog-index')
          index?.scrollIntoView({ block: 'start' })
          index?.querySelector<HTMLElement>('[aria-current="true"]')?.focus({ preventScroll: true })
        }}>← Back to {label.toLowerCase()}</button>
        {renderDetail(selected.id)}
      </div>
    </div> : <div className="catalog-no-results">
      <h5>No matching {label.toLowerCase()}</h5>
      <p>Try a different name, path or field, or clear the filters.</p>
      <button onClick={reset}>Reset filters</button>
    </div>}
  </div>
}
