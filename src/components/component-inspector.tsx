import { useId, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { sourceEvidenceUrl } from '@/data/execution-flow'
import { ArrowRight, Boxes, ChevronDown, ChevronRight, Cloud, Database, ExternalLink, GitBranch, Network, Radio } from 'lucide-react'
import type { Component } from '@/data/model'
import { componentKind, componentKindLabel } from '@/data/component-structure'
import { componentCoverage, catalogKnowledgeState, scanStatusLabel } from '@/data/catalog-coverage'
import { CatalogBrowser } from './catalog-browser'
import { ExecutionFlowExplorer, type FlowCatalogTarget } from './execution-flow'
import { catalogVersions, endpointGroup } from '@/data/catalog-navigation'

type ApiCatalog = NonNullable<Component['api']>
type ApiEndpoint = ApiCatalog['endpoints'][number]
type ApiType = NonNullable<ApiCatalog['schemas']>[number]

function referencedSchemas(type: string, schemas: Map<string, ApiType>) {
  const names = type.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []
  return [...new Set(names)].flatMap(name => {
    const schema = schemas.get(name)
    return schema ? [schema] : []
  })
}

function SchemaExplorer({ type, schemas }: { type?: string; schemas: Map<string, ApiType> }) {
  const roots = type ? referencedSchemas(type, schemas) : []
  const [trail, setTrail] = useState<ApiType[]>(roots.slice(0, 1))
  const current = trail.at(-1)
  const openSchema = (schema: ApiType) => {
    const existing = trail.findIndex(item => item.id === schema.id)
    setTrail(existing >= 0 ? trail.slice(0, existing + 1) : [...trail, schema])
  }

  if (!type) return <div className="schema-browser-empty">No payload is documented for this endpoint.</div>
  if (!current) return <div className="schema-browser-empty"><code>{type}</code><span>No structured fields were extracted for this type.</span></div>

  return <div className="schema-browser">
    {(trail.length > 1 || roots.length > 1) && <header className="schema-browser-context">
      {trail.length > 1 && <nav aria-label="Schema path">{trail.map((schema, index) => <span key={schema.id}>{index > 0 && <ChevronRight size={11} />}<button onClick={() => setTrail(trail.slice(0, index + 1))} aria-current={index === trail.length - 1 ? 'page' : undefined}>{schema.name}</button></span>)}</nav>}
      {roots.length > 1 && <div className="schema-root-switch" aria-label="Payload models">{roots.map(schema => <button key={schema.id} aria-pressed={current.id === schema.id} onClick={() => setTrail([schema])}>{schema.name}</button>)}</div>}
    </header>}
    <article className="schema-browser-model">
      <header>
        <div><strong>{current.name}</strong><span>{current.kind}{current.base ? ` · extends ${current.base}` : ''}</span></div>
        {current.sourceUrl && <a href={current.sourceUrl} target="_blank" rel="noreferrer" title={current.source ?? current.name}>View source<ExternalLink size={11} /></a>}
      </header>
      {current.description && <p>{current.description}</p>}
      {current.fields.length ? <div className="schema-browser-fields" role="table" aria-label={`${current.name} fields`}>
        <div role="row" className="schema-browser-field-head"><span role="columnheader">Field</span><span role="columnheader">Type</span><span role="columnheader">Requirement</span></div>
        {current.fields.map(field => {
          const references = referencedSchemas(field.type, schemas)
          return <div role="row" className="schema-browser-field" key={field.name}>
            <span role="cell"><strong>{field.name}</strong>{field.description && <small>{field.description}</small>}</span>
            <span role="cell">{references.length ? <button className="schema-type-link" onClick={() => openSchema(references[0])}><code>{field.type}</code><ArrowRight size={11} /></button> : <code>{field.type}</code>}</span>
            <span role="cell" className={field.required ? 'is-required' : ''}>{field.required ? 'Required' : 'Optional'}</span>
          </div>
        })}</div> : <div className="schema-browser-no-fields">No fields were extracted for this {current.kind}.</div>}
    </article>
  </div>
}

function EndpointDetail({ endpoint, component, schemas, flowContent, flowOpen, onFlowOpenChange }: { component: Component; endpoint: ApiEndpoint; schemas: Map<string, ApiType>; flowContent?: ReactNode; flowOpen: boolean; onFlowOpenChange: (open: boolean) => void }) {
  const payloadId = useId()
  const [payload, setPayload] = useState<'request' | 'response'>(endpoint.request ? 'request' : endpoint.response ? 'response' : 'request')
  const views = ['request', 'response', 'flow']
  const view = flowOpen ? 'flow' : payload
  const source = endpoint.evidence?.[0] ?? (endpoint.source && component.sourceRevision ? { path: endpoint.source, revision: component.sourceRevision, lines: '1', claim: '' } : undefined)
  const sourceUrl = source && sourceEvidenceUrl(component.repo, source)
  const selectView = (next: string) => { onFlowOpenChange(next === 'flow'); if (next !== 'flow') setPayload(next as 'request' | 'response') }
  return <article className="endpoint-reference">
    <div className="endpoint-context">
    <header className="endpoint-reference-heading">
      <div className="endpoint-reference-title"><span className={`component-api-method method-${endpoint.method.toLowerCase()}`}>{endpoint.method}</span><div><h5>{endpoint.name}</h5><code>{endpoint.path}</code></div></div>
      {endpoint.version && <span className="component-endpoint-version">{endpoint.version}</span>}
    </header>
    {endpoint.summary && <p className="endpoint-reference-summary">{endpoint.summary}</p>}
    <div className="payload-tabs" role="tablist" aria-label="Endpoint details" onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const index = views.indexOf(view)
      const next = views[event.key === 'Home' ? 0 : event.key === 'End' ? views.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + views.length) % views.length]
      selectView(next)
      event.currentTarget.querySelector<HTMLButtonElement>(`[data-payload="${next}"]`)?.focus()
    }}>
      {views.map(item => <button key={item} id={`${payloadId}-${item}`} data-payload={item} role="tab" tabIndex={view === item ? 0 : -1} aria-controls={`${payloadId}-panel-${item}`} aria-selected={view === item} onClick={() => selectView(item)}>{item === 'request' ? 'Request' : item === 'response' ? 'Response' : 'Data flow'}</button>)}
    </div>
    </div>
    {(['request', 'response'] as const).map(item => <div key={item} hidden={view !== item} id={`${payloadId}-panel-${item}`} role="tabpanel" aria-labelledby={`${payloadId}-${item}`}><SchemaExplorer key={`${endpoint.id}-${item}`} type={item === 'request' ? endpoint.request : endpoint.response} schemas={schemas} /></div>)}
    {<div hidden={view !== 'flow'} className="endpoint-execution" id={`${payloadId}-panel-flow`} role="tabpanel" aria-labelledby={`${payloadId}-flow`}>{flowContent ?? <div className="schema-browser-empty"><strong>Data flow not investigated yet</strong><span>The contract is catalogued. Its implementation path and external calls have not been traced.</span><span>{endpoint.source ? 'Start at the endpoint source below, then inspect the relevant helpers, configuration and tests.' : 'Locate the handler in the component repository to begin a focused investigation.'}</span></div>}</div>}
    {endpoint.source && <footer className="component-endpoint-source"><span>Endpoint source</span><code>{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer">{endpoint.source}<ExternalLink size={12} /></a> : endpoint.source}</code></footer>}
  </article>
}

function SourceEvidence({ evidence, repository }: { evidence?: Component['evidence']; repository?: string }) {
  if (!evidence?.length) return null
  return <details className="catalog-notes"><summary>Source evidence · {evidence.length}<ChevronDown size={14} /></summary><div>{evidence.map((source, index) => <article key={index}><strong>{sourceEvidenceUrl(repository, source) ? <a href={sourceEvidenceUrl(repository, source)} target="_blank" rel="noreferrer">{source.path}:{source.lines}<ExternalLink size={12} /></a> : `${source.path}:${source.lines}`}</strong><p>{source.claim}</p><code>Revision {source.revision}</code></article>)}</div></details>
}

function CatalogGaps({ gaps }: { gaps?: string[] }) {
  if (!gaps?.length) return null
  return <details className="catalog-notes"><summary>Known limitations · {gaps.length}<ChevronDown size={14} /></summary><div>{gaps.map((gap, index) => <p key={index}>{gap}</p>)}</div></details>
}

function RecordFields({ fields }: { fields: ApiType['fields'] }) {
  return fields.length ? <div className="schema-browser-fields" role="table" aria-label="Record fields">
    <div className="schema-browser-field-head" role="row"><span role="columnheader">Field</span><span role="columnheader">Type</span><span role="columnheader">Requirement</span></div>
    {fields.map(field => <div className="schema-browser-field" role="row" key={field.name}><span role="cell"><strong>{field.name}</strong>{field.description && <small>{field.description}</small>}</span><span role="cell"><code>{field.type}</code></span><span role="cell" className={field.required ? 'is-required' : ''}>{field.required ? 'Required' : 'Optional'}</span></div>)}
  </div> : <p className="component-data-gap">The contract is documented, but its field structure has not been extracted.</p>
}

function DataCatalog({ component, compact = false, initialSelectedId }: { component: Component; compact?: boolean; initialSelectedId?: string }) {
  const data = component.data
  if (!data) return <p className="component-data-gap">No data schema has been observed.</p>
  return <div className={`catalog-data${compact ? ' is-compact' : ''}`}>
    <div className="catalog-context">{data.technology && <span>{data.technology}</span>}{data.access?.map(mode => <span key={mode}>{mode}</span>)}</div>
    <CatalogBrowser key={initialSelectedId} initialSelectedId={initialSelectedId} urlKey={compact ? undefined : "data"} label="Data records" groupLabel="Kinds" entries={data.records.map(record => ({ id: record.id, name: record.name, group: record.kind, detail: `${record.fields.length} fields`, search: [record.keyPattern, record.description, ...record.fields.map(field => `${field.name} ${field.type} ${field.description ?? ''}`)].join(' ') }))} renderDetail={id => {
      const record = data.records.find(record => record.id === id)!
      return <article className="catalog-record-detail"><header><span>{record.kind}</span><h4>{record.name}</h4></header>{record.description && <p>{record.description}</p>}<dl><div><dt>Key / location</dt><dd><code>{record.keyPattern ?? 'Not documented'}</code></dd></div><div><dt>Retention</dt><dd>{record.ttl ?? 'Not documented'}</dd></div></dl><RecordFields fields={record.fields} /><SourceEvidence repository={component.repo} evidence={record.evidence} /></article>
    }} />
    <CatalogGaps gaps={data.gaps} />
  </div>
}

function MessagingCatalog({ component, initialSelectedId, renderFlows }: { component: Component; initialSelectedId?: string; renderFlows: (id: string) => ReactNode }) {
  const [direction, setDirection] = useState('all')
  const messaging = component.messaging
  if (!messaging) return <p className="component-data-gap">No message contracts have been observed.</p>
  const messages = messaging.messages.filter(message => direction === 'all' || message.direction === direction)
  return <div className="catalog-messages">
    <p className="catalog-intro">Documented inbound and outbound contracts. A listed contract does not by itself confirm an active publisher or consumer; check its source evidence and known limitations.</p>
    <CatalogBrowser key={initialSelectedId} initialSelectedId={initialSelectedId} urlKey="messages" label="Messages" groupLabel="Brokers" total={messaging.messages.length} filtered={direction !== 'all'} onReset={() => setDirection('all')} filters={<label className="catalog-filter"><span>Direction</span><select value={direction} onChange={event => setDirection(event.target.value)}><option value="all">Both directions</option><option value="inbound">Inbound</option><option value="outbound">Outbound</option></select></label>} entries={messages.map(message => ({ id: message.id, name: message.name, group: message.broker, badge: message.direction, detail: message.channel, search: message.fields.map(field => `${field.name} ${field.type} ${field.description ?? ''}`).join(' ') }))} renderDetail={id => {
      const message = messaging.messages.find(message => message.id === id)!
      return <article className="catalog-record-detail"><header><span>{message.direction} · {message.broker}</span><h4>{message.name}</h4></header><dl><div><dt>Channel / topic</dt><dd><code>{message.channel}</code></dd></div><div><dt>Ordering</dt><dd>{message.delivery.ordering}</dd></div><div><dt>Retries</dt><dd>{message.delivery.retries}</dd></div><div><dt>Dead letter</dt><dd>{message.delivery.deadLetter}</dd></div></dl><RecordFields fields={message.fields} /><SourceEvidence repository={component.repo} evidence={message.evidence} />{renderFlows(message.id)}</article>
    }} />
    <CatalogGaps gaps={messaging.gaps} />
  </div>
}

function DependencyEntry({ dependency, showData = false, onSelect }: { dependency: Component; showData?: boolean; onSelect?: (id: string) => void }) {
  const kind = componentKind(dependency)
  const Icon = ['database', 'cache', 'object-storage', 'local-storage'].includes(kind) ? Database : kind === 'external-service' ? Cloud : kind === 'service' ? Boxes : Network
  const context = dependency.role === 'platform-service'
    ? `${dependency.ownership === 'third-party' ? 'External' : 'Internal'} platform`
    : dependency.role === 'external-provider'
      ? 'External provider'
      : dependency.ownership === 'third-party'
        ? 'External service'
        : dependency.kind === 'external-service'
          ? 'Internal service'
          : componentKindLabel(dependency)
  const content = <><span className="component-repository-icon"><Icon size={15} /></span><span><small>{context}</small><strong>{dependency.name}</strong></span>{showData && <ChevronDown size={13} />}</>
  return showData
    ? <details className="component-infrastructure-entry"><summary>{content}</summary><DataCatalog component={dependency} compact /></details>
    : <button className="component-dependency-entry" onClick={() => onSelect?.(dependency.id)}>{content}<ArrowRight size={13} /></button>
}

function DependencyGroup({ title, description, dependencies, showData = false, onSelect }: { title: string; description: string; dependencies: Component[]; showData?: boolean; onSelect?: (id: string) => void }) {
  if (!dependencies.length) return null
  return <section className="component-dependency-group"><header><div><h5>{title}</h5><p>{description}</p></div><span>{dependencies.length}</span></header><div>{dependencies.map(dependency => <DependencyEntry key={dependency.id} dependency={dependency} showData={showData} onSelect={onSelect} />)}</div></section>
}

function EndpointFlows({ component, endpoint, dependencies, onNavigate, onSelectComponent }: { component: Component; endpoint: ApiEndpoint; dependencies: Component[]; onNavigate: (target: FlowCatalogTarget) => void; onSelectComponent?: (id: string) => void }) {
  const flows = component.executionFlows!.filter(flow => flow.endpointId === endpoint.id)
  const [flowId, setFlowId] = useState(flows[0].id)
  const flow = flows.find(item => item.id === flowId) ?? flows[0]
  return <>{flows.length > 1 && <label className="catalog-filter"><span>Execution path</span><select value={flow.id} onChange={event => setFlowId(event.target.value)}>{flows.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}<ExecutionFlowExplorer key={flow.id} component={component} flow={flow} dependencies={dependencies} onNavigate={onNavigate} onSelectComponent={onSelectComponent} /></>
}

function ContextFlows({ component, flows, dependencies, onNavigate, onSelectComponent }: { component: Component; flows: NonNullable<Component['executionFlows']>; dependencies: Component[]; onNavigate: (target: FlowCatalogTarget) => void; onSelectComponent?: (id: string) => void }) {
  const [params, setParams] = useSearchParams()
  const flow = flows.find(item => item.id === params.get('flow')) ?? flows[0]
  if (!flow) return <p className="component-data-gap">Data flow not investigated yet. Start at the source evidence to inspect this entry point.</p>
  return <details className="catalog-notes" open={flows.some(item => item.id === params.get('flow')) || undefined}><summary>Data flow · {flows.length} recorded {flows.length === 1 ? 'path' : 'paths'}<ChevronDown size={14} /></summary><div>{flows.length > 1 && <label>Execution path<select value={flow.id} onChange={event => setParams(previous => { const next = new URLSearchParams(previous); next.set('flow', event.target.value); return next }, { preventScrollReset: true })}>{flows.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}<ExecutionFlowExplorer key={flow.id} component={component} flow={flow} dependencies={dependencies} onNavigate={onNavigate} onSelectComponent={onSelectComponent} /></div></details>
}

function readableList(items: string[]) {
  if (items.length < 2) return items[0] ?? ''
  if (items.length === 2) return items.join(' and ')
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`
}

function ComponentMentalModel({ component, dependencies }: { component: Component; dependencies: Component[] }) {
  const apiMethods = new Set(component.api?.endpoints.map(endpoint => endpoint.method))
  const entryPoints = [
    [...apiMethods].some(method => !['EVENT', 'RPC'].includes(method)) && 'HTTP interfaces',
    apiMethods.has('RPC') && 'RPC interfaces',
    apiMethods.has('EVENT') && 'event interfaces',
    component.messaging?.messages.some(message => message.direction === 'inbound') && 'inbound messages',
    !!component.jobs?.length && 'background jobs',
  ].filter((entry): entry is string => !!entry)
  const outboundMessages = component.messaging?.messages.filter(message => message.direction === 'outbound') ?? []
  const access = component.data?.access
  const state = component.data?.technology
    ? `${access?.length ? `${readableList(access)} access to ` : ''}${component.data.technology}`
    : component.data?.records.length
      ? 'catalogued records'
      : ''
  const boundary = dependencies.length ? readableList(dependencies.slice(0, 4).map(dependency => dependency.name)) : ''
  const flows = component.executionFlows ?? []

  return <div className="component-mental-model">
    <header>
      <span>Mental model</span>
      <h4>How to reason about {component.name}</h4>
      <p>This is an orientation from source-backed catalog records, not an observation of live runtime behavior.</p>
    </header>
    <div className="component-mental-model-grid">
      <article>
        <span>Work enters</span>
        <p>{entryPoints.length
          ? `Treat ${readableList(entryPoints)} as the component's known entry points. Start in Interfaces, Messages, or Jobs when you need the exact contract.`
          : 'No entry point has been established yet. The absence of a catalogued interface does not prove this component has no runtime trigger.'}</p>
      </article>
      <article>
        <span>Inside the boundary</span>
        <p>{state
          ? `The catalog shows ${state}. Use Data to understand the state this component reads or changes before following its external effects.`
          : 'No owned state has been established. Reason about this component primarily through its contracts and recorded execution paths.'}</p>
      </article>
      <article>
        <span>Work leaves</span>
        <p>{boundary || outboundMessages.length
          ? `${boundary ? `Mapped processing crosses into ${boundary}` : 'No component dependency is currently mapped'}${outboundMessages.length ? `${boundary ? ', and' : ', but'} the component also records outbound messages` : ''}. These are architectural boundaries; open a recorded path to see whether a particular call is synchronous or asynchronous.`
          : 'No outgoing component or message boundary is currently established. Check known limitations before treating this as an isolated component.'}</p>
      </article>
    </div>
    {!!flows.length && <section className="component-overview-flows">
      <header><div><span>Recorded runtime stories</span><h5>Concrete paths through the component</h5></div><strong>{flows.length}</strong></header>
      <div>{flows.slice(0, 4).map(flow => <article key={flow.id}><strong>{flow.name}</strong><p>{flow.summary}</p><small>{flow.transitions.some(transition => transition.mode === 'async') ? 'Includes asynchronous work' : 'Synchronous path'} · Source traced</small></article>)}</div>
      {flows.length > 4 && <p>{flows.length - 4} more recorded {flows.length - 4 === 1 ? 'path is' : 'paths are'} available from the relevant contract.</p>}
    </section>}
    {!!component.unresolvedDependencies?.length && <section className="component-overview-blind-spots">
      <span>Do not assume the map is complete</span>
      <p>{readableList(component.unresolvedDependencies.slice(0, 4).map(dependency => dependency.name))}{component.unresolvedDependencies.length > 4 ? ` and ${component.unresolvedDependencies.length - 4} more` : ''} {component.unresolvedDependencies.length === 1 ? 'is' : 'are'} referenced in source but not yet matched to a component. Review Catalog coverage below before making boundary decisions.</p>
    </section>}
  </div>
}

export function ComponentInspector({ component, dependencies, isLocal, showIdentity = true, onSelectComponent }: { component: Component; dependencies: Component[]; isLocal: boolean; showIdentity?: boolean; onSelectComponent?: (id: string) => void }) {
  const inspectorId = useId()
  const [params, setParams] = useSearchParams()
  const updateCatalog = (changes: Record<string, string>) => setParams(previous => { const next = new URLSearchParams(previous); for (const [key, value] of Object.entries(changes)) next.set(key, value); return next }, { preventScrollReset: true })
  const coverage = componentCoverage(component)
  const knowledge = catalogKnowledgeState(component)
  const api = component.api
  const retiredSelection = component.retiredObservations?.find(item => params.get(item.kind === 'data' ? 'dataEntity' : item.kind === 'message' ? 'messagesEntity' : item.kind === 'job' ? 'jobsEntity' : item.kind === 'flow' ? 'flow' : 'apiEntity') === item.id)
  const [catalogFocus, setCatalogFocus] = useState<string>()
  const [catalogNavigation, setCatalogNavigation] = useState(0)
  const flowOpen = params.get('apiView') === 'flow'
  const setFlowOpen = (open: boolean) => updateCatalog({ apiView: open ? 'flow' : 'payload' })
  const [flowOrigin, setFlowOrigin] = useState<{ tab: string; id: string; name: string; label: string }>()
  const versions = api ? catalogVersions(api) : []
  const [selectedVersion, setSelectedVersion] = useState('all')
  const [method, setMethod] = useState('all')
  const filteredEndpoints = api?.endpoints.filter(endpoint => (selectedVersion === 'all' || endpoint.version === selectedVersion) && (method === 'all' || endpoint.method === method)) ?? []
  const schemas = new Map((api?.schemas ?? []).map(schema => [schema.name, schema]))
  const datastores = dependencies.filter(dependency => ['database', 'cache', 'object-storage', 'local-storage'].includes(componentKind(dependency)))
  const brokers = dependencies.filter(dependency => componentKind(dependency) === 'queue')
  const tabs = [
    { id: 'overview', label: 'Overview', description: 'Responsibility & scope', count: null, area: null },
    { id: 'api', label: 'Interfaces', description: 'Endpoints & payloads', count: api?.endpoints.length ?? 0, area: 'api' },
    { id: 'data', label: 'Data', description: 'Records & storage', count: component.data?.records.length ?? 0, area: 'data' },
    { id: 'messages', label: 'Messages', description: 'Channels & delivery', count: component.messaging?.messages.length ?? 0, area: 'messaging' },
    ...(component.jobs?.length ? [{ id: 'jobs', label: 'Jobs', description: 'Background entry points', count: component.jobs.length, area: null }] as const : []),
  ] as const
  const requestedTab = params.get('catalog')
  const tab = tabs.some(item => item.id === requestedTab) ? requestedTab! : 'overview'
  const setTab = (tab: string) => updateCatalog({ catalog: tab })
  const navigateCatalog = (target: FlowCatalogTarget, endpoint: ApiEndpoint) => { updateCatalog({ catalog: target.tab, [`${target.tab}Entity`]: target.id, [`${target.tab}Query`]: '', [`${target.tab}Group`]: 'all' }); setCatalogFocus(target.id); setCatalogNavigation(current => current + 1); setFlowOrigin({ tab: 'api', id: endpoint.id, name: endpoint.name, label: `${endpoint.method} ${endpoint.path}` }) }
  const contextFlows = (kind: 'message' | 'job', id: string, name: string) => <ContextFlows component={component} flows={(component.executionFlows ?? []).filter(flow => flow.trigger?.kind === kind && (flow.trigger.kind === 'message' ? flow.trigger.messageId : flow.trigger.jobId) === id)} dependencies={dependencies} onSelectComponent={onSelectComponent} onNavigate={target => { updateCatalog({ catalog: target.tab, [`${target.tab}Entity`]: target.id }); setCatalogFocus(target.id); setCatalogNavigation(current => current + 1); setFlowOrigin({ tab: kind === 'message' ? 'messages' : 'jobs', id, name, label: name }) }} />
  const emptyCatalog = (area: 'api' | 'data' | 'messaging', label: string) => <div className="catalog-no-results"><h4>{coverage.area(area) === 'complete' ? `No ${label} found in the scan` : `${label[0].toUpperCase() + label.slice(1)} not yet catalogued`}</h4><p>{coverage.area(area) === 'complete' ? `The repository scan did not identify ${label} for ${component.name}.` : `This area has not been fully investigated for ${component.name}. Missing details do not mean the component has no ${label}.`}</p></div>
  const limitationCount = (component.unresolvedDependencies?.length ?? 0) + (component.gaps?.length ?? 0)
  return <section className="component-inspector" aria-label={`${component.name} catalog`}>
    {showIdentity && <header className="component-inspector-heading">
      <div className="component-inspector-identity">
        <div><span>Selected component</span><h3>{component.name}</h3></div>
        <div className="component-inspector-badges"><span>{componentKindLabel(component)}{isLocal ? '' : ' · Other product'}</span></div>
      </div>
      <div className="component-inspector-summary"><p>{component.description ?? 'No responsibility summary has been recorded.'}</p>{component.repo && <div className="component-inspector-repo"><GitBranch size={12} /><span>Source repository</span>{component.repo}{component.sourcePath && component.sourcePath !== '.' ? ` · ${component.sourcePath}` : ''}</div>}</div>
    </header>}

    {!!component.retiredObservations?.length && <details className="catalog-notes" open={!!retiredSelection || undefined}><summary>Retired catalog records · {component.retiredObservations.length}<ChevronDown size={14} /></summary><div>{(retiredSelection ? [retiredSelection] : component.retiredObservations).map(item => <article key={`${item.kind}/${item.id}`}><h4>{String(item.observation.name ?? item.id)} · Retired {item.kind}</h4><p>{item.reason}</p><p>Retired at {item.sourceRevision.slice(0, 8)}. Original facts and citations are preserved below.</p><SourceEvidence repository={component.repo} evidence={item.evidence} /><details><summary>Original observation</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(item.observation, null, 2)}</pre></details></article>)}{retiredSelection && <button onClick={() => setParams(previous => { const next = new URLSearchParams(previous); for (const key of ['apiEntity', 'dataEntity', 'messagesEntity', 'jobsEntity', 'flow']) next.delete(key); return next }, { preventScrollReset: true })}>Browse active records</button>}</div></details>}

    {!!component.findings?.length && <details className="catalog-notes" open={!!params.get('finding')}><summary>Investigated questions · {component.findings.length}<ChevronDown size={14} /></summary><div>{component.findings.filter(finding => !params.get('finding') || finding.id === params.get('finding')).map(finding => <article key={finding.id}><h4>{finding.name}</h4><p>{finding.question}</p><p>{finding.answer}</p><p><strong>Boundary:</strong> {finding.boundary}</p><p>Observed at {finding.sourceRevision.slice(0, 8)} · Freshness unchecked</p>{finding.assumptions.map((assumption, index) => <p key={index}>Unresolved: {assumption}</p>)}<SourceEvidence repository={finding.repository} evidence={finding.evidence} /></article>)}</div></details>}

    <div className="component-inspector-tabs catalog-tabs" role="tablist" aria-label={`${component.name} detail`} onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const index = tabs.findIndex(item => item.id === tab)
      const next = tabs[event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length].id
      setTab(next)
      setFlowOrigin(undefined)
      event.currentTarget.querySelector<HTMLButtonElement>(`[data-detail-tab="${next}"]`)?.focus()
    }}>
      {tabs.map(item => {
        const count = item.id === 'overview' ? null : (item.count > 0 || (item.area && coverage.area(item.area) === 'complete') ? item.count : '—')
        return <button key={item.id} id={`${inspectorId}-${item.id}`} data-detail-tab={item.id} role="tab" tabIndex={tab === item.id ? 0 : -1} aria-controls={`${inspectorId}-panel-${item.id}`} aria-selected={tab === item.id} aria-label={count === null ? item.label : `${item.label}: ${count === '—' ? 'not yet established' : `${count} catalogued`}`} onClick={() => { setTab(item.id); setFlowOrigin(undefined) }}><strong>{item.label}</strong>{count !== null && <b>{count}</b>}</button>
      })}
    </div>

    {flowOrigin && tab !== flowOrigin.tab && <div className="execution-return-context"><span>Opened from the data flow for <strong>{flowOrigin.name}</strong></span><button className="execution-return" onClick={() => updateCatalog({ catalog: flowOrigin.tab, [`${flowOrigin.tab}Entity`]: flowOrigin.id })}>Back to {flowOrigin.label} · Data flow<ArrowRight size={14} /></button></div>}
    <section hidden={tab !== 'overview' || !!retiredSelection} id={`${inspectorId}-panel-overview`} role="tabpanel" className="component-overview-panel" aria-labelledby={`${inspectorId}-overview`}>
      <ComponentMentalModel component={component} dependencies={dependencies} />
    </section>
    <section hidden={tab !== 'api' || !!retiredSelection} id={`${inspectorId}-panel-api`} role="tabpanel" className="catalog-panel catalog-api-panel" aria-labelledby={`${inspectorId}-api`}>
      {params.get('schema') && api?.schemas?.some(schema => schema.id === params.get('schema')) && <section className="catalog-linked-schema"><button onClick={() => setParams(previous => { const next = new URLSearchParams(previous); next.delete('schema'); return next }, { preventScrollReset: true })}>Back to interfaces</button><SchemaExplorer key={params.get('schema')} type={api.schemas.find(schema => schema.id === params.get('schema'))!.name} schemas={schemas} /></section>}
      {api?.endpoints.length ? <>
        <div className="catalog-panel-heading"><div><h4>Interface catalog</h4><p>{api.schemas?.length ?? 0} schema types{api.sourceRevision ? ` · Revision ${api.sourceRevision.slice(0, 8)}` : ''}</p></div>{api.specification && <a href={api.specification.url} target="_blank" rel="noreferrer">{api.specification.title}<ExternalLink size={13} /></a>}</div>
        <CatalogBrowser urlKey="api" label="Interfaces" groupLabel="Resources" total={api.endpoints.length} filtered={selectedVersion !== 'all' || method !== 'all'} onReset={() => { setSelectedVersion('all'); setMethod('all') }} filters={<><label className="catalog-filter"><span>Method</span><select value={method} onChange={event => setMethod(event.target.value)}><option value="all">All methods</option>{[...new Set(api.endpoints.map(endpoint => endpoint.method))].map(value => <option key={value}>{value}</option>)}</select></label>{versions.length > 0 && <label className="catalog-filter"><span>Version</span><select value={selectedVersion} onChange={event => setSelectedVersion(event.target.value)}><option value="all">All versions</option>{versions.map(version => <option key={version.id} value={version.id}>{version.label}</option>)}</select></label>}</>} entries={filteredEndpoints.map(endpoint => ({ id: endpoint.id, name: endpoint.name, group: endpointGroup(endpoint), detail: endpoint.path, badge: endpoint.method, annotation: component.executionFlows?.some(flow => flow.endpointId === endpoint.id) ? 'Data flow traced' : undefined, search: [endpoint.summary, endpoint.request, endpoint.response, endpoint.version, endpoint.source, ...[endpoint.request, endpoint.response].flatMap(type => type ? referencedSchemas(type, schemas).flatMap(schema => schema.fields.map(field => `${field.name} ${field.type}`)) : [])].join(' ') }))} renderDetail={id => {
          const endpoint = api.endpoints.find(endpoint => endpoint.id === id)!
          const flows = component.executionFlows?.filter(flow => flow.endpointId === id) ?? []
          return <><EndpointDetail key={id} endpoint={endpoint} component={component} schemas={schemas} flowOpen={flowOpen} onFlowOpenChange={open => { setFlowOpen(open); setFlowOrigin(undefined) }} flowContent={flows.length ? <EndpointFlows component={component} endpoint={endpoint} dependencies={dependencies} onNavigate={target => navigateCatalog(target, endpoint)} onSelectComponent={onSelectComponent} /> : undefined} /><SourceEvidence repository={component.repo} evidence={endpoint.evidence} /></>
        }} />
      </> : emptyCatalog('api', 'interfaces')}
    </section>
    <section hidden={tab !== 'data' || !!retiredSelection} id={`${inspectorId}-panel-data`} role="tabpanel" className="catalog-panel" aria-labelledby={`${inspectorId}-data`}>
      <div className="catalog-panel-heading"><div><h4><Database size={16} />Stored data</h4><p>Explore records, cache keys and documents owned by this component.</p></div></div>
      {component.data?.records.length ? <DataCatalog key={catalogNavigation} component={component} initialSelectedId={catalogFocus} /> : emptyCatalog('data', 'data records')}
      {!!datastores.length && <details className="catalog-notes"><summary>Linked datastores · {datastores.length}<ChevronDown size={14} /></summary><DependencyGroup title="Datastores" description="Mapped storage dependencies." dependencies={datastores} showData /></details>}
    </section>
    <section hidden={tab !== 'messages' || !!retiredSelection} id={`${inspectorId}-panel-messages`} role="tabpanel" className="catalog-panel" aria-labelledby={`${inspectorId}-messages`}>
      <div className="catalog-panel-heading"><div><h4><Radio size={16} />Message contracts</h4><p>Explore inbound and outbound messages by broker, topic or field.</p></div></div>
      {component.messaging?.messages.length ? <MessagingCatalog key={catalogNavigation} component={component} initialSelectedId={catalogFocus} renderFlows={id => contextFlows('message', id, component.messaging!.messages.find(message => message.id === id)!.name)} /> : emptyCatalog('messaging', 'message contracts')}
      {!!brokers.length && <details className="catalog-notes"><summary>Linked messaging infrastructure · {brokers.length}<ChevronDown size={14} /></summary><DependencyGroup title="Messaging infrastructure" description="Mapped broker dependencies." dependencies={brokers} showData /></details>}
    </section>

    {!!component.jobs?.length && <section hidden={tab !== 'jobs' || !!retiredSelection} id={`${inspectorId}-panel-jobs`} role="tabpanel" className="catalog-panel" aria-labelledby={`${inspectorId}-jobs`}><h4>Background jobs</h4><CatalogBrowser urlKey="jobs" label="Jobs" groupLabel="Schedule" entries={component.jobs.map(job => ({ id: job.id, name: job.name, group: job.schedule ?? 'Schedule not documented', detail: job.description, search: job.source ?? '' }))} renderDetail={id => { const job = component.jobs!.find(job => job.id === id)!; return <article className="catalog-record-detail"><header><h4>{job.name}</h4><p>{job.description}</p><p>{job.schedule ?? 'Schedule not documented'}</p></header><SourceEvidence repository={component.repo} evidence={job.evidence} />{contextFlows('job', job.id, job.name)}</article> }} /></section>}

    <details className="catalog-notes catalog-scan-notes">
      <summary><span>Catalog coverage<small>{scanStatusLabel(coverage.status)}{limitationCount ? ` · ${limitationCount} known ${limitationCount === 1 ? 'limitation' : 'limitations'}` : ''}</small></span><ChevronDown size={16} /></summary>
      <div className="catalog-health-detail">
        <section className="catalog-health-overview">
          <div className="component-scan-coverage" aria-label="Repository scan coverage">{(['dependencies', 'api', 'data', 'messaging'] as const).map(area => <span key={area} className={`is-${coverage.area(area)}`}>{area === 'api' ? 'API' : area}<i>{coverage.area(area) === 'complete' ? 'complete' : coverage.area(area) === 'partial' ? 'partial' : 'unknown'}</i></span>)}</div>
          <p>{knowledge.investigation.tracedEndpoints} of {knowledge.investigation.knownEndpoints} endpoint paths investigated · Freshness unchecked</p>
        </section>
        {!!limitationCount && <div className="catalog-findings">
          {!!component.unresolvedDependencies?.length && <section><h4>Dependencies awaiting a catalog match</h4><p>These references are recorded in source but are not linked to components in the map.</p>{component.unresolvedDependencies.map((dependency, index) => <article key={index}><strong>{dependency.name}</strong><p>{[dependency.kind, dependency.transport].filter(Boolean).join(' · ')}</p><SourceEvidence repository={component.repo} evidence={dependency.evidence} /></article>)}</section>}
          {!!component.gaps?.length && <section><h4>Known scan gaps</h4>{component.gaps.map((gap, index) => <article key={index}><strong>{gap.area}</strong><p>{gap.reason}</p></article>)}</section>}
        </div>}
      </div>
    </details>
  </section>
}
