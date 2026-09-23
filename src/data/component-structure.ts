import type { Component, Feature } from './model.ts'

export const componentKinds = {
  service: 'Service', module: 'Module', database: 'Database', 'object-storage': 'Object storage',
  'local-storage': 'Local storage', queue: 'Queue', cache: 'Cache', 'external-service': 'External provider',
}
export const componentKind = (c: Component) => c.kind ?? 'module'
export const componentKindLabel = (c: Component) => componentKinds[componentKind(c)]
export const infrastructureKinds = ['database', 'object-storage', 'local-storage', 'queue', 'cache'] as const
export const isInfrastructureComponent = (component: Component) => infrastructureKinds.includes(componentKind(component) as typeof infrastructureKinds[number])
export const componentGroup = (c: Component) => componentKind(c) === 'external-service' ? 'External providers'
  : isInfrastructureComponent(c) ? 'Infrastructure' : 'Services & components'

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
/** Runtime topology excludes supporting modules while retaining isolated services and resources. */
export function runtimeSystemGraph(components: Component[], allComponents: Component[] = components) {
  const graph = systemGraph(components, allComponents)
  const nodes = graph.nodes.filter(component => componentKind(component) !== 'module')
  const nodeIds = new Set(nodes.map(component => component.id))
  return {
    nodes,
    edges: graph.edges.filter(edge => nodeIds.has(edge.from) && nodeIds.has(edge.to)),
    supporting: graph.nodes.filter(component => !nodeIds.has(component.id)),
  }
}

type ObservedInfrastructureStatus = 'observed' | 'unresolved'
export type ArchitectureEdge = { from: string; to: string; messages?: { inbound: number; outbound: number } }

function observedInfrastructureKind(kind = '', name = ''): Component['kind'] | undefined {
  const value = `${kind} ${name}`.toLowerCase()
  if (/cache|redis|memcached/.test(value)) return 'cache'
  if (/queue|broker|pub.?sub|kafka|rabbitmq|sqs/.test(value)) return 'queue'
  if (/object.?storage|\bgcs\b|cloud storage|\bs3\b|blob storage/.test(value)) return 'object-storage'
  if (/local.?storage|\bopfs\b|local file|\bmdx files?\b/.test(value)) return 'local-storage'
  if (/database|postgres|mysql|mariadb|mongodb|dynamodb|spanner|cockroach/.test(value)) return 'database'
  if (/external.?service|external provider/.test(value)) return 'external-service'
}

function observedInfrastructureId(kind: Component['kind'], name: string) {
  return `observed-${kind}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`
}

/** Add source-observed infrastructure without promoting unmatched references into catalog components. */
export function architectureSystemGraph(nodes: Component[], edges: { from: string; to: string }[]) {
  const mapNodes = new Map(nodes.map(component => [component.id, component]))
  const mapEdges = new Map<string, ArchitectureEdge>(edges.map(edge => [JSON.stringify([edge.from, edge.to]), edge]))
  const status = new Map<string, ObservedInfrastructureStatus>()
  const existingByName = new Map(nodes.filter(isInfrastructureComponent).map(component => [component.name.toLowerCase(), component]))

  const addResource = (owner: Component, name: string, kind: Component['kind'], resourceStatus: ObservedInfrastructureStatus) => {
    const existing = existingByName.get(name.toLowerCase())
    const id = existing?.id ?? observedInfrastructureId(kind, name)
    if (!mapNodes.has(id)) {
      mapNodes.set(id, {
        id,
        productId: owner.productId,
        order: owner.order,
        name,
        kind,
        description: resourceStatus === 'unresolved'
          ? `Referenced by ${owner.name}, but not yet matched to a catalog component.`
          : `Resource recorded for ${owner.name}.`,
      })
      status.set(id, resourceStatus)
    }
    const key = JSON.stringify([owner.id, id])
    if (!mapEdges.has(key)) mapEdges.set(key, { from: owner.id, to: id })
    return id
  }

  for (const owner of nodes.filter(component => !isInfrastructureComponent(component) && componentKind(component) !== 'external-service')) {
    const observedStorageKinds = new Set<Component['kind']>()
    const brokers = new Map<string, string>()
    for (const dependency of owner.unresolvedDependencies ?? []) {
      const kind = observedInfrastructureKind(dependency.kind, dependency.name)
      if (!kind) continue
      if (infrastructureKinds.includes(kind as typeof infrastructureKinds[number])) observedStorageKinds.add(kind)
      const id = addResource(owner, dependency.name, kind, 'unresolved')
      if (kind === 'queue') brokers.set(dependency.name.toLowerCase(), id)
    }
    if (owner.data?.technology && ![...observedStorageKinds].some(kind => kind !== 'queue')) {
      const kind = observedInfrastructureKind('', owner.data.technology)
      if (kind && kind !== 'queue' && kind !== 'external-service') addResource(owner, owner.data.technology, kind, 'observed')
    }
    const messageCounts = new Map<string, { inbound: number; outbound: number }>()
    for (const message of owner.messaging?.messages ?? []) {
      const brokerName = message.broker.split(' (')[0]
      const brokerId = brokers.get(brokerName.toLowerCase())
        ?? addResource(owner, brokerName, 'queue', 'observed')
      const counts = messageCounts.get(brokerId) ?? { inbound: 0, outbound: 0 }
      counts[message.direction]++
      messageCounts.set(brokerId, counts)
    }
    for (const [brokerId, messages] of messageCounts) {
      mapEdges.delete(JSON.stringify([owner.id, brokerId]))
      if (messages.inbound && !messages.outbound) {
        mapEdges.set(JSON.stringify([brokerId, owner.id]), { from: brokerId, to: owner.id, messages })
      } else {
        mapEdges.set(JSON.stringify([owner.id, brokerId]), { from: owner.id, to: brokerId, messages })
      }
    }
  }

  return { nodes: [...mapNodes.values()], edges: [...mapEdges.values()], status }
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
