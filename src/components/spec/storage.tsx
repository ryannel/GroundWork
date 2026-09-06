import { useDisclosures } from './use-disclosures'
import type { Storage, Table } from '@/data/spec'
import { q } from '@/data/store'
import { Key, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ChangeMark } from './change'
import { changeSummary } from './change-meta'
import { LensNote, RefRow } from './refs'
import { useFocus, useLens, useSpec } from './context'

export function TableCard({ t, open, onToggle, focus, compact = false }: { t: Table; open: boolean; onToggle: () => void; focus?: string; compact?: boolean }) {
  const { ix } = useSpec()
  const f = useFocus(t.id, compact ? undefined : focus)
  const recordKind = t.kind ?? 'table'
  const recordLabel = { table: 'SQL table', object: 'Object record', 'local-file': 'Local file' }[recordKind]
  const removed = t.change === 'removed'
  const columnChanges = t.columns.map(c => c.change ?? t.change)
  const node = ix.tableNode[t.id]
  return (
    <div ref={f} className={cn('overflow-hidden rounded-md border border-border', compact && 'store-table-compact', focus === t.id && !compact && 'focus-flash')}>
      <button aria-expanded={open} onClick={onToggle} className={`change-row change-${t.change} flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-left transition-colors`}>
        <ChangeMark change={t.change} />
        <code className={cn('font-mono text-[13px] font-medium', removed && 'line-through')}>{t.name}</code><span className="text-small text-fg-subtle">{recordLabel}</span>
        {t.change === 'updated' && <span className="text-small text-fg-subtle">{changeSummary(columnChanges)}</span>}
        <ChevronDown className={cn('ml-auto size-4 text-fg-subtle transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-small">
              <thead><tr className="text-left text-fg-muted"><th className="pl-4 py-2">Change</th><th className="px-3">{recordKind === 'table' ? 'Column' : 'Field'}</th><th className="px-3">Type</th><th className="px-3">Notes</th></tr></thead>
              <tbody className="divide-y divide-border">
                {t.columns.map(c => {
                  const ch = c.change ?? t.change
                  return (
                    <tr key={c.name} className={`schema-change-row change-${ch}`}>
                      <td className="w-24 pl-4 pr-2 py-2"><ChangeMark change={ch} /></td>
                      <td className={cn('w-48 px-3 py-2 font-mono text-[12px]', ch === 'removed' && 'line-through')}><span className="flex items-center gap-1.5 whitespace-nowrap">{c.key && <Key className="size-3 text-warning" />}{c.name}</span></td>
                      <td className="w-36 px-3 py-1.5 font-mono text-[12px] whitespace-nowrap text-fg-muted">{c.type}</td>
                      <td className="px-3 py-1.5 text-fg-muted">{c.note}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {t.note && <p className="border-t border-border px-4 py-2.5 text-small text-fg-muted">{t.note}</p>}
          {!compact && <RefRow cols={2} className="border-t border-border bg-(--glass-fill-2) px-4 py-3" groups={[
            { label: 'In flow', refs: node ? [{ kind: 'flow', id: node }] : [] },
            { label: 'Written at', refs: (ix.tableSteps[t.id] ?? []).map(id => ({ kind: 'journey', id })) },
            { label: 'Tested by', refs: (ix.tableTests[t.id] ?? []).map(id => ({ kind: 'tests', id })), warn: removed ? undefined : 'no test' },
          ]} />}
        </div>
      )}
    </div>
  )
}

export function StorageSection({ data: full, focus }: { data: Storage; focus?: string }) {
  const lens = useLens('storage')
  const data = { tables: lens ? full.tables.filter(t => lens.has(t.id)) : full.tables }
  const { open, toggle, replace: setOpen } = useDisclosures(data.tables.filter(t => t.change !== 'removed' || t.id === focus).map(t => t.id), focus)
  const all = data.tables.length > 0 && data.tables.every(t => open.has(t.id))
  const stores = [...new Set(data.tables.map(t => t.component))]
  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-3 text-small text-fg-muted">
        <span>{data.tables.length} {data.tables.length === 1 ? 'storage record' : 'storage records'}{data.tables.length ? ` · ${changeSummary(data.tables.map(t => t.change))}` : ''}</span>
        <LensNote shown={data.tables.length} total={full.tables.length} kind="storage records" />
        <button disabled={!data.tables.length} onClick={() => setOpen(all ? new Set() : new Set(data.tables.map(t => t.id)))} className="ml-auto hover:text-fg">{all ? 'Collapse all' : 'Expand all'}</button>
      </div>
      {!data.tables.length && <p className="text-small text-fg-muted">No storage records in this scope. Choose All components to explore the full plan.</p>}
      {stores.map(cid => (
        <div key={cid}>
          <div className="mb-2 font-mono text-[12px] text-fg-muted"><span className="text-fg">{q.componentLabel(cid)}</span> <span className="text-fg-subtle">· {q.componentType(cid)}</span></div>
          <div className="grid gap-3">
            {data.tables.filter(t => t.component === cid).map(t => <TableCard key={t.id} t={t} open={open.has(t.id)} onToggle={() => toggle(t.id)} focus={focus} />)}
          </div>
        </div>
      ))}
    </div>
  )
}
