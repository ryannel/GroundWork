import { useState } from 'react'
import { ArrowRight, Boxes, ChevronDown, ChevronRight, Cloud, Database, ExternalLink, GitBranch, Network, Radio } from 'lucide-react'
import type { Component } from '@/data/model'
import { componentKind, componentKindLabel } from '@/data/component-structure'

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

function EndpointDetail({ endpoint, schemas }: { endpoint: ApiEndpoint; schemas: Map<string, ApiType> }) {
  const [payload, setPayload] = useState<'request' | 'response'>('request')
  const type = payload === 'request' ? endpoint.request : endpoint.response
  return <article className="endpoint-reference">
    <header className="endpoint-reference-heading">
      <div className="endpoint-reference-title"><span className={`component-api-method method-${endpoint.method.toLowerCase()}`}>{endpoint.method}</span><div><h5>{endpoint.name}</h5><code>{endpoint.path}</code></div></div>
      {endpoint.version && <span className="component-endpoint-version">{endpoint.version}</span>}
    </header>
    {endpoint.summary && <p className="endpoint-reference-summary">{endpoint.summary}</p>}
    <div className="payload-tabs" role="tablist" aria-label="Payload structure">
      <button role="tab" aria-selected={payload === 'request'} onClick={() => setPayload('request')}>Request</button>
      <button role="tab" aria-selected={payload === 'response'} onClick={() => setPayload('response')}>Response</button>
    </div>
    <SchemaExplorer key={`${endpoint.id}-${payload}`} type={type} schemas={schemas} />
    {endpoint.source && <footer className="component-endpoint-source"><span>Endpoint source</span><code>{endpoint.source}</code></footer>}
  </article>
}

function DataCatalog({ component, compact = false }: { component: Component; compact?: boolean }) {
  const data = component.data
  if (!data) return <p className="component-data-gap">No data schema has been observed.</p>
  return <div className={`component-data-catalog${compact ? ' is-compact' : ''}`}>
    <div className="component-data-meta">
      {data.technology && <span>{data.technology}</span>}
      {data.access?.map(mode => <span key={mode}>{mode}</span>)}
    </div>
    {data.records.map(record => <details key={record.id}>
      <summary><span><strong>{record.name}</strong><small>{record.kind}{record.keyPattern ? ` · ${record.keyPattern}` : ''}</small></span><span>{record.fields.length} fields</span><ChevronDown size={13} /></summary>
      <div className="component-data-record">
        {record.description && <p>{record.description}</p>}
        {record.ttl && <div className="component-data-fact"><strong>Retention</strong><span>{record.ttl}</span></div>}
        {record.fields.length ? <div className="schema-browser-fields">
          <div className="schema-browser-field-head"><span>Field</span><span>Type</span><span>Requirement</span></div>
          {record.fields.map(field => <div className="schema-browser-field" key={field.name}><span><strong>{field.name}</strong>{field.description && <small>{field.description}</small>}</span><code>{field.type}</code><span className={field.required ? 'is-required' : ''}>{field.required ? 'Required' : 'Optional'}</span></div>)}
        </div> : <div className="component-data-gap">The record is observed, but its field structure has not been extracted.</div>}
        {record.evidence?.length ? <div className="component-data-evidence">{record.evidence.length} source {record.evidence.length === 1 ? 'reference' : 'references'}</div> : null}
      </div>
    </details>)}
    {data.gaps?.length ? <div className="component-catalog-gaps"><strong>Known gaps</strong>{data.gaps.map(gap => <p key={gap}>{gap}</p>)}</div> : null}
  </div>
}

function MessagingCatalog({ component }: { component: Component }) {
  const messaging = component.messaging
  if (!messaging) return <p className="component-data-gap">No message contracts have been observed.</p>
  return <div className="component-messaging-catalog">
    {messaging.messages.map(message => <details key={message.id}>
      <summary>
        <span className={`message-direction is-${message.direction}`}>{message.direction}</span>
        <span><strong>{message.name}</strong><small>{message.broker} · {message.channel}</small></span>
        <span>{message.fields.length} {message.fields.length === 1 ? 'field' : 'fields'}</span>
        <ChevronDown size={13} />
      </summary>
      <div className="component-message-detail">
        <dl><div><dt>Ordering</dt><dd>{message.delivery.ordering}</dd></div><div><dt>Retries</dt><dd>{message.delivery.retries}</dd></div><div><dt>Dead letter</dt><dd>{message.delivery.deadLetter}</dd></div></dl>
        {message.fields.length ? <div className="schema-browser-fields">
          <div className="schema-browser-field-head"><span>Field</span><span>Type</span><span>Requirement</span></div>
          {message.fields.map(field => <div className="schema-browser-field" key={field.name}><span><strong>{field.name}</strong>{field.description && <small>{field.description}</small>}</span><code>{field.type}</code><span className={field.required ? 'is-required' : ''}>{field.required ? 'Required' : 'Optional'}</span></div>)}
        </div> : null}
      </div>
    </details>)}
    {messaging.gaps?.length ? <div className="component-catalog-gaps"><strong>Known gaps</strong>{messaging.gaps.map(gap => <p key={gap}>{gap}</p>)}</div> : null}
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

export function ComponentInspector({ component, dependencies, isLocal }: { component: Component; dependencies: Component[]; isLocal: boolean }) {
  const api = component.api
  const versions = api?.versions ?? (api?.version ? [{ id: api.version, label: api.version }] : [])
  const [selectedVersion, setSelectedVersion] = useState(versions.at(-1)?.id ?? 'all')
  const filteredEndpoints = api?.endpoints.filter(endpoint => selectedVersion === 'all' || endpoint.version === selectedVersion) ?? []
  const [selectedEndpointId, setSelectedEndpointId] = useState(filteredEndpoints[0]?.id ?? '')
  const selectedEndpoint = filteredEndpoints.find(endpoint => endpoint.id === selectedEndpointId) ?? filteredEndpoints[0]
  const schemas = new Map((api?.schemas ?? []).map(schema => [schema.name, schema]))
  const datastoreKinds = new Set(['database', 'cache', 'object-storage', 'local-storage'])
  const datastores = dependencies.filter(dependency => datastoreKinds.has(componentKind(dependency)))
  const messaging = dependencies.filter(dependency => componentKind(dependency) === 'queue')
  const hasApi = Boolean(api)
  const hasData = Boolean(component.data)
  const hasDataAndEvents = hasData || Boolean(component.messaging) || datastores.length > 0 || messaging.length > 0
  const dataCount = (component.data?.records.length ?? 0) + (component.messaging?.messages.length ?? 0) + datastores.length + messaging.length
  const [tab, setTab] = useState<'api' | 'data'>(hasApi ? 'api' : 'data')
  return <section className="component-inspector" aria-labelledby="component-inspector-heading">
    <header className="component-inspector-heading">
      <div className="component-inspector-identity">
        <div><span>Selected component</span><h3 id="component-inspector-heading">{component.name}</h3></div>
        <span>{componentKindLabel(component)}{isLocal ? '' : ' · Other product'}</span>
      </div>
      <div className="component-inspector-summary">{component.description ? <p>{component.description}</p> : <p>No responsibility summary has been recorded.</p>}{component.repo && <div className="component-inspector-repo"><GitBranch size={12} />{component.repo}</div>}</div>
    </header>

    <div className="component-inspector-tabs" role="tablist" aria-label={`${component.name} detail`}>
      <button role="tab" aria-selected={tab === 'api'} onClick={() => setTab('api')}>
        <span><strong>API & interfaces</strong><small>Explore endpoints, payloads, and source definitions</small></span>
        <b>{api?.endpoints.length ?? 0}</b>
      </button>
      <button role="tab" aria-selected={tab === 'data'} onClick={() => setTab('data')}>
        <span><strong>Data & events</strong><small>Inspect stored records, messages, and delivery behavior</small></span>
        <b>{dataCount}</b>
      </button>
    </div>

    {tab === 'api' && <section className="component-api-catalog is-full" aria-labelledby="component-api-heading">
        <header>
          <div><span>Interface catalog</span><h4 id="component-api-heading">{api?.name ?? 'No interface catalog imported'}</h4></div>
          {api && versions.length > 0 && <label className="component-version-picker"><span>Version</span><select value={selectedVersion} onChange={event => setSelectedVersion(event.target.value)}><option value="all">All versions</option>{versions.map(version => <option key={version.id} value={version.id}>{version.label}</option>)}</select></label>}
        </header>
        {api ? <>
          <div className="component-api-meta">
            <span><strong>{filteredEndpoints.length}</strong> {selectedVersion === 'all' ? 'endpoints' : `${selectedVersion} endpoints`}</span>
            <span><strong>{api.schemas?.length ?? 0}</strong> schema types</span>
            {api.sourceRevision && <span title={api.sourceRevision}>Revision {api.sourceRevision.slice(0, 8)}</span>}
            {api.specification && <a href={api.specification.url} target="_blank" rel="noreferrer">{api.specification.title}<ExternalLink size={12} /></a>}
          </div>
          <div className="api-reference-browser">
            <nav className="endpoint-index" aria-label={`${api.name} endpoints`}>{filteredEndpoints.map(endpoint => <button key={endpoint.id} aria-current={selectedEndpoint?.id === endpoint.id ? 'page' : undefined} onClick={() => setSelectedEndpointId(endpoint.id)}>
              <span className={`component-api-method method-${endpoint.method.toLowerCase()}`}>{endpoint.method}</span>
              <span><strong>{endpoint.name}</strong><code>{endpoint.path}</code></span>
            </button>)}</nav>
            <div className="endpoint-detail">{selectedEndpoint ? <EndpointDetail key={selectedEndpoint.id} endpoint={selectedEndpoint} schemas={schemas} /> : <div className="component-inspector-empty">No endpoints are available for this version.</div>}</div>
          </div>
        </> : <div className="component-inspector-empty">No API interface has been imported for this component.</div>}
      </section>}

    {tab === 'data' && <div className="component-data-workspace">
      {component.data && <section><header><Database size={16} /><div><span>Owned state</span><h4>{component.name} data</h4></div></header><DataCatalog component={component} /></section>}
      {component.messaging && <section><header><Radio size={16} /><div><span>Messages</span><h4>Published and consumed events</h4></div></header><MessagingCatalog component={component} /></section>}
      {(datastores.length > 0 || messaging.length > 0) && <section><header><Network size={16} /><div><span>Runtime resources</span><h4>Backing infrastructure</h4></div></header><div className="component-resource-columns"><DependencyGroup title="Datastores" description="Data held at rest for this component." dependencies={datastores} showData /><DependencyGroup title="Messaging infrastructure" description="Queues and topics used by this component." dependencies={messaging} showData /></div></section>}
      {!hasDataAndEvents && <div className="component-absence-state"><Database size={20} /><div><h4>No directly owned data or events</h4><p>{component.name} has no datastore or message contract attached to it in the current catalog. This does not mean the service is stateless: follow its outgoing dependencies in the map to inspect data and events owned by downstream components.</p></div></div>}
    </div>}
  </section>
}
