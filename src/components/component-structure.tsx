import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { Component, Feature } from '@/data/model'
import {
  componentAncestors, componentGroup, componentKind, componentKindLabel, componentPath, componentTree, featureTouchesComponent,
} from '@/data/component-structure'
import { ComponentKindIcon } from './component-kind-icon'

const groups = ['Services & components', 'Infrastructure', 'External providers']
export function ComponentIcon({ component, size = 17 }: { component: Component; size?: number }) {
  return <ComponentKindIcon kind={componentKind(component)} size={size} aria-hidden="true" />
}
/** Owners stay next to their children, including local storage inside an application. */
export function ComponentOptions({ components }: { components: Component[] }) {
  const tree = componentTree(components)
  return <>{groups.map(group => {
    const rows = tree.filter(({ component }) => componentGroup(componentAncestors(component.id, components)[0] ?? component) === group)
    return rows.length ? <optgroup key={group} label={group}>{rows.map(({ component }) => <option key={component.id} value={component.id}>
      {componentPath(component.id, components)} · {componentKindLabel(component)}
    </option>)}</optgroup> : null
  })}</>
}

export function FeatureArchitecture({ feature, components, allComponents, href }: {
  feature: Feature; components: Component[]; allComponents: Component[]; href: (id: string) => string
}) {
  return <div className="component-list">{componentTree(components).map(({ component: c, depth }) => {
    const direct = feature.touches.includes(c.id)
    const changed = featureTouchesComponent(feature, c.id, allComponents)
    const relation = direct ? 'Planned changes' : changed ? 'Changes within' : 'Used in this plan'
    return <Link key={c.id} to={href(c.id)} style={{ marginInlineStart: depth * 20 }}>
      <ComponentIcon component={c} size={15} />
      <span>{c.name}<small>{componentKindLabel(c)} · {relation}</small></span>
      <ArrowRight size={14} />
    </Link>
  })}</div>
}
