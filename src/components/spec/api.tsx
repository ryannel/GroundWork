import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, Search } from 'lucide-react'
import type { Api, ApiContract } from '@/data/spec'
import { useQuery } from '@/data/store'
import { componentScopeIds } from '@/data/component-structure'
import { contractKind, groupContracts, contractNotes, apiOperations, apiProvider } from '@/data/api-reference'
import { cn } from '@/lib/cn'
import { Prose } from '@/ui/inline-markdown'
import { useDisclosures } from './use-disclosures'
import { RefRow } from './refs'
import { useFocus, useSpec } from './context'
import { ResponseSchema } from './response-schema'
import { changeMeta } from './change-meta'

const kindLabel = { http: 'HTTP API', messages: 'Outgoing messages', other: 'Other API contracts' }
const factLabel = (label: string) => label === 'Auth' ? 'Authentication' : label === 'Query params' ? 'Query parameters' : label

export function ApiContractCard({ c, open, onToggle, focus, compact = false, grouped = false }: {
  c: ApiContract
  open: boolean
  onToggle: () => void
  focus?: string
  compact?: boolean
  grouped?: boolean
}) {
  const q = useQuery()
  const f = useFocus(c.id, compact ? undefined : focus)
  const message = contractKind(c) === 'messages'
  const distinctName = c.name !== `${c.method} ${c.path}` && c.name !== c.path
  const route = `${q.componentLabel(c.from)} → ${q.componentLabel(c.to)}`
  return <article ref={f} className={cn('api-contract', open && 'is-open', focus === c.id && !compact && 'focus-flash')}>
    <button
      aria-expanded={open}
      aria-label={`${c.method ?? 'Contract'} ${c.path} · ${q.componentLabel(c.from)} to ${q.componentLabel(c.to)}`}
      onClick={onToggle}
      className="api-contract-toggle"
    >
      <span className={`api-method method-${c.method?.toLowerCase() ?? 'other'}`}>{c.method ?? 'API'}</span>
      <span className="api-operation-label">
        {(!grouped || message) && <span className={cn('api-operation-name', c.change === 'removed' && 'line-through')}>
          {message ? c.name : <code>{c.path}</code>}
        </span>}
        {grouped && !message && distinctName && <span className="api-operation-name">{c.name}</span>}
        <span className="api-direction">{route}</span>
      </span>
      {c.change !== 'unspecified' && c.change !== 'unchanged' && <span className={`endpoint-status schema-state-${c.change}`}>{changeMeta[c.change].label}</span>}
      <ChevronDown size={14} className={cn(open && 'rotate-180')} />
    </button>
    {open && <ContractDetails c={c} compact={compact} />}
  </article>
}

function ContractDetails({ c, compact = false }: { c: ApiContract; compact?: boolean }) {
  const q = useQuery()
  const { ix, featureId } = useSpec()
  const edge = ix.contractEdge[c.id]
  const tests = ix.contractTests[c.id] ?? []
  const notes = contractNotes(c.note)
  const message = contractKind(c) === 'messages'
  const usage = message
    ? `Sent by ${q.componentLabel(c.from)} · Received by ${q.componentLabel(c.to)}`
    : `Provided by ${q.componentLabel(c.to)} · Called by ${q.componentLabel(c.from)}`
  return <div className="api-contract-body">
    <div className="api-detail-overview">
      {message && <code className="api-message-address">{c.path}</code>}
      {notes.description && <section className="api-behavior"><h4>Behavior</h4><Prose text={notes.description} /></section>}
      {!!notes.facts.length && <dl className="api-facts">
        {notes.facts.map((fact, i) => <div key={i}><dt>{factLabel(fact.label)}</dt><dd>{fact.value}</dd></div>)}
      </dl>}
      <p className="api-change-note">Change assessment: {changeMeta[c.change].label.toLowerCase()}.</p>
      {!!c.changes?.length && <ul className="api-changes">{c.changes.map((change, i) => <li key={i}>{change}</li>)}</ul>}
    </div>
    {c.request && <details className="api-request" open={message}>
      <summary>{message ? 'Message payload' : 'Request example'}</summary><pre>{c.request}</pre>
    </details>}
    {(!message || c.response || c.responseSchema) && <section className="api-response-section">
      {c.responseSchema
        ? <ResponseSchema schema={c.responseSchema} />
        : c.response
          ? <div className="api-example"><h4>Response example</h4><pre>{c.response}</pre></div>
          : <p className="api-schema-gap">Response fields have not been documented.</p>}
    </section>}
    {!compact && <details className="api-related">
      <summary>Usage, flow & tests{tests.length > 0 ? ` · ${tests.length} tests` : ''}</summary>
      <p className="api-usage-note">{usage}</p>
      <RefRow cols={1} className="api-connections" groups={[
        { label: 'Flow', refs: edge ? [{ kind: 'flow', id: ix.edge[edge].from }, { kind: 'flow', id: ix.edge[edge].to }] : [] },
        { label: 'Journey', refs: (ix.contractSteps[c.id] ?? []).map(id => ({ kind: 'journey', id })) },
        { label: 'Tests', refs: tests.map(id => ({ kind: 'tests', id })), warn: c.change === 'removed' ? undefined : 'No linked test' },
      ]} />
    </details>}
    <footer className="api-contract-footer">
      <Link to={`/f/${featureId}/api/${c.id}`}>Contract: {c.id}</Link>
      {c.note && <details><summary>Original contract notes</summary><div className="api-source-notes">{c.note}</div></details>}
    </footer>
  </div>
}

type Operation = ReturnType<typeof apiOperations>[number]
function OperationCard({ operation, open, onToggle, focus }: { operation: Operation; open: boolean; onToggle: () => void; focus?: string }) {
  const q = useQuery()
  const focused = operation.records.some(c => c.id === focus)
  const ref = useFocus(operation.key, focused ? operation.key : undefined)
  const changes = [...new Set(operation.records.flatMap(c => c.changes ?? []))]
  return <article ref={ref} className={cn('api-contract', open && 'is-open', focused && 'focus-flash')}>
    <button className="api-contract-toggle" aria-expanded={open} onClick={onToggle} aria-label={`${operation.method ?? 'Contract'} ${operation.path}`}>
      <span className={`api-method method-${operation.method?.toLowerCase() ?? 'other'}`}>{operation.method ?? 'API'}</span>
      <span className="api-operation-label">
        {operation.kind !== 'http' && <code className="api-operation-name">{operation.records[0].name}</code>}
        {changes.length > 0 && <span className="api-operation-change">{changes[0]}</span>}
      </span>
      {operation.change !== 'unspecified' && <span className={`endpoint-status schema-state-${operation.change}`}>
        {operation.change === 'mixed' ? 'Review assessments' : changeMeta[operation.change].label}
      </span>}
      <ChevronDown size={14} className={cn(open && 'rotate-180')} />
    </button>
    {open && <div>
      {operation.records.length === 1 ? <ContractDetails c={operation.records[0]} /> : <div className="api-usage-variants">
        <p>One operation, with {operation.records.length} documented access cases. Their authentication, fields, and examples are preserved below.</p>
        {operation.change === 'mixed' && <p>The source records disagree on change status. Review them before assigning one assessment to this operation.</p>}
        {operation.records.map(c => <details key={c.id} open={focus === c.id}>
          <summary>
            {operation.kind === 'messages' ? `Received by ${q.componentLabel(c.to)}` : `Access from ${q.componentLabel(c.from)}`}
            {c.name !== `${c.method} ${c.path}` && ` · ${c.name}`}
          </summary>
          <ContractDetails c={c} />
        </details>)}
      </div>}
    </div>}
  </article>
}

export function ApiSection({ data: full, focus }: { data: Api; focus?: string }) {
  const q = useQuery()
  const { featureId } = useSpec()
  const [params] = useSearchParams()
  const selected = q.component(params.get('component') ?? '')
  const allOperations = apiOperations(full.contracts)
  const hasHttp = (id: string) => Number(allOperations.some(op => op.provider === id && op.kind === 'http'))
  const componentIds = [...new Set([...allOperations.map(op => op.provider), ...(full.guides ?? []).map(g => g.componentId)])]
    .sort((a, b) => hasHttp(b) - hasHttp(a) || q.componentLabel(a).localeCompare(q.componentLabel(b)))
  const focusedContract = full.contracts.find(c => c.id === focus)
  const activeId = focusedContract ? apiProvider(focusedContract) : selected?.id ?? componentIds[0]
  const scope = activeId ? componentScopeIds(activeId, q.components()) : new Set<string>()
  const contracts = full.contracts.filter(c => scope.has(apiProvider(c)))
  const operations = apiOperations(contracts)
  const [view, setView] = useState({ focus, query: '', change: '' })
  if (view.focus !== focus) setView({ focus, query: '', change: '' })
  const { open, toggle, replace } = useDisclosures(focus ? [focus] : [], focus)
  const query = view.query.trim().toLowerCase()
  const matches = (op: Operation) => !query || op.records.some(c =>
    [c.name, c.path, c.id, c.note, ...(c.changes ?? []), q.componentLabel(op.provider)].join(' ').toLowerCase().includes(query))
  const visible = operations.filter(op => (!view.change || op.change === view.change) && matches(op))
  const providers = componentIds.filter(id => scope.has(id))
  const isOpen = (op: Operation) => op.records.some(c => open.has(c.id))
  const toggleOperation = (op: Operation) => {
    if (isOpen(op)) replace(new Set([...open].filter(id => !op.records.some(c => c.id === id))))
    else toggle(op.records[0].id)
  }
  return <div className="api-section api-by-provider">
    <nav className="api-component-guides" aria-label="Component APIs">
      {componentIds.map(id => <Link key={id} to={`/f/${featureId}/api?component=${encodeURIComponent(id)}`} aria-current={activeId === id ? 'page' : undefined}>
        {q.componentLabel(id)}
      </Link>)}
    </nav>
    {!providers.length && <p className="api-empty">No component APIs have been documented for this feature yet.</p>}
    {providers.map(provider => {
      const provided = visible.filter(op => op.provider === provider)
      const guide = full.guides?.find(g => g.componentId === provider)
      return <section className="api-provider" key={provider}>
        <header className="api-provider-heading"><h3>{q.componentLabel(provider)} API</h3><p>{q.component(provider)?.description}</p>
          {guide && <details className="api-component-about">
            <summary>About {q.componentLabel(provider)} and this feature</summary>
            <Prose text={guide.overview} />
            <h4>What this feature requires</h4>
            <Prose text={guide.featureImpact} />
          </details>}
        </header>
        <div className="api-toolbar">
          <label className="api-search"><Search size={15} />
            <input type="search" aria-label="Search component APIs" placeholder="Find an endpoint or message…" value={view.query}
              onChange={e => setView({ ...view, query: e.target.value })} />
          </label>
          <label>Change<select aria-label="Filter API changes" value={view.change} onChange={e => setView({ ...view, change: e.target.value })}>
            <option value="">All changes</option>
            {Object.entries(changeMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
            <option value="mixed">Review assessments</option>
          </select></label>
        </div>
        <div className="api-section-summary">
          <span role="status">{provided.length} operations & messages</span>
          <button disabled={!operations.some(isOpen)} onClick={() => replace(new Set())}>Collapse details</button>
        </div>
        {!provided.length && <div className="api-empty">
          <h3>No matching API definitions</h3>
          <p>Try another component, change status, or search.</p>
          <button onClick={() => setView({ ...view, query: '', change: '' })}>Clear filters</button>
        </div>}
        {(['http', 'messages', 'other'] as const).map(kind => {
          const surface = provided.filter(op => op.kind === kind)
          if (!surface.length) return null
          // Assign whole endpoints, not individual methods, to their first matching guide.
          // Unlinked endpoints retain a resource group, so incomplete guides hide nothing.
          const endpoints = groupContracts(surface.flatMap(op => op.records))
            .flatMap(resource => resource.endpoints.map(endpoint => ({ ...endpoint, resource: resource.name })))
          const groups = new Map<string, { title: string; description?: string; endpoints: typeof endpoints }>()
          for (const endpoint of endpoints) {
            const capability = guide?.capabilities.find(cap => endpoint.contracts.some(c => cap.contractIds.includes(c.id)))
            const key = capability ? `guide:${capability.id}` : `resource:${endpoint.resource}`
            const group = groups.get(key) ?? { title: capability?.title ?? endpoint.resource, description: capability?.description, endpoints: [] }
            group.endpoints.push(endpoint)
            groups.set(key, group)
          }
          return <section key={kind} className="api-provider-surface" aria-label={kindLabel[kind]}>
            {kind !== 'http' && <header>
              <h4>{kindLabel[kind]}</h4>
              {kind === 'messages' && <p className="api-assessment-note">Messages this component sends. Receiving components and usage are documented in the details.</p>}
            </header>}
            {[...groups].map(([key, group]) => <section key={key} className="api-resource">
              <header><h4>{group.title}</h4>{group.description && <div className="api-resource-context"><Prose text={group.description} /></div>}</header>
              {group.endpoints.map(endpoint => <div className="api-endpoint-group" key={endpoint.path}>
                <h5 className="api-endpoint-path"><code>{endpoint.path}</code></h5>
                {apiOperations(endpoint.contracts).map(op => <OperationCard key={op.key} operation={op} open={isOpen(op)} onToggle={() => toggleOperation(op)} focus={focus} />)}
              </div>)}
            </section>)}
          </section>
        })}
      </section>
    })}
  </div>
}
