import { useId, useState } from 'react'
import { ArrowRight, X } from 'lucide-react'
import type { Component } from '@/data/model'
import { componentGroup, componentKindLabel, systemGraph } from '@/data/component-structure'

export function SystemDiagram({ components, allComponents, onSelect }: { components: Component[]; allComponents: Component[]; onSelect: (id: string) => void }) {
  const marker = useId().replace(/:/g, '')
  const [focus, setFocus] = useState<string | null>(null)
  const { nodes, edges } = systemGraph(components, allComponents)
  if (!nodes.length) return null
  const services = nodes.filter(c => componentGroup(c) === 'Services & components')
  const infrastructure = nodes.filter(c => componentGroup(c) === 'Infrastructure')
  const providers = nodes.filter(c => componentGroup(c) === 'External providers')
  const dependencies = [...infrastructure, ...providers]
  const width = Math.max(900, Math.max(services.length, dependencies.length) * 210)
  const height = services.length && dependencies.length ? 330 : 180
  const positions = new Map<string, { x: number; y: number }>()
  services.forEach((c, i) => positions.set(c.id, { x: width * (i + .5) / services.length, y: 90 }))
  dependencies.forEach((c, i) => positions.set(c.id, { x: width * (i + .5) / dependencies.length, y: services.length ? 265 : 90 }))
  const selected = nodes.find(c => c.id === focus)
  const related = new Set([focus, ...edges.filter(e => e.from === focus || e.to === focus).flatMap(e => [e.from, e.to])])
  const names = (ids: string[]) => ids.map(id => nodes.find(n => n.id === id)!.name).join(', ')
  const outgoing = edges.filter(e => e.from === focus).map(e => e.to)
  const incoming = edges.filter(e => e.to === focus).map(e => e.from)
  const isLocal = selected && components.some(c => c.id === selected.id)

  return <figure className="system-diagram">
    <figcaption><span>System map</span><span>Arrows point to dependencies · Select a node to explore</span></figcaption>
    <div className="system-diagram-scroll" role="region" aria-label="System dependency diagram" tabIndex={0}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ minWidth: width * .8 }} role="group" aria-label="Services and dependencies">
        <defs><marker id={`${marker}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" /></marker></defs>
        {edges.map(e => {
          const reciprocal = edges.some(other => other.from === e.to && other.to === e.from)
          if (reciprocal && e.from > e.to) return null
          const a = positions.get(e.from)!, b = positions.get(e.to)!
          const sameRow = a.y === b.y
          const direction = b.x > a.x ? 1 : -1
          const x1 = a.x + (sameRow ? 89 * direction : 0), y1 = a.y + (sameRow ? 0 : 33 * Math.sign(b.y - a.y))
          const x2 = b.x - (sameRow ? 89 * direction : 0), y2 = b.y - (sameRow ? 0 : 33 * Math.sign(b.y - a.y))
          // Non-adjacent peers route above the row so edges never pass through a node.
          const path = sameRow ? Math.abs(b.x - a.x) > width / Math.max(services.length, dependencies.length) + 1
            ? `M ${a.x} ${a.y - 33} C ${a.x} ${a.y - 90}, ${b.x} ${b.y - 90}, ${b.x} ${b.y - 33}`
            : `M ${x1} ${y1} L ${x2} ${y2}`
            : `M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`
          return <path key={`${e.from}-${e.to}`} d={path} className={`system-edge${focus ? e.from === focus || e.to === focus ? ' is-highlighted' : ' is-muted' : ''}`} markerEnd={`url(#${marker}-arrow)`} markerStart={reciprocal ? `url(#${marker}-arrow)` : undefined}><title>{nodes.find(n => n.id === e.from)!.name} {reciprocal ? 'and' : 'depends on'} {nodes.find(n => n.id === e.to)!.name}{reciprocal ? ' depend on each other' : ''}</title></path>
        })}
        {services.length > 0 && <text className="system-lane-label" x="24" y="30">{services.every(c => c.kind === 'service') ? 'SERVICES' : 'COMPONENTS'}</text>}
        {[infrastructure, providers].map((row, i) => row.length > 0 && <text key={i} className="system-lane-label" x={positions.get(row[0].id)!.x - 88} y={services.length ? 207 : 30}>{i === 0 ? 'INFRASTRUCTURE' : 'EXTERNAL PROVIDERS'}</text>)}
        {nodes.map(c => {
          const { x, y } = positions.get(c.id)!
          const toggle = () => setFocus(focus === c.id ? null : c.id)
          return <g key={c.id} transform={`translate(${x - 88} ${y - 32})`} className={`system-map-node${focus === c.id ? ' is-selected' : ''}${focus && !related.has(c.id) ? ' is-muted' : ''}`} role="button" tabIndex={0} aria-label={`${c.name}, ${componentKindLabel(c)}`} aria-pressed={focus === c.id} onClick={toggle} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle() } }}>
            <rect width="176" height="64" rx="10" />
            <text x="88" y="27" textAnchor="middle">{c.name.length > 22 ? `${c.name.slice(0, 21)}…` : c.name}</text>
            <text className="system-map-kind" x="88" y="47" textAnchor="middle">{componentKindLabel(c)}</text>
            <title>{c.name}{c.description ? `: ${c.description}` : ''}</title>
          </g>
        })}
      </svg>
    </div>
    <div className="system-map-inspector" aria-live="polite">{selected ? <>
      <div><strong>{selected.name}</strong><p>{outgoing.length ? `Depends on ${names(outgoing)}.` : 'No dependencies recorded.'}{incoming.length > 0 && ` Used by ${names(incoming)}.`}</p></div>
      {isLocal && <button onClick={() => onSelect(selected.id)}>View active plans <ArrowRight size={13} /></button>}
      <button onClick={() => setFocus(null)} aria-label="Clear diagram selection"><X size={15} /></button>
    </> : <p>Explore a service or dependency to see its connections and active plans.</p>}</div>
  </figure>
}
