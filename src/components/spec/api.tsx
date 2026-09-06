import { useDisclosures } from './use-disclosures'
import type { Api, ApiContract } from '@/data/spec'
import { q } from '@/data/store'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { changeSummary } from './change-meta'
import { LensNote, RefRow } from './refs'
import { useFocus, useLens, useSpec } from './context'
import { ResponseSchema } from './response-schema'

const endpointLabel = { added: 'New endpoint', updated: 'Modified endpoint', removed: 'Removed endpoint', unchanged: 'Unchanged endpoint', unspecified: 'Change not assessed' }

export function ApiContractCard({ c, open, onToggle, focus, compact = false }: { c: ApiContract; open: boolean; onToggle: () => void; focus?: string; compact?: boolean }) {
  const { ix } = useSpec()
  const f = useFocus(c.id, compact ? undefined : focus)
  const edge = ix.contractEdge[c.id]
  const tests = ix.contractTests[c.id] ?? []
  return <article ref={f} className={cn('api-contract', open && 'is-open', focus === c.id && !compact && 'focus-flash')}>
    <button aria-expanded={open} onClick={onToggle} className="api-contract-toggle">
      <span className={`endpoint-symbol schema-state-${c.change}`} aria-hidden="true">{c.change === 'added' ? '+' : c.change === 'removed' ? '−' : c.change === 'unspecified' ? '?' : c.change === 'unchanged' ? '=' : '~'}</span>
      <code className={cn(c.change === 'removed' && 'line-through')}>{c.method} {c.path}</code>
      <span className={`endpoint-status schema-state-${c.change}`}>{endpointLabel[c.change]}</span>
      <ChevronDown size={14} className={cn(open && 'rotate-180')} />
    </button>
    {open && <div className="api-contract-body">
      {c.responseSchema ? <ResponseSchema schema={c.responseSchema} /> : c.response ? <section className="api-example"><h4>Response example</h4><pre>{c.response}</pre><p>Field changes have not been specified.</p></section> : <p className="api-no-response">{c.method === 'EVENT' ? 'This event has a payload and no response body.' : 'No response schema specified.'}</p>}
      {c.request && <details className="api-request"><summary>{c.method === 'EVENT' ? 'Event payload' : 'Request example'}</summary><pre>{c.request}</pre></details>}
      {c.note && <p className="api-contract-note">{c.note}</p>}
      {!compact && <RefRow cols={2} className="api-connections" groups={[
        { label: 'In flow', refs: edge ? [{ kind: 'flow', id: ix.edge[edge].from }, { kind: 'flow', id: ix.edge[edge].to }] : [] },
        { label: 'Used at', refs: (ix.contractSteps[c.id] ?? []).map(id => ({ kind: 'journey', id })) },
        { label: 'Tested by', refs: tests.map(id => ({ kind: 'tests', id })), warn: c.change === 'removed' ? undefined : 'no linked test' },
      ]} />}
    </div>}
  </article>
}

export function ApiSection({ data: full, focus }: { data: Api; focus?: string }) {
  const lens = useLens('api')
  const data = { contracts: lens ? full.contracts.filter(c => lens.has(c.id)) : full.contracts }
  const { open, toggle, replace: setOpen } = useDisclosures([focus ?? data.contracts.find(c => c.change === 'updated')?.id ?? data.contracts[0]?.id].filter((id): id is string => !!id), focus)
  const all = data.contracts.length > 0 && data.contracts.every(c => open.has(c.id))
  const boundaries = [...new Set(data.contracts.map(c => `${c.from}→${c.to}`))]
  return <div className="api-section">
    <div className="api-section-summary"><span>{data.contracts.length} contracts · {changeSummary(data.contracts.map(c => c.change))}</span><LensNote shown={data.contracts.length} total={full.contracts.length} kind="contracts" /><button disabled={!data.contracts.length} onClick={() => setOpen(all ? new Set() : new Set(data.contracts.map(c => c.id)))}>{all ? 'Collapse all' : 'Expand all'}</button></div>
    {!data.contracts.length && <p>No contracts in this scope. Choose All components to explore the full plan.</p>}
    {boundaries.map(boundary => {
      const [from, to] = boundary.split('→')
      return <section key={boundary} className="api-boundary"><h3><span>{q.componentLabel(from)}</span><ArrowRight size={13} /><span>{q.componentLabel(to)}</span></h3>{data.contracts.filter(c => `${c.from}→${c.to}` === boundary).map(c => <ApiContractCard key={c.id} c={c} open={open.has(c.id)} onToggle={() => toggle(c.id)} focus={focus} />)}</section>
    })}
  </div>
}
