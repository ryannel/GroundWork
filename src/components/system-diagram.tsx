import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, ChevronDown, Search } from 'lucide-react'
import type { Component } from '@shared/model'
import { architectureSystemGraph, componentKindLabel, isInfrastructureComponent, runtimeSystemGraph } from '@shared/component-structure'
import { ComponentInspector } from '@/components/component-inspector'
import { SystemOverviewMap } from '@/components/system-overview-map'

export function SystemDiagram({ components, allComponents, selectedId, onSelect }: {
  components: Component[]; allComponents: Component[]; selectedId?: string; onSelect: (id: string) => void
}) {
  const [componentQuery, setComponentQuery] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const picker = useRef<HTMLDivElement>(null)
  const pickerTrigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!pickerOpen) return
    // Popover contract: outside press or Escape anywhere closes it; Escape returns focus to the trigger.
    const close = (returnFocus: boolean) => {
      setPickerOpen(false)
      setComponentQuery('')
      if (returnFocus) pickerTrigger.current?.focus()
    }
    const onPointerDown = (event: PointerEvent) => { if (!picker.current?.contains(event.target as Node)) close(false) }
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault();
      close(true) } }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [pickerOpen])
  const graph = useMemo(() => runtimeSystemGraph(components, allComponents), [components, allComponents])
  const map = useMemo(() => architectureSystemGraph(graph.nodes, graph.edges), [graph])
  const selectableMapIds = useMemo(() => new Set(graph.nodes.map(component => component.id)), [graph.nodes])
  const focusMapComponent = useCallback((id: string) => { if (id && selectableMapIds.has(id)) onSelect(id) }, [selectableMapIds, onSelect])
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
    pickerTrigger.current?.focus()
  }
  const componentButton = (component: Component) => <button key={component.id}
    aria-current={selected.id === component.id ? 'true' : undefined} onClick={() => selectComponent(component.id)}>
    <span><strong>{component.name}</strong><small>{componentKindLabel(component)}{localIds.has(component.id) ? '' : ' · Connected product'}</small></span>
    <ArrowRight size={14} aria-hidden="true" />
  </button>

  return <div className="architecture-explorer">
    <section className="architecture-map-section" aria-labelledby="architecture-map-heading">
      <header className="architecture-map-heading">
        <div>
          <h3 id="architecture-map-heading">How the product fits together</h3>
          <p>Select a component to inspect its responsibility and contracts.</p>
          <details className="map-reading-guide"><summary>How to read this map</summary>
            <p>Services and resources include isolated components. Message arrows show catalogued inbound and outbound contracts, not live traffic.
              Supporting assets are available in the component picker.</p>
          </details>
        </div>
        <dl>
          <div><dt>Services</dt><dd>{serviceCount}</dd></div>
          <div><dt>Infrastructure</dt><dd>{infrastructureCount}</dd></div>
          <div><dt>Relationships</dt><dd>{map.edges.length}</dd></div>
        </dl>
      </header>
      {map.nodes.length
        ? <SystemOverviewMap
          components={map.nodes}
          relationships={map.edges}
          observedStatus={map.status}
          selectableIds={selectableMapIds}
          focus={graph.nodes.some(component => component.id === selected.id) ? selected.id : undefined}
          onFocus={focusMapComponent}
        />
        : <div className="architecture-map-empty">
          <p>No runtime components have been catalogued for this product.</p>
          <span>Supporting assets remain available in the component directory.</span>
        </div>}
      <div className="map-selection-summary" aria-live="polite">
        <div><span>{componentKindLabel(selected)}</span><strong>{selected.name}</strong>
          <p>{selected.description ?? 'Inspect this component to explore its catalogued responsibility and contracts.'}</p>
        </div>
        <button onClick={() => {
          const detail = document.getElementById('component-details')
          detail?.scrollIntoView({ block: 'start' })
          detail?.focus({ preventScroll: true })
        }}>Inspect component<ArrowRight size={14} /></button>
      </div>
    </section>

    <section id="component-details" tabIndex={-1} className="component-workspace" aria-labelledby="component-workspace-heading">
      <header className="component-workspace-switcher">
        <div><h3 id="component-workspace-heading">Component explorer</h3><p>Responsibility, contracts, and source evidence</p></div>
        <div className="component-picker" ref={picker}>
          <button
            ref={pickerTrigger}
            className="component-picker-trigger"
            aria-expanded={pickerOpen}
            aria-controls="component-picker-menu"
            onClick={() => setPickerOpen(open => !open)}
          >
            <span><small>Selected component</small><strong>{selected.name}</strong></span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          {pickerOpen && <div id="component-picker-menu" className="component-picker-menu">
            <label className="component-workspace-search">
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">Find a component</span>
              <input autoFocus type="search" value={componentQuery} onChange={event => setComponentQuery(event.target.value)} placeholder="Find a component…" />
            </label>
            <nav aria-label="Components">
              {!!runtimeComponents.length && <section>
                <h4>Runtime components <span>{graph.nodes.length}</span></h4>{runtimeComponents.map(componentButton)}
              </section>}
              {!!supportingComponents.length && <section>
                <h4>Supporting assets <span>{graph.supporting.length}</span></h4>{supportingComponents.map(componentButton)}
              </section>}
              {!runtimeComponents.length && !supportingComponents.length && <p>No components match “{componentQuery}”.</p>}
            </nav>
          </div>}
        </div>
      </header>
      <div className="component-workspace-detail">
        <ComponentInspector
          key={selected.id} component={selected} dependencies={dependencies} isLocal={localIds.has(selected.id)} showIdentity onSelectComponent={onSelect}
        />
      </div>
    </section>
  </div>
}
