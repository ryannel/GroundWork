import { useId, useState, useLayoutEffect, useRef, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { catalogSelection, filterCatalog, type CatalogEntry } from '@/data/catalog-navigation'

const scrollPositions = new Map<string, [number, number]>()

export function CatalogBrowser({ label, entries, total = entries.length, filters, filtered = false, onReset, groupLabel, renderDetail, initialSelectedId, urlKey }: {
  urlKey?: string; initialSelectedId?: string; label: string; entries: CatalogEntry[]; total?: number; filters?: ReactNode; filtered?: boolean; onReset?: () => void; groupLabel: string; renderDetail: (id: string) => ReactNode
}) {
  const id = useId()
  const [params, setParams] = useSearchParams()
  const [localQuery, setLocalQuery] = useState('')
  const [localGroup, setLocalGroup] = useState('all')
  const [localSelectedId, setLocalSelectedId] = useState(initialSelectedId ?? '')
  const query = urlKey ? params.get(`${urlKey}Query`) ?? '' : localQuery
  const group = urlKey ? params.get(`${urlKey}Group`) ?? 'all' : localGroup
  const selectedId = urlKey ? params.get(`${urlKey}Entity`) ?? initialSelectedId ?? '' : localSelectedId
  const change = (field: string, value: string, fallback: (value: string) => void, replace = false) => {
    if (!urlKey) { fallback(value); return }
    setParams(previous => { const next = new URLSearchParams(previous); next.set(`${urlKey}${field}`, value); next.set('catalog', urlKey); return next }, { replace, preventScrollReset: true })
  }
  const setQuery = (value: string) => change('Query', value, setLocalQuery, true)
  const setGroup = (value: string) => change('Group', value, setLocalGroup)
  const setSelectedId = (value: string) => change('Entity', value, setLocalSelectedId)
  const container = useRef<HTMLDivElement>(null)
  const scrollKey = `${params.toString()}:${urlKey ?? label}`
  useLayoutEffect(() => {
    const index = container.current?.querySelector<HTMLElement>('.catalog-index')
    const detail = container.current?.querySelector<HTMLElement>('.catalog-detail')
    const positions = scrollPositions.get(scrollKey)
    if (positions) { if (index) index.scrollTop = positions[0]; if (detail) detail.scrollTop = positions[1] }
    return () => {
      scrollPositions.set(scrollKey, [index?.scrollTop ?? 0, detail?.scrollTop ?? 0])
      if (scrollPositions.size > 100) scrollPositions.delete(scrollPositions.keys().next().value!)
    }
  }, [scrollKey])
  const groups = [...new Set(entries.map(entry => entry.group))].sort((a, b) => a.localeCompare(b))
  const visible = filterCatalog(entries, query, group).sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
  const selected = catalogSelection(visible, selectedId)
  const reset = () => { if (urlKey) setParams(previous => { const next = new URLSearchParams(previous); next.delete(`${urlKey}Query`); next.delete(`${urlKey}Group`); return next }, { preventScrollReset: true }); else { setLocalQuery(''); setLocalGroup('all') }; onReset?.() }
  return <div className="catalog-browser" ref={container}>
    <div className="catalog-toolbar">
      <label className="catalog-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search {label}</span><input type="search" aria-label={`Search ${label}`} placeholder={`Search ${label.toLowerCase()}…`} value={query} onChange={event => setQuery(event.target.value)} />{query && <button aria-label={`Clear ${label.toLowerCase()} search`} onClick={() => setQuery('')}><X size={14} /></button>}</label>
      <label className="catalog-filter"><span>{groupLabel}</span><select value={group} onChange={event => setGroup(event.target.value)}><option value="all">All {groupLabel.toLowerCase()}</option>{[...new Set([...groups, ...(group !== 'all' ? [group] : [])])].map(name => <option key={name} value={name}>{name}</option>)}</select></label>
      {filters}
    </div>
    <div className="catalog-results"><span role="status">{visible.length} of {total} {label.toLowerCase()}</span>{(query || group !== 'all' || filtered) && <button onClick={reset}>Reset filters</button>}<span>Search names, paths and fields</span></div>
    {selected ? <div className="catalog-split">
      <nav className="catalog-index" aria-label={`${label} catalog`}>
        {groups.filter(name => visible.some(entry => entry.group === name)).map(name => <section key={name}><h5>{name}<span>{visible.filter(entry => entry.group === name).length}</span></h5>{visible.filter(entry => entry.group === name).map(entry => <button key={entry.id} aria-current={selected.id === entry.id ? 'true' : undefined} aria-controls={id} onClick={() => setSelectedId(entry.id)}>
          <span className="catalog-entry-name">{entry.badge && <small className={`catalog-badge method-${entry.badge.toLowerCase()}`}>{entry.badge}</small>}<strong>{entry.name}</strong></span><small className="catalog-entry-detail">{entry.detail}</small>{entry.annotation && <span className="catalog-entry-annotation">{entry.annotation}</span>}
        </button>)}</section>)}
      </nav>
      <div className="catalog-detail" id={id} role="region" aria-label={`Selected ${label.toLowerCase()} detail`} tabIndex={0} key={selected.id}>{renderDetail(selected.id)}</div>
    </div> : <div className="catalog-no-results"><h5>No matching {label.toLowerCase()}</h5><p>Try a different name, path or field, or clear the filters.</p><button onClick={reset}>Reset filters</button></div>}
  </div>
}
