import type { Component, Feature } from './model.ts'

export const componentKinds = {
  service: 'Service', module: 'Module', database: 'Database', 'object-storage': 'Object storage',
  'local-storage': 'Local storage', queue: 'Queue', cache: 'Cache', 'external-service': 'External provider',
}
export const componentKind = (c: Component) => c.kind ?? 'module'
export const componentKindLabel = (c: Component) => componentKinds[componentKind(c)]
export const componentGroup = (c: Component) => componentKind(c) === 'external-service' ? 'External providers'
  : ['database', 'object-storage', 'local-storage', 'queue', 'cache'].includes(componentKind(c)) ? 'Infrastructure' : 'Services & components'

/** Containment only. Depending on a resource never makes it part of the service. */
export function componentScopeIds(id: string, components: Component[]): Set<string> {
  const ids = new Set([id])
  let size = 0
  while (size !== ids.size) {
    size = ids.size
    for (const c of components) if (c.parentId && ids.has(c.parentId)) ids.add(c.id)
  }
  return ids
}
export function componentAncestors(id: string, components: Component[]): Component[] {
  const path: Component[] = [], seen = new Set<string>()
  let c = components.find(c => c.id === id)
  while (c && !seen.has(c.id)) {
    seen.add(c.id); path.unshift(c)
    c = components.find(p => p.id === c?.parentId)
  }
  return path
}
export const componentPath = (id: string, components: Component[]) => componentAncestors(id, components).map(c => c.name).join(' / ')
/** Project implementation details onto their top-level owners for a product overview. */
export function systemGraph(components: Component[], allComponents: Component[] = components) {
  const root = (id: string) => componentAncestors(id, allComponents)[0]
  const nodes = new Map<string, Component>()
  const edges = new Map<string, { from: string; to: string }>()
  for (const c of components) {
    const owner = root(c.id)
    if (owner) nodes.set(owner.id, owner)
  }
  const localIds = new Set(nodes.keys())
  for (const c of allComponents) for (const id of c.dependsOn ?? []) {
    const from = root(c.id), to = root(id)
    if (!from || !to || from.id === to.id || (!localIds.has(from.id) && !localIds.has(to.id))) continue
    nodes.set(from.id, from)
    nodes.set(to.id, to)
    edges.set(JSON.stringify([from.id, to.id]), { from: from.id, to: to.id })
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] }
}
export const featureTouchesComponent = (feature: Pick<Feature, 'touches'>, id: string, components: Component[]) => {
  const scope = componentScopeIds(id, components)
  return feature.touches.some(id => scope.has(id))
}
/** Include actual participants and their owners; do not assume every declared dependency is used. */
export function featureComponents(feature: Pick<Feature, 'touches' | 'spec'>, components: Component[]): Component[] {
  const ids = new Set([
    ...feature.touches,
    ...(feature.spec?.flow?.nodes.flatMap(n => n.component ? [n.component] : []) ?? []),
    ...(feature.spec?.api?.contracts.flatMap(c => [c.from, c.to]) ?? []),
    ...(feature.spec?.storage?.tables.map(t => t.component) ?? []),
  ])
  for (const id of [...ids]) for (const parent of componentAncestors(id, components)) ids.add(parent.id)
  return components.filter(c => ids.has(c.id))
}
export function changesOverlap(a: Pick<Feature, 'touches'>, b: Pick<Feature, 'touches'>, components: Component[]) {
  return a.touches.some(id => featureTouchesComponent(b, id, components)) || b.touches.some(id => featureTouchesComponent(a, id, components))
}
export function componentTree(components: Component[]): { component: Component; depth: number }[] {
  const rows: { component: Component; depth: number }[] = [], seen = new Set<string>()
  const visit = (c: Component, depth: number) => {
    if (seen.has(c.id)) return
    seen.add(c.id); rows.push({ component: c, depth })
    components.filter(child => child.parentId === c.id).forEach(child => visit(child, depth + 1))
  }
  components.filter(c => !c.parentId || !components.some(p => p.id === c.parentId)).forEach(c => visit(c, 0))
  return rows
}
