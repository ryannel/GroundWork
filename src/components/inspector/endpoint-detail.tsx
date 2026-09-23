import { useId, useState, type ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import type { Component } from '@/data/model'
import { sourceEvidenceUrl } from '@/data/execution-flow'
import { endpointSource, type ApiEndpoint, type SchemaIndex } from '@/data/inspector-model'
import { useRovingTabs } from '@/lib/use-roving-tabs'
import { SchemaExplorer } from './schema-explorer'

const views = ['request', 'response', 'flow'] as const
type View = typeof views[number]
const viewLabels: Record<View, string> = { request: 'Request', response: 'Response', flow: 'Data flow' }

function FlowNotInvestigated({ endpoint }: { endpoint: ApiEndpoint }) {
  return <div className="schema-browser-empty">
    <strong>Data flow not investigated yet</strong>
    <span>The contract is catalogued. Its implementation path and external calls have not been traced.</span>
    <span>{endpoint.source
      ? 'Start at the endpoint source below, then inspect the relevant helpers, configuration and tests.'
      : 'Locate the handler in the component repository to begin a focused investigation.'}</span>
  </div>
}

/**
 * One endpoint with Request / Response / Data flow tabs. Whether the data flow is open lives in the URL
 * (`apiView`); which payload side is shown is ephemeral and resets per endpoint.
 */
export function EndpointDetail({ endpoint, component, index, flowContent, flowOpen, onFlowOpenChange }: {
  component: Component; endpoint: ApiEndpoint; index: SchemaIndex; flowContent?: ReactNode
  flowOpen: boolean; onFlowOpenChange: (open: boolean) => void
}) {
  const payloadId = useId()
  const [payload, setPayload] = useState<'request' | 'response'>(endpoint.request || !endpoint.response ? 'request' : 'response')
  const view: View = flowOpen ? 'flow' : payload
  const selectView = (next: View) => {
    onFlowOpenChange(next === 'flow')
    if (next !== 'flow') setPayload(next)
  }
  const { onKeyDown, tabProps } = useRovingTabs(views, view, selectView)
  const source = endpointSource(component, endpoint)
  const sourceUrl = source && sourceEvidenceUrl(component.repo, source)
  const panel = { id: `${payloadId}-panel-${view}`, role: 'tabpanel', 'aria-labelledby': `${payloadId}-${view}` } as const
  return <article className="endpoint-reference">
    <div className="endpoint-context">
      <header className="endpoint-reference-heading">
        <div className="endpoint-reference-title">
          <span className={`component-api-method method-${endpoint.method.toLowerCase()}`}>{endpoint.method}</span>
          <div><h5>{endpoint.name}</h5><code>{endpoint.path}</code></div>
        </div>
        {endpoint.version && <span className="component-endpoint-version">{endpoint.version}</span>}
      </header>
      {endpoint.summary && <p className="endpoint-reference-summary">{endpoint.summary}</p>}
      <div className="payload-tabs" role="tablist" aria-label="Endpoint details" onKeyDown={onKeyDown}>
        {views.map(item => <button key={item} id={`${payloadId}-${item}`} {...tabProps(item)} aria-controls={`${payloadId}-panel-${item}`}>
          {viewLabels[item]}
        </button>)}
      </div>
    </div>
    {view === 'flow'
      ? <div className="endpoint-execution" {...panel}>{flowContent ?? <FlowNotInvestigated endpoint={endpoint} />}</div>
      : <div {...panel}>
        <SchemaExplorer key={`${endpoint.id}-${view}`} type={view === 'request' ? endpoint.request : endpoint.response} index={index} />
      </div>}
    {endpoint.source && <footer className="component-endpoint-source">
      <span>Endpoint source</span>
      <code>{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer">{endpoint.source}<ExternalLink size={12} /></a> : endpoint.source}</code>
    </footer>}
  </article>
}
