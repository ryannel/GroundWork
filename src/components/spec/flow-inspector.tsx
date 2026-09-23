import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Code2, Database, GitBranch, Workflow, X } from 'lucide-react'
import type { JourneyStep } from '@/data/spec'
import type { FlowSelection } from '@/data/flow-context'
import { actionFlow } from '@/data/flow-context'
import { useQuery } from '@/data/store'
import { useSpec } from './context'
import { ApiContractCard } from './api'
import { TableCard } from './storage'

type Selected = Exclude<FlowSelection, { kind: 'none' }>

function BoundaryDetails({ selection }: { selection: Extract<Selected, { kind: 'boundary' }> }) {
  const q = useQuery()
  const { contracts, selected } = selection
  const [open, setOpen] = useState(selected ?? contracts[0]?.id)
  return <div className="inspector-contracts">{contracts.map(c => <div key={c.id}>
    <p className="boundary-ownership">{q.componentLabel(c.from)} <ArrowRight size={12} /> {q.componentLabel(c.to)}</p>
    <ApiContractCard c={c} compact open={open === c.id} onToggle={() => setOpen(open === c.id ? '' : c.id)} />
  </div>)}</div>
}

function StoreDetails({ selection, action }: { action: JourneyStep; selection: Extract<Selected, { kind: 'node' }> }) {
  const { ix, featureId } = useSpec()
  const tables = (selection.node.tables ?? []).map(id => ix.table[id]).filter(Boolean)
  const [closed, setClosed] = useState<Set<string>>(new Set())
  return <div className="store-inspector-tables">
    {tables.map(table => <div key={table.id}><TableCard t={table} compact open={!closed.has(table.id)} onToggle={() => setClosed(previous => {
      const next = new Set(previous)
      if (next.has(table.id)) next.delete(table.id); else next.add(table.id)
      return next
    })} /><Link className="inspector-detail-link" to={`/f/${featureId}/storage/${table.id}?trace=journey:${action.id}`}>Open {table.name} in data model <ArrowRight size={12} /></Link></div>)}
    {!tables.length && <p className="inspector-empty">No database schema is documented for this store yet.</p>}
  </div>
}

export function FlowInspector({ action, selection, onNode, onBoundary, onClose }: {
  action: JourneyStep
  selection: Selected
  onNode: (id: string) => void
  onBoundary: (id: string) => void
  onClose: () => void
}) {
  const q = useQuery()
  const { spec, ix, featureId } = useSpec()
  const node = selection.kind === 'node' ? selection.node : undefined
  const decision = node?.kind === 'decision'
  const store = node?.kind === 'store'
  const title = selection.kind === 'boundary' ? 'API contract' : decision ? 'Decision logic' : store ? 'Database schema' : 'Processing step'
  const Icon = selection.kind === 'boundary' ? Code2 : decision ? GitBranch : store ? Database : Workflow
  const flow = actionFlow(spec, action)
  const outgoing = node ? flow.edges.filter(edge => edge.from === node.id) : []
  const tests = (ix.stepTests[action.id] ?? []).map(id => ix.test[id]).filter(Boolean)
  const heading = useRef<HTMLHeadingElement>(null)
  const selectedId = selection.kind === 'node' ? selection.node.id : selection.edge.id
  // Scroll/focus on every new selection, not on re-renders that keep the same selection; a ref tracks
  // the selection the effect last handled since neither action.id nor selectedId is read in its body.
  const selectionKey = `${action.id}:${selectedId}`
  const handledSelection = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (handledSelection.current === selectionKey) return
    handledSelection.current = selectionKey
    if (window.matchMedia('(max-width: 1200px)').matches) {
      heading.current?.scrollIntoView({ block: 'start' })
      heading.current?.focus({ preventScroll: true })
    }
  })
  return <aside className="api-inspector flow-inspector" aria-label={title} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <header className="inspector-heading"><span><Icon size={19} /></span><h3 ref={heading} tabIndex={-1}>{title}</h3>
      <button className="inspector-close" aria-label="Close selection" title="Close details (Esc)" onClick={onClose}><X size={16} /><span>Back to flow</span></button>
    </header>
    <div className="inspector-action-context"><small>FOR THIS ACTION · {action.actor}</small><p>{action.action}</p></div>
    {node && <div className="inspector-node-heading">
      <h4>{node.label}</h4>
      <code>{q.componentLabel(node.component ?? '')} · {q.componentType(node.component ?? '')}</code>
      {node.description && <p>{node.description}</p>}
    </div>}
    {selection.kind === 'boundary' && <BoundaryDetails key={`${action.id}:${selection.edge.id}:${selection.selected ?? ''}`} selection={selection} />}
    {selection.kind === 'node' && store && <StoreDetails key={node!.id} selection={selection} action={action} />}
    {decision && <section className="decision-logic">
      <h5>Condition</h5>
      {node.logic ? <><pre>{node.logic.expression}</pre><p>{node.logic.explanation}</p><h5>Outcomes</h5>
        <div className="decision-outcomes">{node.logic.branches.map(branch => {
          const edge = ix.edge[branch.edgeId]
          const target = edge && ix.node[edge.to]
          const inAction = flow.edges.some(e => e.id === branch.edgeId)
          const alternative = !inAction && spec.journey?.steps.find(step => step.id !== action.id && step.flow?.includes(node.id) && step.flow.includes(edge?.to))
          return <article key={branch.edgeId} className={inAction ? 'is-current-outcome' : ''}>
            <div><strong>{branch.when}</strong><small>{inAction ? 'In this action' : 'Other outcome'}</small></div>
            <p>{branch.then}</p>
            {target && (inAction
              ? <button onClick={() => onNode(target.id)}>{target.label}<ArrowRight size={13} /></button>
              : alternative
                ? <Link to={`/f/${featureId}/flow?trace=journey:${alternative.id}&node=${target.id}`}>
                  Explore in: {alternative.action}<ArrowRight size={13} />
                </Link>
                : <span className="text-fg-muted">Next: {target.label}</span>)}
          </article>
        })}</div>
      </> : <p className="inspector-empty">The condition and outcomes have not been documented for this decision.</p>}
    </section>}
    {node && !decision && !store && <section className="processing-connections">
      <h5>Next in this action</h5>
      {outgoing.map(edge => <button key={edge.id} onClick={() => edge.contracts?.length ? onBoundary(edge.id) : onNode(edge.to)}>
        <span>{ix.node[edge.to]?.label}<small>{edge.contracts?.length ? 'Inspect API contract' : edge.label ?? 'Inspect processing step'}</small></span>
        <ArrowRight size={14} />
      </button>)}
      {!outgoing.length && <p>This is the end of the documented path for this action.</p>}
    </section>}
    <section className="action-evidence">
      <h5>Tests for this action</h5>
      {tests.length
        ? tests.map(test => <Link key={test.id} to={`/f/${featureId}/tests/${test.id}?trace=journey:${action.id}`}>
          <span>{test.title}</span><small>{test.status ?? 'planned'}</small>
        </Link>)
        : <p>No tests are linked to this action yet.</p>}
    </section>
  </aside>
}
