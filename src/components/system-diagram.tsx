import { useMemo, useState } from 'react'
import { ArrowRight, ChevronDown, Search } from 'lucide-react'
import type { Component } from '@/data/model'
import { architectureSystemGraph, componentKindLabel, isInfrastructureComponent, runtimeSystemGraph } from '@/data/component-structure'
import { ComponentInspector } from '@/components/component-inspector'
import { SystemOverviewMap } from '@/components/system-overview-map'

export function SystemDiagram({ components, allComponents, selectedId, onSelect }: { components: Component[]; allComponents: Component[]; selectedId?: string; onSelect: (id: string) => void }) {
  const [componentQuery, setComponentQuery] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const graph = useMemo(() => runtimeSystemGraph(components, allComponents), [components, allComponents])
  const map = useMemo(() => architectureSystemGraph(graph.nodes, graph.edges), [graph])
  const selectableMapIds = useMemo(() => new Set(graph.nodes.map(component => component.id)), [graph.nodes])
  const allNodes = [...graph.nodes, ...graph.supporting]
  if (!allNodes.length) return null

  const localIds = new Set(components.map(component => component.id))
  const relationshipCount = (id: string) => graph.edges.filter(edge => edge.from === id || edge.to === id).length
  const defaultNode = [...graph.nodes, ...graph.supporting].sort((a, b) => relationshipCount(b.id) - relationshipCount(a.id))[0]
  const selected = allNodes.find(component => component.id === selectedId) ?? defaultNode
  const dependencies = graph.edges.filter(edge => edge.from === selected.id).map(edge => graph.nodes.find(node => node.id === edge.to)!)
  const query = componentQuery.trim().toLowerCase()
  const matches = (component: Component) => `${component.name} ${component.description ?? ''} ${componentKindLabel(component)}`.toLowerCase().includes(query)
  const runtimeComponents = graph.nodes.filter(matches)
  const supportingComponents = graph.supporting.filter(matches)
  const serviceCount = graph.nodes.filter(component => !isInfrastructureComponent(component)).length
  const infrastructureCount = map.nodes.filter(isInfrastructureComponent).length
  const selectComponent = (id: string) => {
    onSelect(id)
    setPickerOpen(false)
    setComponentQuery('')
  }
  const componentButton = (component: Component) => <button key={component.id} aria-current={selected.id === component.id ? 'true' : undefined} onClick={() => selectComponent(component.id)}>
    <span><strong>{component.name}</strong><small>{componentKindLabel(component)}{localIds.has(component.id) ? '' : ' · Connected product'}</small></span>
    <ArrowRight size={14} aria-hidden="true" />
  </button>

  return <div className="architecture-explorer">
    <section className="architecture-map-section" aria-labelledby="architecture-map-heading">
      <header className="architecture-map-heading">
        <div>
          <span>System map</span>
          <h3 id="architecture-map-heading">How the system fits together</h3>
          <p>Runtime services and resources appear here, including isolated components with no known dependencies. Supporting assets are listed separately below.</p>
        </div>
        <dl>
          <div><dt>Services</dt><dd>{serviceCount}</dd></div>
          <div><dt>Infrastructure</dt><dd>{infrastructureCount}</dd></div>
          <div><dt>Relationships</dt><dd>{map.edges.length}</dd></div>
        </dl>
      </header>
      {map.nodes.length
        ? <SystemOverviewMap components={map.nodes} relationships={map.edges} observedStatus={map.status} selectableIds={selectableMapIds} focus={graph.nodes.some(component => component.id === selected.id) ? selected.id : undefined} onFocus={id => { if (id && selectableMapIds.has(id)) onSelect(id) }} />
        : <div className="architecture-map-empty"><p>No runtime components have been catalogued for this product.</p><span>Supporting assets remain available in the component directory.</span></div>}
    </section>

    <section className="component-workspace" aria-labelledby="component-workspace-heading">
      <header className="component-workspace-switcher">
        <div><span>Component workspace</span><h3 id="component-workspace-heading">Explore component details</h3></div>
        <div className="component-picker">
          <button className="component-picker-trigger" aria-expanded={pickerOpen} aria-controls="component-picker-menu" onClick={() => setPickerOpen(open => !open)}>
            <span><small>Selected component</small><strong>{selected.name}</strong></span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          {pickerOpen && <div id="component-picker-menu" className="component-picker-menu">
            <label className="component-workspace-search">
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">Find a component</span>
              <input autoFocus type="search" value={componentQuery} onChange={event => setComponentQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { setPickerOpen(false); setComponentQuery('') } }} placeholder="Find a component…" />
            </label>
            <nav aria-label="Components">
              {!!runtimeComponents.length && <section><h4>Runtime components <span>{graph.nodes.length}</span></h4>{runtimeComponents.map(componentButton)}</section>}
              {!!supportingComponents.length && <section><h4>Supporting assets <span>{graph.supporting.length}</span></h4>{supportingComponents.map(componentButton)}</section>}
              {!runtimeComponents.length && !supportingComponents.length && <p>No components match “{componentQuery}”.</p>}
            </nav>
          </div>}
        </div>
      </header>
      <main className="component-workspace-detail">
        <ComponentInspector key={selected.id} component={selected} dependencies={dependencies} isLocal={localIds.has(selected.id)} showIdentity onSelectComponent={onSelect} />
      </main>
    </section>
  </div>
}
