import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDisclosures } from './use-disclosures'
import type { Storage, Table } from '@/data/spec'
import { useQuery } from '@/data/store'
import { Key, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/cn'
import { changeMeta } from './change-meta'
import { RefRow } from './refs'
import { useFocus, useSpec } from './context'
import { componentPath, componentScopeIds } from '@/data/component-structure'

const recordLabels = { table: 'SQL table', object: 'Object record', 'local-file': 'Local file' }

export function TableCard({ t, open, onToggle, focus, compact = false }: { t: Table; open: boolean; onToggle: () => void; focus?: string; compact?: boolean }) {
  const { ix, featureId } = useSpec()
  const f = useFocus(t.id, compact ? undefined : focus)
  const recordKind = t.kind ?? 'table'
  const removed = t.change === 'removed'
  const node = ix.tableNode[t.id]
  return <div ref={f} className={cn('model-record', compact && 'store-table-compact', focus === t.id && !compact && 'focus-flash')}>
    <button aria-expanded={open} onClick={onToggle} className="model-record-toggle" aria-label={`${t.name} · ${t.columns.length} fields`}>
      <span className="model-record-label"><code className={cn(removed && 'line-through')}>{t.name}</code>{t.description && <span>{t.description}</span>}<small>{recordLabels[recordKind]} · {t.columns.length ? `${t.columns.length} fields` : 'Fields not documented'}</small></span>
      {t.change !== 'unspecified' && <span className={`endpoint-status schema-state-${t.change}`}>{changeMeta[t.change].label}</span>}
      <ChevronDown size={15} className={cn(open && 'rotate-180')} />
    </button>
    {open && <div className="model-record-body">
      <p className="model-assessment">Schema change: {changeMeta[t.change].label.toLowerCase()}.{t.change === 'unspecified' && ' This is the planned shape; it has not been compared with the implementation.'}</p>
      {t.columns.length ? <section aria-label={`Fields in ${t.name}`} className="model-fields">
        <h5>{recordKind === 'table' ? 'Columns' : 'Fields'}<span>Expand a field for its constraints and notes.</span></h5>
        {t.columns.map(c => {
          const ch = c.change ?? t.change
          const label = <><span className={cn('model-field-name', ch === 'removed' && 'line-through')}>{c.key && <span title="Key marker in the plan" aria-label="Key field"><Key size={12} /></span>}<code>{c.name}</code></span><code className="model-field-type">{c.type}</code>{ch !== 'unspecified' && ch !== 'unchanged' && <span className={`endpoint-status schema-state-${ch}`}>{changeMeta[ch].label}</span>}</>
          return c.note ? <details className="model-field" key={c.name}><summary>{label}<ChevronDown size={13} /></summary><div className="model-field-notes">{c.note.split(/\s+--\s*/).filter(Boolean).map((note, i) => <p key={i}>{note.replace(/^--\s*/, '')}</p>)}</div></details> : <div className="model-field model-field-plain" key={c.name}>{label}</div>
        })}
      </section> : <p className="model-schema-gap">This record is referenced by the plan, but its fields have not been defined.</p>}
      {t.note && (t.columns.length ? <details className="model-notes"><summary>Schema notes & source</summary><p>{t.note}</p></details> : <p className="model-schema-gap">{t.note}</p>)}
      {!compact && <><details className="model-notes"><summary>Usage & tests · {(ix.tableTests[t.id] ?? []).length} linked tests</summary><RefRow cols={1} groups={[
        { label: 'System flow', refs: node ? [{ kind: 'flow', id: node }] : [] },
        { label: 'Journey', refs: (ix.tableSteps[t.id] ?? []).map(id => ({ kind: 'journey', id })) },
        { label: 'Tests', refs: (ix.tableTests[t.id] ?? []).map(id => ({ kind: 'tests', id })), warn: removed ? undefined : 'No linked test' },
      ]} /></details><footer className="model-record-footer"><Link to={`/f/${featureId}/storage/${t.id}`}>Record: {t.id}</Link></footer></>}
    </div>}
  </div>
}

const groupOf = (t: Table) => t.group ?? recordLabels[t.kind ?? 'table']

export function StorageSection({ data: full, focus }: { data: Storage; focus?: string }) {
  const q = useQuery()
  const { featureId } = useSpec()
  const [params] = useSearchParams()
  const focused = full.tables.find(t => t.id === focus)
  const selected = focused?.component ?? params.get('component') ?? ''
  const components = q.components()
  const scope = selected ? componentScopeIds(selected, components) : undefined
  const stores = [...new Set(full.tables.map(t => t.component))].sort((a, b) => q.componentLabel(a).localeCompare(q.componentLabel(b)))
  const scoped = stores.filter(id => !scope || scope.has(id))
  const [view, setView] = useState({ selected, focus, query: '', change: '' })
  if (view.selected !== selected || view.focus !== focus) setView({ selected, focus, query: '', change: '' })
  const query = view.query.trim().toLowerCase()
  const matches = (t: Table) => !query || [t.id, t.name, t.description, t.group, ...t.columns.flatMap(c => [c.name, c.type])].join(' ').toLowerCase().includes(query)
  const data = full.tables.filter(t => scoped.includes(t.component) && (!view.change || t.change === view.change) && matches(t))
  const { open, toggle, replace } = useDisclosures(focus ? [focus] : [], focus)
  return <div className="model-section">
    <nav className="api-component-guides" aria-label="Data stores">
      <Link to={`/f/${featureId}/storage`} aria-current={!selected ? 'page' : undefined}>All stores</Link>
      {stores.map(id => <Link key={id} to={`/f/${featureId}/storage?component=${encodeURIComponent(id)}`}
        aria-current={selected && scoped.length === 1 && scoped[0] === id ? 'page' : undefined}>{q.componentLabel(id)}</Link>)}
    </nav>
    <div className="api-toolbar">
      <label className="api-search"><Search size={15} />
        <input type="search" aria-label="Search data model" placeholder="Find a record or field…" value={view.query}
          onChange={e => setView({ ...view, query: e.target.value })} />
      </label>
      <label>Change<select aria-label="Filter schema changes" value={view.change} onChange={e => setView({ ...view, change: e.target.value })}>
        <option value="">All changes</option>
        {Object.entries(changeMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
      </select></label>
    </div>
    <div className="api-section-summary">
      <span role="status">{data.length} {data.length === 1 ? 'record' : 'records'} · {data.reduce((n, t) => n + t.columns.length, 0)} fields</span>
      <button disabled={!data.some(t => open.has(t.id))} onClick={() => replace(new Set())}>Collapse details</button>
    </div>
    {!data.length && <div className="api-empty">
      <h3>No records in this view</h3>
      <p>{!scoped.length && selected
        ? `No stored records are assigned to ${q.componentLabel(selected)} or its internals in this plan. Select a data store above to explore its model.`
        : 'Try another record name, field, or change filter.'}</p>
      {(view.query || view.change) && <button onClick={() => setView({ ...view, query: '', change: '' })}>Clear filters</button>}
    </div>}
    {scoped.map(cid => {
      const records = data.filter(t => t.component === cid).sort((a, b) => a.name.localeCompare(b.name))
      if (!records.length) return null
      const groups = [...new Set(records.map(groupOf))].sort()
      return <section key={cid} className="model-store">
        <header><h3>{componentPath(cid, components)}</h3><p>{q.component(cid)?.description}</p></header>
        {groups.map(group => {
          const inGroup = records.filter(t => groupOf(t) === group)
          return <section key={group} className="model-group">
            <h4>{group}<span>{inGroup.length}</span></h4>
            {inGroup.map(t => <TableCard key={t.id} t={t} open={open.has(t.id)} onToggle={() => toggle(t.id)} focus={focus} />)}
          </section>
        })}
      </section>
    })}
  </div>
}
