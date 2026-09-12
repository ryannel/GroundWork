import { useId, useMemo, useState } from 'react'
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import type { Component } from '@/data/model'
import { componentKindLabel, systemGraph } from '@/data/component-structure'
import { ComponentInspector } from '@/components/component-inspector'
import { SystemOverviewMap } from '@/components/system-overview-map'

export function SystemDiagram({ components, allComponents, selectedId, onSelect, onShowWork }: { components: Component[]; allComponents: Component[]; selectedId?: string; onSelect: (id: string) => void; onShowWork: (id: string) => void }) {
  const marker = useId().replace(/:/g, '')
  const [localFocus, setLocalFocus] = useState<string | null>(null)
  const [view, setView] = useState<'overview' | 'focus'>('overview')
  const [contextZoom, setContextZoom] = useState(1)
  const { nodes, edges } = useMemo(() => systemGraph(components, allComponents), [components, allComponents])
  if (!nodes.length) return null

  const localIds = new Set(components.map(component => component.id))
  const relationshipCount = (id: string) => edges.filter(edge => edge.from === id || edge.to === id).length
  const defaultNode = [...nodes].sort((a, b) => relationshipCount(b.id) - relationshipCount(a.id))[0]
  const focus = selectedId ?? localFocus
  const selected = nodes.find(component => component.id === focus) ?? defaultNode
  const dependencies = edges.filter(edge => edge.from === selected.id).map(edge => nodes.find(node => node.id === edge.to)!)
  const consumers = edges.filter(edge => edge.to === selected.id).map(edge => nodes.find(node => node.id === edge.from)!)
  const isLocal = localIds.has(selected.id)
  const mapHeight = Math.max(210, Math.max(consumers.length, dependencies.length) * 72 + 68)
  const contextFitScale = Math.min(1, 520 / mapHeight)
  const contextScale = contextFitScale * contextZoom
  const centerY = mapHeight / 2
  const positions = (items: Component[]) => items.map((component, index) => ({
    component,
    y: 58 + (mapHeight - 96) * (index + .5) / items.length,
  }))
  const consumerPositions = positions(consumers)
  const dependencyPositions = positions(dependencies)
  const mapNode = (component: Component, x: number, y: number, primary = false) => {
    const select = () => { setLocalFocus(component.id); onSelect(component.id) }
    return <g key={component.id} className={`system-neighborhood-node${primary ? ' is-focus' : ''}`} transform={`translate(${x} ${y - 26})`} role="button" tabIndex={0} aria-label={`Inspect ${component.name}`} onClick={select} onKeyDown={event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        select()
      }
    }}>
      <rect width="190" height="52" rx="9" />
      <text x="95" y="22" textAnchor="middle">{component.name.length > 23 ? `${component.name.slice(0, 22)}…` : component.name}</text>
      <text className="system-neighborhood-kind" x="95" y="38" textAnchor="middle">{componentKindLabel(component)}</text>
    </g>
  }

  return <section className="system-explorer" aria-labelledby="system-explorer-heading">
    <header className="system-explorer-heading">
      <div><h3 id="system-explorer-heading">Service landscape</h3><p>Arrows point from a caller to what it depends on. Select any node to follow its immediate context.</p></div>
      <div className="system-explorer-actions">
        <span>{nodes.length} components · {edges.length} relationships</span>
        <label className="system-component-select">
          <span>Inspect</span>
          <select value={selected.id} onChange={event => { setLocalFocus(event.target.value); onSelect(event.target.value) }}>
            {nodes.map(component => <option key={component.id} value={component.id}>{component.name} · {componentKindLabel(component)}</option>)}
          </select>
        </label>
        <div className="system-view-switch" aria-label="System map view">
          <button aria-pressed={view === 'overview'} onClick={() => setView('overview')}>System map</button>
          <button aria-pressed={view === 'focus'} onClick={() => setView('focus')}>Direct context</button>
        </div>
      </div>
    </header>

    {view === 'overview' ? <SystemOverviewMap components={nodes} relationships={edges} focus={selected.id} onFocus={id => { if (id) { setLocalFocus(id); onSelect(id) } }} /> : <>
    <div className="system-neighborhood-toolbar">
      <div><strong>How to read this view</strong><span>Incoming callers rely on the selected component. Outgoing dependencies are services and resources it relies on.</span></div>
      <div aria-label="Direct context zoom controls">
        <button aria-label="Zoom out" disabled={contextZoom <= .75} onClick={() => setContextZoom(value => Math.max(.75, value - .25))}><ZoomOut size={14} /></button>
        <span>{Math.round(contextZoom * 100)}%</span>
        <button aria-label="Zoom in" disabled={contextZoom >= 1.75} onClick={() => setContextZoom(value => Math.min(1.75, value + .25))}><ZoomIn size={14} /></button>
        <button aria-label="Reset zoom" onClick={() => setContextZoom(1)}><Maximize2 size={13} /></button>
      </div>
    </div>
    <div className="system-neighborhood-map" role="region" aria-label={`Direct dependency map for ${selected.name}`}>
      <svg viewBox={`0 0 900 ${mapHeight}`} role="group" style={{ width: 900 * contextScale, height: mapHeight * contextScale }}>
        <defs><marker id={`${marker}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" /></marker></defs>
        <text className="system-neighborhood-label" x="20" y="24">INCOMING · CALLERS</text>
        <text className="system-neighborhood-label" x="355" y="24">SELECTED COMPONENT</text>
        <text className="system-neighborhood-label" x="690" y="24">OUTGOING · DEPENDENCIES</text>
        {consumerPositions.map(({ component, y }) => <path key={`consumer-${component.id}`} d={`M 210 ${y} C 280 ${y}, 285 ${centerY}, 355 ${centerY}`} markerEnd={`url(#${marker}-arrow)`} />)}
        {dependencyPositions.map(({ component, y }) => <path key={`dependency-${component.id}`} d={`M 545 ${centerY} C 615 ${centerY}, 620 ${y}, 690 ${y}`} markerEnd={`url(#${marker}-arrow)`} />)}
        {consumerPositions.map(({ component, y }) => mapNode(component, 20, y))}
        {mapNode(selected, 355, centerY, true)}
        {dependencyPositions.map(({ component, y }) => mapNode(component, 690, y))}
        {!consumers.length && <text className="system-neighborhood-empty" x="115" y={centerY} textAnchor="middle">No consumers</text>}
        {!dependencies.length && <text className="system-neighborhood-empty" x="785" y={centerY} textAnchor="middle">No dependencies</text>}
      </svg>
    </div>

    </>}
    <ComponentInspector key={selected.id} component={selected} dependencies={dependencies} consumers={consumers} isLocal={isLocal} onShowWork={onShowWork} />
  </section>
}
