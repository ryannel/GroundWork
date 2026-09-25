import { useMemo } from 'react'
import { Radio } from 'lucide-react'
import { followFlowLink, isBroker, messageEntries, messageFlows } from '@/data/inspector-model'
import { CatalogBrowser } from '../catalog-browser'
import { LinkedInfrastructure } from './dependencies'
import { ContextFlows } from './flows'
import { CatalogGaps, EmptyCatalog, SourceEvidence } from './catalog-content'
import { RecordFields } from './schema-explorer'
import type { CatalogPanelProps } from './use-catalog-location'

const resetFilters = { messagesDirection: undefined }

export function MessagesPanel({ component, dependencies, location, navigate, onSelectComponent }: CatalogPanelProps) {
  const messaging = component.messaging
  const direction = location.messagesDirection ?? 'all'
  const entries = useMemo(() => messageEntries(messaging?.messages ?? []), [messaging])
  const visibleEntries = useMemo(
    () => entries.filter(entry => direction === 'all' || entry.badge === direction),
    [entries, direction],
  )
  const brokers = useMemo(() => dependencies.filter(isBroker), [dependencies])
  const heading = <div className="catalog-panel-heading">
    <div><h4><Radio size={16} />Message contracts</h4><p>Explore inbound and outbound messages by broker, topic or field.</p></div>
  </div>
  const infrastructure = <LinkedInfrastructure
    summary="Linked messaging infrastructure" title="Messaging infrastructure" description="Mapped broker dependencies." dependencies={brokers}
  />
  if (!messaging?.messages.length) return <>{heading}<EmptyCatalog component={component} area="messaging" label="message contracts" />{infrastructure}</>

  const renderDetail = (id: string) => {
    const message = messaging.messages.find(item => item.id === id)!
    return <article className="catalog-record-detail">
      <header><span>{message.direction} · {message.broker}</span><h4>{message.name}</h4></header>
      <dl>
        <div><dt>Channel / topic</dt><dd><code>{message.channel}</code></dd></div>
        <div><dt>Ordering</dt><dd>{message.delivery.ordering}</dd></div>
        <div><dt>Retries</dt><dd>{message.delivery.retries}</dd></div>
        <div><dt>Dead letter</dt><dd>{message.delivery.deadLetter}</dd></div>
      </dl>
      <RecordFields fields={message.fields} />
      <SourceEvidence repository={component.repo} evidence={message.evidence} />
      <ContextFlows
        component={component}
        flows={messageFlows(component, message.id)}
        dependencies={dependencies}
        flowId={location.flow}
        onFlowChange={flow => navigate({ flow }, 'replace')}
        onNavigate={target => navigate(followFlowLink(target, { tab: 'messages', id: message.id }))}
        onSelectComponent={onSelectComponent}
      />
    </article>
  }
  const filters = <label className="catalog-filter">
    <span>Direction</span>
    <select value={direction} onChange={event => navigate({ messagesDirection: event.target.value === 'all' ? undefined : event.target.value })}>
      <option value="all">Both directions</option>
      <option value="inbound">Inbound</option>
      <option value="outbound">Outbound</option>
    </select>
  </label>
  return <>
    {heading}
    <div className="catalog-messages">
      <p className="catalog-intro">
        Documented inbound and outbound contracts. A listed contract does not by itself confirm an active publisher or consumer;
        check its source evidence and known limitations.
      </p>
      <CatalogBrowser
        urlKey="messages"
        label="Messages"
        groupLabel="Brokers"
        total={messaging.messages.length}
        filtered={direction !== 'all'}
        resetPatch={resetFilters}
        filters={filters}
        entries={visibleEntries}
        renderDetail={renderDetail}
      />
      <CatalogGaps gaps={messaging.gaps} />
    </div>
    {infrastructure}
  </>
}
