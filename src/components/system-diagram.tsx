import { useId, useMemo, useState } from 'react'
import { ArrowRight, GitBranch } from 'lucide-react'
import type { Component } from '@/data/model'
import { componentKindLabel, systemGraph } from '@/data/component-structure'
import { ComponentIcon } from '@/components/component-structure'
import { ComponentInspector } from '@/components/component-inspector'
import { SystemOverviewMap } from '@/components/system-overview-map'

export function SystemDiagram({ components, allComponents, onSelect }: { components: Component[]; allComponents: Component[]; onSelect: (id: string) => void }) {
  const marker = useId().replace(/:/g, '')
  const [focus, setFocus] = useState<string | null>(null)
  const [view, setView] = useState<'overview' | 'focus'>('overview')
  const { nodes, edges } = useMemo(() => systemGraph(components, allComponents), [components, allComponents])
  if (!nodes.length) return null

  const localIds = new Set(components.map(component => component.id))
  const relationshipCount = (id: string) => edges.filter(edge => edge.from === id || edge.to === id).length
  const defaultNode = [...nodes].sort((a, b) => relationshipCount(b.id) - relationshipCount(a.id))[0]
  const selected = nodes.find(component => component.id === focus) ?? defaultNode
  const dependencies = edges.filter(edge => edge.from === selected.id).map(edge => nodes.find(node => node.id === edge.to)!)
  const consumers = edges.filter(edge => edge.to === selected.id).map(edge => nodes.find(node => node.id === edge.from)!)
  const isLocal = localIds.has(selected.id)
  const mapHeight = Math.max(210, Math.max(consumers.length, dependencies.length) * 72 + 68)
  const centerY = mapHeight / 2
  const positions = (items: Component[]) => items.map((component, index) => ({
    component,
    y: 58 + (mapHeight - 96) * (index + .5) / items.length,
  }))
  const consumerPositions = positions(consumers)
  const dependencyPositions = positions(dependencies)
  const mapNode = (component: Component, x: number, y: number, primary = false) => {
    const select = () => setFocus(component.id)
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

  const relationCard = (component: Component) => <button key={component.id} className="system-relation-card" onClick={() => setFocus(component.id)}>
    <span className="system-relation-icon"><ComponentIcon component={component} size={16} /></span>
    <span><strong>{component.name}</strong><small>{componentKindLabel(component)}{localIds.has(component.id) ? '' : ' · Other product'}</small></span>
    <ArrowRight size={14} aria-hidden="true" />
  </button>

  return <section className="system-explorer" aria-labelledby="system-explorer-heading">
    <header className="system-explorer-heading">
      <div><h3 id="system-explorer-heading">Dependency explorer</h3><p>Select a component to inspect only its direct relationships.</p></div>
      <div className="system-explorer-actions">
        <span>{nodes.length} components · {edges.length} relationships</span>
        <div className="system-view-switch" aria-label="System map view">
          <button aria-pressed={view === 'overview'} onClick={() => setView('overview')}>Overview</button>
          <button aria-pressed={view === 'focus'} onClick={() => setView('focus')}>Focus</button>
        </div>
      </div>
    </header>

    {view === 'overview' ? <SystemOverviewMap components={nodes} relationships={edges} focus={focus ?? undefined} onFocus={id => setFocus(id || null)} /> : <>
    <div className="system-component-picker" role="list" aria-label="System components">
      {nodes.map(component => {
        const count = relationshipCount(component.id)
        return <button key={component.id} role="listitem" className={component.id === selected.id ? 'is-selected' : ''} aria-pressed={component.id === selected.id} onClick={() => setFocus(component.id)}>
          <ComponentIcon component={component} size={15} />
          <span>{component.name}</span>
          <small aria-label={`${count} direct ${count === 1 ? 'relationship' : 'relationships'}`}>{count}</small>
        </button>
      })}
    </div>

    <div className="system-neighborhood-map" role="region" aria-label={`Direct dependency map for ${selected.name}`}>
      <svg viewBox={`0 0 900 ${mapHeight}`} role="group">
        <defs><marker id={`${marker}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" /></marker></defs>
        <text className="system-neighborhood-label" x="20" y="24">USED BY</text>
        <text className="system-neighborhood-label" x="355" y="24">SELECTED COMPONENT</text>
        <text className="system-neighborhood-label" x="690" y="24">DEPENDS ON</text>
        {consumerPositions.map(({ component, y }) => <path key={`consumer-${component.id}`} d={`M 210 ${y} C 280 ${y}, 285 ${centerY}, 355 ${centerY}`} markerEnd={`url(#${marker}-arrow)`} />)}
        {dependencyPositions.map(({ component, y }) => <path key={`dependency-${component.id}`} d={`M 545 ${centerY} C 615 ${centerY}, 620 ${y}, 690 ${y}`} markerEnd={`url(#${marker}-arrow)`} />)}
        {consumerPositions.map(({ component, y }) => mapNode(component, 20, y))}
        {mapNode(selected, 355, centerY, true)}
        {dependencyPositions.map(({ component, y }) => mapNode(component, 690, y))}
        {!consumers.length && <text className="system-neighborhood-empty" x="115" y={centerY} textAnchor="middle">No consumers</text>}
        {!dependencies.length && <text className="system-neighborhood-empty" x="785" y={centerY} textAnchor="middle">No dependencies</text>}
      </svg>
    </div>

    <div className="system-relationship-lens">
      <article className="system-focus-card">
        <div className="system-focus-kicker"><ComponentIcon component={selected} size={18} /><span>{componentKindLabel(selected)}{isLocal ? '' : ' · Other product'}</span></div>
        <h4>{selected.name}</h4>
        {selected.description && <p>{selected.description}</p>}
        {selected.repo && <div className="system-focus-repo"><GitBranch size={13} />{selected.repo}</div>}
        <div className="system-focus-counts"><span><strong>{consumers.length}</strong> used by</span><span><strong>{dependencies.length}</strong> depends on</span></div>
        {isLocal && <button className="system-focus-plans" onClick={() => onSelect(selected.id)}>View active plans <ArrowRight size={14} /></button>}
      </article>

      <section className="system-relation-group system-relation-consumers">
        <header><span>Used by</span><small>Components that call or require {selected.name}</small></header>
        {consumers.length ? <div>{consumers.map(relationCard)}</div> : <p>No recorded consumers.</p>}
      </section>

      <section className="system-relation-group system-relation-dependencies">
        <header><span>Depends on</span><small>Components {selected.name} calls or requires</small></header>
        {dependencies.length ? <div>{dependencies.map(relationCard)}</div> : <p>No recorded dependencies.</p>}
      </section>
    </div>
    </>}
    <ComponentInspector key={selected.id} component={selected} dependencies={dependencies} consumers={consumers} />
  </section>
}
