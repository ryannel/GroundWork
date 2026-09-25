import { useMemo } from 'react'
import { ExternalLink } from 'lucide-react'
import { catalogVersions } from '@/data/catalog-navigation'
import { endpointEntries, endpointFlows, endpointMatches, followFlowLink, schemaIndex } from '@/data/inspector-model'
import { CatalogBrowser } from '../catalog-browser'
import { EndpointDetail } from './endpoint-detail'
import { EndpointFlows } from './flows'
import { EmptyCatalog, SourceEvidence } from './catalog-content'
import { SchemaExplorer } from './schema-explorer'
import type { CatalogPanelProps } from './use-catalog-location'

const resetFilters = { apiMethod: undefined, apiVersion: undefined }

export function ApiPanel({ component, dependencies, location, navigate, onSelectComponent }: CatalogPanelProps) {
  const api = component.api
  const index = useMemo(() => schemaIndex(api?.schemas), [api])
  const entries = useMemo(() => endpointEntries(component, index), [component, index])
  const methods = useMemo(() => [...new Set(api?.endpoints.map(endpoint => endpoint.method))], [api])
  const versions = useMemo(() => api ? catalogVersions(api) : [], [api])
  const method = location.apiMethod ?? 'all'
  const version = location.apiVersion ?? 'all'
  const visibleEntries = useMemo(
    () => entries.filter((_, position) => endpointMatches(api!.endpoints[position], method, version)),
    [api, entries, method, version],
  )
  const linkedSchema = location.schema ? index.byId.get(location.schema) : undefined
  const renderDetail = (id: string) => {
    const endpoint = api!.endpoints.find(item => item.id === id)!
    const flows = endpointFlows(component, id)
    const flowContent = flows.length ? <EndpointFlows
      component={component}
      flows={flows}
      dependencies={dependencies}
      flowId={location.flow}
      onFlowChange={flow => navigate({ flow }, 'replace')}
      onNavigate={target => navigate(followFlowLink(target, { tab: 'api', id: endpoint.id }))}
      onSelectComponent={onSelectComponent}
    /> : undefined
    return <>
      <EndpointDetail
        key={id}
        endpoint={endpoint}
        component={component}
        index={index}
        flowOpen={location.apiView === 'flow'}
        onFlowOpenChange={open => navigate({ apiView: open ? 'flow' : 'payload', from: undefined })}
        flowContent={flowContent}
      />
      <SourceEvidence repository={component.repo} evidence={endpoint.evidence} />
    </>
  }
  const filters = <>
    <label className="catalog-filter">
      <span>Method</span>
      <select value={method} onChange={event => navigate({ apiMethod: event.target.value === 'all' ? undefined : event.target.value })}>
        <option value="all">All methods</option>
        {methods.map(value => <option key={value}>{value}</option>)}
      </select>
    </label>
    {versions.length > 0 && <label className="catalog-filter">
      <span>Version</span>
      <select value={version} onChange={event => navigate({ apiVersion: event.target.value === 'all' ? undefined : event.target.value })}>
        <option value="all">All versions</option>
        {versions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </label>}
  </>

  return <>
    {linkedSchema && <section className="catalog-linked-schema">
      <button onClick={() => navigate({ schema: undefined })}>Back to interfaces</button>
      <SchemaExplorer key={linkedSchema.id} rootId={linkedSchema.id} index={index} />
    </section>}
    {api?.endpoints.length ? <>
      <div className="catalog-panel-heading">
        <div>
          <h4>Interface catalog</h4>
          {(!!api.schemas?.length || api.sourceRevision) && <p>
            {!!api.schemas?.length && `${api.schemas.length} schema types`}
            {api.sourceRevision && `${api.schemas?.length ? ' · ' : ''}Revision ${api.sourceRevision.slice(0, 8)}`}
          </p>}
        </div>
        {api.specification && <a href={api.specification.url} target="_blank" rel="noreferrer">{api.specification.title}<ExternalLink size={13} /></a>}
      </div>
      <CatalogBrowser
        urlKey="api"
        label="Interfaces"
        groupLabel="Resources"
        total={api.endpoints.length}
        filtered={method !== 'all' || version !== 'all'}
        resetPatch={resetFilters}
        filters={filters}
        entries={visibleEntries}
        renderDetail={renderDetail}
      />
    </> : <EmptyCatalog component={component} area="api" label="interfaces" />}
  </>
}
