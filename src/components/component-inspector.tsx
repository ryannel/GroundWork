import { useId, useMemo } from 'react'
import { ArrowRight, GitBranch } from 'lucide-react'
import type { Component } from '@/data/model'
import { componentKindLabel } from '@/data/component-structure'
import type { CatalogTab } from '@/data/catalog-url'
import {
  activeTab, clearRetiredSelection, flowOrigin, inspectorTabs, retiredSelection, returnToOrigin, selectTab, tabAriaLabel,
} from '@/data/inspector-model'
import { useRovingTabs } from '@/lib/use-roving-tabs'
import { useCatalogLocation, type CatalogPanelProps } from './inspector/use-catalog-location'
import { ComponentMentalModel } from './inspector/overview'
import { ApiPanel } from './inspector/api-panel'
import { DataPanel } from './inspector/data-panel'
import { MessagesPanel } from './inspector/messages-panel'
import { JobsPanel } from './inspector/jobs-panel'
import { CoverageReport, Findings, RetiredRecords } from './inspector/provenance'

const panelClass: Record<CatalogTab, string> = {
  overview: 'component-overview-panel',
  api: 'catalog-panel catalog-api-panel',
  data: 'catalog-panel',
  messages: 'catalog-panel',
  jobs: 'catalog-panel',
}

function ActivePanel({ tab, ...props }: CatalogPanelProps & { tab: CatalogTab }) {
  switch (tab) {
    case 'overview': return <ComponentMentalModel component={props.component} dependencies={props.dependencies} />
    case 'api': return <ApiPanel {...props} />
    case 'data': return <DataPanel component={props.component} dependencies={props.dependencies} />
    case 'messages': return <MessagesPanel {...props} />
    case 'jobs': return <JobsPanel {...props} />
  }
}

/** Heading, provenance notes, tablist and the one mounted panel. Catalog selection is read from and written to the URL. */
export function ComponentInspector({ component, dependencies, isLocal, showIdentity = true, onSelectComponent }: {
  component: Component; dependencies: Component[]; isLocal: boolean; showIdentity?: boolean; onSelectComponent?: (id: string) => void
}) {
  const inspectorId = useId()
  const [location, navigate] = useCatalogLocation()
  const tabs = useMemo(() => inspectorTabs(component), [component])
  const tabIds = useMemo(() => tabs.map(item => item.id), [tabs])
  const tab = activeTab(tabs, location.catalog)
  const retired = retiredSelection(component, location)
  const origin = flowOrigin(component, location.from)
  const { onKeyDown, tabProps } = useRovingTabs(tabIds, tab, next => navigate(selectTab(component, location, next)))
  return <section className="component-inspector" aria-label={`${component.name} catalog`}>
    {showIdentity && <header className="component-inspector-heading">
      <div className="component-inspector-identity">
        <div><span>Selected component</span><h3>{component.name}</h3></div>
        <div className="component-inspector-badges"><span>{componentKindLabel(component)}{isLocal ? '' : ' · Other product'}</span></div>
      </div>
      <div className="component-inspector-summary">
        <p>{component.description ?? 'No responsibility summary has been recorded.'}</p>
        {component.repo && <div className="component-inspector-repo">
          <GitBranch size={12} /><span>Source repository</span>
          {component.repo}{component.sourcePath && component.sourcePath !== '.' ? ` · ${component.sourcePath}` : ''}
        </div>}
      </div>
    </header>}

    <RetiredRecords component={component} selection={retired} onBrowseActive={() => navigate(clearRetiredSelection(component, location))} />
    <Findings component={component} findingId={location.finding} />

    <div className="component-inspector-tabs catalog-tabs" role="tablist" aria-label={`${component.name} detail`} onKeyDown={onKeyDown}>
      {tabs.map(item => <button
        key={item.id}
        id={`${inspectorId}-${item.id}`}
        {...tabProps(item.id)}
        aria-controls={`${inspectorId}-panel-${item.id}`}
        aria-label={tabAriaLabel(item)}
      ><strong>{item.label}</strong>{item.count !== null && <b>{item.count}</b>}</button>)}
    </div>

    {origin && tab !== origin.tab && <div className="execution-return-context">
      <span>Opened from the data flow for <strong>{origin.name}</strong></span>
      <button className="execution-return" onClick={() => navigate(returnToOrigin(origin))}>Back to {origin.label} · Data flow<ArrowRight size={14} /></button>
    </div>}
    {/* A selected retired record replaces the panels until a tab or "Browse active records" clears it. */}
    {!retired && <section id={`${inspectorId}-panel-${tab}`} role="tabpanel" className={panelClass[tab]} aria-labelledby={`${inspectorId}-${tab}`}>
      <ActivePanel tab={tab} component={component} dependencies={dependencies} location={location} navigate={navigate} onSelectComponent={onSelectComponent} />
    </section>}

    <CoverageReport component={component} />
  </section>
}
