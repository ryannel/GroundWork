import { Link } from 'react-router-dom'
import { Boxes, Database, Cloud, Layers, HardDrive, Network, GitBranch, ArrowRight } from 'lucide-react'
import type { Component, Feature } from '@/data/model'
import { componentGroup, componentKind, componentKindLabel, componentPath, componentTree, featureTouchesComponent, systemGraph } from '@/data/component-structure'

const groups = ['Services & components', 'Infrastructure', 'External providers']
export function ComponentIcon({ component, size = 17 }: { component: Component; size?: number }) {
  const kind = componentKind(component)
  const Icon = kind === 'service' ? Boxes : kind === 'database' ? Database : kind === 'external-service' ? Cloud : kind === 'local-storage' || kind === 'object-storage' ? HardDrive : kind === 'module' ? Layers : Network
  return <Icon size={size} aria-hidden="true" />
}
/** Owners stay next to their children, including local storage inside an application. */
export function ComponentOptions({ components }: { components: Component[] }) {
  const tree = componentTree(components)
  return <>{groups.map(group => {
    const rows = tree.filter(({ component }) => {
      let root = component
      while (root.parentId && components.some(c => c.id === root.parentId)) root = components.find(c => c.id === root.parentId)!
      return componentGroup(root) === group
    })
    return rows.length ? <optgroup key={group} label={group}>{rows.map(({ component }) => <option key={component.id} value={component.id}>{componentPath(component.id, components)} · {componentKindLabel(component)}</option>)}</optgroup> : null
  })}</>
}

export function ProductArchitecture({ components, allComponents, active, selected, onSelect }: { components: Component[]; allComponents: Component[]; active: Feature[]; selected?: string; onSelect: (id: string) => void }) {
  const roots = components.filter(c => !c.parentId)
  const graph = systemGraph(components, allComponents)
  const render = (c: Component) => {
    const count = active.filter(f => featureTouchesComponent(f, c.id, allComponents)).length
    const users = graph.edges.filter(edge => edge.to === c.id).map(edge => graph.nodes.find(n => n.id === edge.from)!)
    const dependencies = graph.edges.filter(edge => edge.from === c.id).map(edge => graph.nodes.find(n => n.id === edge.to)!)
    const dependencyLink = (d: Component) => components.some(c => c.id === d.id)
      ? <button key={d.id} onClick={() => onSelect(d.id)}>{componentPath(d.id, allComponents)}</button>
      : <span key={d.id}>{componentPath(d.id, allComponents)}</span>
    return <article key={c.id} className={`architecture-node${selected === c.id ? ' is-selected' : ''}`}>
      <div className="architecture-node-heading"><ComponentIcon component={c} /><h4>{c.name}</h4><span>{componentKindLabel(c)}</span></div>
      {c.description && <p>{c.description}</p>}
      {c.repo && <div className="architecture-repo"><GitBranch size={12} />{c.repo}</div>}
      {dependencies.length > 0 && <div className="architecture-relations"><span>Depends on</span><div>{dependencies.map(dependencyLink)}</div></div>}
      {users.length > 0 && <div className="architecture-relations"><span>Used by</span><div>{users.map(dependencyLink)}</div></div>}
      <button className="architecture-work" onClick={() => onSelect(c.id)} aria-pressed={selected === c.id}>{count ? `${count} active ${count === 1 ? 'plan' : 'plans'}` : 'No planned changes'}<ArrowRight size={13} /></button>
    </article>
  }
  return <div className="architecture-groups">{groups.map(group => {
    const members = roots.filter(c => componentGroup(c) === group)
    return members.length > 0 && <section key={group}><div className="architecture-group-heading"><h3>{group === 'Services & components' && members.every(c => c.kind === 'service') ? 'Services' : group}</h3><span>{members.length}</span></div><div className="product-components-grid">{members.map(render)}</div></section>
  })}</div>
}

export function FeatureArchitecture({ feature, components, allComponents, href }: { feature: Feature; components: Component[]; allComponents: Component[]; href: (id: string) => string }) {
  return <div className="component-list">{componentTree(components).map(({ component: c, depth }) => {
    const direct = feature.touches.includes(c.id)
    const changed = featureTouchesComponent(feature, c.id, allComponents)
    return <Link key={c.id} to={href(c.id)} style={{ marginInlineStart: depth * 20 }}><ComponentIcon component={c} size={15} /><span>{c.name}<small>{componentKindLabel(c)} · {direct ? 'Planned changes' : changed ? 'Changes within' : 'Used in this plan'}</small></span><ArrowRight size={14} /></Link>
  })}</div>
}
