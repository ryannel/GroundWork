import { repositoryIdentity } from '../src/data/repository-identity.ts'
import type { Component } from '../src/data/model.ts'

/** One source revision and the tree of the paths actually covered by that observation. */
export interface Observation {
  /** Null means the legacy catalog did not record which source commit it observed. */
  revision: string | null
  tree?: { id: string; coveredPathsKey: string }
}
export type CatalogOrigin = 'source' | 'local'
export type EntityKind = 'component' | 'endpoint' | 'schema' | 'data' | 'message' | 'job' | 'flow' | 'finding'
export interface CatalogReference { componentId: string; kind: EntityKind; id: string }
type UnitBase = Observation & { componentId: string }
export type AreaUnit = UnitBase & {
  kind: 'area'; area: string; value: unknown
  /** Active identities in this whole-area baseline. The adapter must omit suppressed identities when materialising it. */
  entities: { kind: EntityKind; id: string }[]
}
export type DetailUnit = UnitBase & {
  kind: 'flow' | 'finding'; id: string; value: unknown; references: CatalogReference[]
}
export type RetirementUnit = UnitBase & {
  kind: 'retirement'; retiredKind: EntityKind; id: string; value: unknown
}
export type CatalogUnit = AreaUnit | DetailUnit | RetirementUnit
export interface CatalogCandidate {
  repository: string
  /** Set only for the candidate held in a product's own home. */
  homeRepository?: string
  units: CatalogUnit[]
}
/** Relation of the first commit to the second, using the scanned repository's commit graph. */
export interface RevisionHistory {
  relation(first: string, second: string): 'same' | 'ancestor' | 'descendant' | 'diverged' | 'unknown'
  /** A commit on the source default branch whose covered-path tree equals this observation's tree. */
  defaultBranchRevision?(tree: NonNullable<Observation['tree']>): string | undefined
}
export type ResolutionReason = 'source-only' | 'local-only' | 'source-newer' | 'local-newer' | 'same-revision'
  | 'equivalent-tree' | 'diverged' | 'unknown'
export interface Provenance {
  catalog: CatalogOrigin
  revision: string | null
  effectiveRevision: string | null
  otherCatalog?: CatalogOrigin
  otherRevision?: string | null
  otherEffectiveRevision?: string | null
  reason: ResolutionReason
  /** A source fallback still carries the unresolved ordering to the viewer. */
  conflict?: 'diverged' | 'unknown'
}
export interface ResolvedArea { unit: AreaUnit; provenance: Provenance; suppressed: { kind: EntityKind; id: string }[] }
export interface IncompatibleReference extends CatalogReference { areaRevision: string | null }
export interface ResolvedDetail { unit: DetailUnit; provenance: Provenance; incompatible: IncompatibleReference[] }
export interface ResolvedRetirement { unit: RetirementUnit; provenance: Provenance; effective: boolean }
export interface ResolutionWarning {
  componentId: string; kind: CatalogUnit['kind'] | 'retirement-conflict'; id: string; status: 'diverged' | 'unknown'
}
export interface ResolvedCatalog {
  repository: string
  productHome: string
  areas: ResolvedArea[]
  flows: ResolvedDetail[]
  findings: ResolvedDetail[]
  retirements: ResolvedRetirement[]
  warnings: ResolutionWarning[]
}

const entityKey = (componentId: string, kind: EntityKind, id: string) => JSON.stringify([componentId, kind, id])
const unitKey = (unit: CatalogUnit) => unit.kind === 'area' ? JSON.stringify([unit.componentId, 'area', unit.area])
  : unit.kind === 'retirement' ? entityKey(unit.componentId, unit.retiredKind, unit.id)
    : JSON.stringify([unit.componentId, unit.kind, unit.id])
const effective = (item: Observation, history: RevisionHistory) => item.tree && history.defaultBranchRevision?.(item.tree) || item.revision

type Picked<T extends CatalogUnit> = { unit: T; provenance: Provenance }
function choose<T extends CatalogUnit>(source: T | undefined, local: T | undefined, history: RevisionHistory): Picked<T> | undefined {
  if (!source && !local) return undefined
  if (!source || !local) {
    const unit = (source ?? local)!
    return { unit, provenance: { catalog: source ? 'source' : 'local', revision: unit.revision,
      effectiveRevision: effective(unit, history), reason: source ? 'source-only' : 'local-only' } }
  }
  const sourceEffective = effective(source, history), localEffective = effective(local, history)
  const sameTree = source.tree && local.tree && source.tree.id === local.tree.id
    && source.tree.coveredPathsKey === local.tree.coveredPathsKey
  const relation = sameTree ? 'equivalent-tree' : sourceEffective && localEffective
    ? sourceEffective === localEffective ? 'same' : history.relation(sourceEffective, localEffective) : 'unknown'
  const localWins = relation === 'ancestor'
  const unit = localWins ? local : source
  const reason: ResolutionReason = relation === 'ancestor' ? 'local-newer' : relation === 'descendant' ? 'source-newer'
    : relation === 'same' ? 'same-revision' : relation === 'equivalent-tree' ? 'equivalent-tree' : relation
  return { unit, provenance: { catalog: localWins ? 'local' : 'source', revision: unit.revision,
    effectiveRevision: localWins ? localEffective : sourceEffective,
    otherCatalog: localWins ? 'source' : 'local', otherRevision: localWins ? source.revision : local.revision,
    otherEffectiveRevision: localWins ? sourceEffective : localEffective, reason,
    ...(relation === 'diverged' || relation === 'unknown' ? { conflict: relation } : {}) } }
}
function indexed<T extends CatalogUnit>(units: CatalogUnit[], kind: T['kind']): Map<string, T> {
  const result = new Map<string, T>()
  for (const unit of units) if (unit.kind === kind) {
    const key = unitKey(unit)
    if (result.has(key)) throw new Error(`Duplicate ${kind} catalog unit: ${key}`)
    result.set(key, unit as T)
  }
  return result
}
const union = (a: Map<string, unknown>, b: Map<string, unknown>) => [...new Set([...a.keys(), ...b.keys()])].sort()

type AreaName = 'dependencies' | 'api' | 'data' | 'messaging' | 'jobs'
type StoredObservation = { sourceRevision?: string; treeId?: string; coveredPathsKey?: string }
type StoredAreaRevision = { revision: string; treeId?: string; coveredPathsKey?: string }
const treeOf = (value: { treeId?: string; coveredPathsKey?: string } | undefined): Observation['tree'] =>
  value?.treeId && value.coveredPathsKey ? { id: value.treeId, coveredPathsKey: value.coveredPathsKey } : undefined
const revisionOf = (value: StoredObservation): Observation => ({ revision: value.sourceRevision ?? null, tree: treeOf(value) })

/** Normalize persisted components without claiming that a legacy partial scan dates untouched areas. */
export function catalogCandidateFromComponents(repository: string, components: Component[], homeRepository?: string): CatalogCandidate {
  const canonical = repositoryIdentity(repository)
  const units: CatalogUnit[] = []
  for (const component of components) {
    if (repositoryIdentity(component.repo ?? repository) !== canonical) continue
    const id = component.id
    const areaRevisions = (component.scan as typeof component.scan &
      { areaRevisions?: Partial<Record<AreaName, StoredAreaRevision>> } | undefined)?.areaRevisions
    const area = (name: string, value: unknown, entities: AreaUnit['entities'], metadata?: StoredAreaRevision) => {
      if (value === undefined) return
      units.push({ kind: 'area', componentId: id, area: name, value, entities,
        revision: metadata?.revision ?? null, tree: treeOf(metadata) })
    }
    const identity = { ...component }
    for (const field of ['api', 'data', 'messaging', 'jobs', 'executionFlows', 'findings', 'retiredObservations',
      'dependsOn', 'unresolvedDependencies'] as const) delete identity[field]
    units.push({ kind: 'area', componentId: id, area: 'identity', value: identity,
      entities: [{ kind: 'component', id }], revision: component.sourceRevision ?? null })
    const apiRevision = areaRevisions?.api ?? (component.api?.sourceRevision
      ? { revision: component.api.sourceRevision } : undefined)
    area('api', component.api,
      [...(component.api?.endpoints ?? []).map(item => ({ kind: 'endpoint' as const, id: item.id })),
        ...(component.api?.schemas ?? []).map(item => ({ kind: 'schema' as const, id: item.id }))], apiRevision)
    area('data', component.data, (component.data?.records ?? []).map(item => ({ kind: 'data', id: item.id })), areaRevisions?.data)
    area('messaging', component.messaging, (component.messaging?.messages ?? []).map(item => ({ kind: 'message', id: item.id })),
      areaRevisions?.messaging)
    area('jobs', component.jobs, (component.jobs ?? []).map(item => ({ kind: 'job', id: item.id })), areaRevisions?.jobs)
    if (component.dependsOn !== undefined || component.unresolvedDependencies !== undefined) {
      area('dependencies', { dependsOn: component.dependsOn, unresolvedDependencies: component.unresolvedDependencies },
        [], areaRevisions?.dependencies)
    }
    for (const item of component.executionFlows ?? []) {
      const references: CatalogReference[] = [
        ...(item.endpointId ? [{ componentId: id, kind: 'endpoint' as const, id: item.endpointId }] : []),
        ...(item.trigger?.kind === 'message' ? [{ componentId: id, kind: 'message' as const, id: item.trigger.messageId }] : []),
        ...(item.trigger?.kind === 'job' ? [{ componentId: id, kind: 'job' as const, id: item.trigger.jobId }] : []),
        ...item.steps.flatMap(step => [
          ...(step.dataRecordIds ?? []).map(record => ({ componentId: id, kind: 'data' as const, id: record })),
          ...(step.messageIds ?? []).map(message => ({ componentId: id, kind: 'message' as const, id: message })),
        ]),
      ]
      units.push({ kind: 'flow', componentId: id, id: item.id, value: item, references,
        ...revisionOf(item as StoredObservation) })
    }
    for (const item of component.findings ?? []) units.push({ kind: 'finding', componentId: id, id: item.id, value: item,
      references: item.subjects.filter(subject => subject.kind !== 'component').map(subject =>
        ({ componentId: id, kind: subject.kind, id: subject.id })), ...revisionOf(item as StoredObservation) })
    for (const item of component.retiredObservations ?? []) units.push({ kind: 'retirement', componentId: id,
      retiredKind: item.kind, id: item.id, value: item, ...revisionOf(item as StoredObservation) })
  }
  return { repository: canonical, ...(homeRepository ? { homeRepository: repositoryIdentity(homeRepository) } : {}), units }
}

/**
 * Resolve one source repository for exactly one product home. No other home's local catalog is eligible.
 * This is independent of file layout and Git commands; adapters supply normalized units and revision history.
 */
export function resolveCatalogForProduct(productHome: string, source: CatalogCandidate, local: CatalogCandidate | null,
  history: RevisionHistory): ResolvedCatalog {
  const home = repositoryIdentity(productHome), repository = repositoryIdentity(source.repository)
  if (source.homeRepository) throw new Error('Source catalog must not be scoped to a product home')
  if (local && (repositoryIdentity(local.repository) !== repository || !local.homeRepository
    || repositoryIdentity(local.homeRepository) !== home)) throw new Error('Local catalog belongs to another repository or product home')
  const result: ResolvedCatalog = { repository, productHome: home, areas: [], flows: [], findings: [], retirements: [], warnings: [] }
  const resolveKind = <T extends CatalogUnit>(kind: T['kind']) => {
    const left = indexed<T>(source.units, kind), right = indexed<T>(local?.units ?? [], kind)
    return union(left, right).map(key => choose(left.get(key), right.get(key), history)!).filter(Boolean)
  }
  const warn = (item: Picked<CatalogUnit>, id: string) => {
    if (item.provenance.conflict) result.warnings.push({ componentId: item.unit.componentId, kind: item.unit.kind,
      id, status: item.provenance.conflict })
  }
  result.areas = resolveKind<AreaUnit>('area').map(item => {
    warn(item, item.unit.area)
    return { ...item, suppressed: [] }
  })
  const details = [...resolveKind<DetailUnit>('flow'), ...resolveKind<DetailUnit>('finding')]
  const retirements = resolveKind<RetirementUnit>('retirement')
  for (const item of retirements) {
    warn(item, `${item.unit.retiredKind}/${item.unit.id}`)
    result.retirements.push({ ...item, effective: true })
  }
  const retirementFor = (componentId: string, kind: EntityKind, id: string) => result.retirements.find(item =>
    item.unit.componentId === componentId && item.unit.retiredKind === kind && item.unit.id === id)
  /** Newer retirements suppress older active identities; source wins unresolved ordering, with a warning. */
  const retirementWins = (active: Picked<CatalogUnit>, retired: ResolvedRetirement, id: string) => {
    const source = active.provenance.catalog === 'source' ? active.unit : retired.provenance.catalog === 'source' ? retired.unit : undefined
    const local = active.provenance.catalog === 'local' ? active.unit : retired.provenance.catalog === 'local' ? retired.unit : undefined
    if (source && local) {
      const picked = choose(source, local, history)!
      if (picked.provenance.conflict) result.warnings.push({ componentId: active.unit.componentId,
        kind: 'retirement-conflict', id, status: picked.provenance.conflict })
      return picked.unit === retired.unit
    }
    const first = effective(active.unit, history), second = effective(retired.unit, history)
    const order = first && second ? first === second ? 'same' : history.relation(first, second) : 'unknown'
    if (order === 'diverged' || order === 'unknown') result.warnings.push({ componentId: active.unit.componentId,
      kind: 'retirement-conflict', id, status: order })
    return order === 'ancestor' || order === 'same' // Same catalog at one revision cannot keep active and retired.
  }
  for (const area of result.areas) for (const entity of area.unit.entities) {
    const retired = retirementFor(area.unit.componentId, entity.kind, entity.id)
    if (retired) {
      if (retirementWins(area, retired, `${entity.kind}/${entity.id}`)) area.suppressed.push(entity)
      else retired.effective = false
    }
  }
  const selectedDetails: Picked<DetailUnit>[] = []
  for (const item of details) {
    warn(item, item.unit.id)
    const retired = retirementFor(item.unit.componentId, item.unit.kind, item.unit.id)
    if (retired) {
      if (retirementWins(item, retired, `${item.unit.kind}/${item.unit.id}`)) continue
      retired.effective = false
    }
    selectedDetails.push(item)
  }
  const areaEntities = new Set<string>()
  for (const area of result.areas) {
    areaEntities.add(entityKey(area.unit.componentId, 'component', area.unit.componentId))
    const suppressed = new Set(area.suppressed.map(entity => entityKey(area.unit.componentId, entity.kind, entity.id)))
    for (const entity of area.unit.entities) {
      const key = entityKey(area.unit.componentId, entity.kind, entity.id)
      if (!suppressed.has(key)) areaEntities.add(key)
    }
  }
  // A detail exists in the coherent view only while all of its references exist there too. A flow withheld
  // for a missing endpoint can invalidate a finding that cites that flow, then another finding citing it.
  // Start with every selected detail and remove invalid ones until references stop changing.
  const compatibleDetails = new Set(selectedDetails)
  let changed = true
  while (changed) {
    changed = false
    const activeEntities = new Set(areaEntities)
    for (const item of compatibleDetails) activeEntities.add(entityKey(item.unit.componentId, item.unit.kind, item.unit.id))
    for (const item of compatibleDetails) {
      if (item.unit.references.some(ref => !activeEntities.has(entityKey(ref.componentId, ref.kind, ref.id)))) {
        compatibleDetails.delete(item)
        changed = true
      }
    }
  }
  const activeEntities = new Set(areaEntities)
  for (const item of compatibleDetails) activeEntities.add(entityKey(item.unit.componentId, item.unit.kind, item.unit.id))
  const areaForKind = (kind: EntityKind) => kind === 'endpoint' || kind === 'schema' ? 'api'
    : kind === 'data' ? 'data' : kind === 'message' ? 'messaging' : kind === 'job' ? 'jobs' : null
  for (const item of selectedDetails) {
    const incompatible = item.unit.references.filter(ref => !activeEntities.has(entityKey(ref.componentId, ref.kind, ref.id)))
      .map(ref => ({ ...ref, areaRevision: result.areas.find(area => area.unit.componentId === ref.componentId
        && area.unit.area === areaForKind(ref.kind))?.unit.revision ?? null }))
    const resolved = { ...item, incompatible }
    if (item.unit.kind === 'flow') result.flows.push(resolved)
    else result.findings.push(resolved)
  }
  return result
}

/** Build a coherent active component view; incompatible details remain in the sidecar for explicit display. */
export function materializeResolvedCatalog(resolved: ResolvedCatalog): {
  components: Component[]; incompatible: ResolvedDetail[]
} {
  const components = new Map<string, Component>()
  const identity = resolved.areas.filter(item => item.unit.area === 'identity')
  for (const item of identity) components.set(item.unit.componentId, structuredClone(item.unit.value) as Component)
  const without = <T extends { id: string }>(items: T[] | undefined, area: ResolvedArea, kind: EntityKind) =>
    items?.filter(item => !area.suppressed.some(entry => entry.kind === kind && entry.id === item.id))
  for (const area of resolved.areas) {
    if (area.unit.area === 'identity') continue
    const component = components.get(area.unit.componentId)
    if (!component) throw new Error(`Catalog area has no component identity: ${area.unit.componentId}`)
    if (area.unit.area === 'api') {
      const api = structuredClone(area.unit.value) as Component['api']
      if (api) component.api = { ...api, endpoints: without(api.endpoints, area, 'endpoint') ?? [],
        ...(api.schemas ? { schemas: without(api.schemas, area, 'schema') } : {}) }
    } else if (area.unit.area === 'data') {
      const data = structuredClone(area.unit.value) as Component['data']
      if (data) component.data = { ...data, records: without(data.records, area, 'data') ?? [] }
    } else if (area.unit.area === 'messaging') {
      const messaging = structuredClone(area.unit.value) as Component['messaging']
      if (messaging) component.messaging = { ...messaging, messages: without(messaging.messages, area, 'message') ?? [] }
    } else if (area.unit.area === 'jobs') component.jobs = without(structuredClone(area.unit.value) as Component['jobs'], area, 'job')
    else if (area.unit.area === 'dependencies') {
      const dependencies = area.unit.value as Pick<Component, 'dependsOn' | 'unresolvedDependencies'>
      component.dependsOn = structuredClone(dependencies.dependsOn)
      component.unresolvedDependencies = structuredClone(dependencies.unresolvedDependencies)
    }
  }
  const incompatible = [...resolved.flows, ...resolved.findings].filter(item => item.incompatible.length)
  for (const [kind, items] of [['executionFlows', resolved.flows], ['findings', resolved.findings]] as const) {
    for (const item of items) {
      const component = components.get(item.unit.componentId)
      if (!component) throw new Error(`Catalog detail has no component identity: ${item.unit.componentId}`)
      if (item.incompatible.length) continue
      if (kind === 'executionFlows') component.executionFlows = [...component.executionFlows ?? [], structuredClone(item.unit.value) as NonNullable<Component['executionFlows']>[number]]
      else component.findings = [...component.findings ?? [], structuredClone(item.unit.value) as NonNullable<Component['findings']>[number]]
    }
  }
  for (const item of resolved.retirements) {
    if (!item.effective) continue
    const component = components.get(item.unit.componentId)
    if (!component) throw new Error(`Catalog retirement has no component identity: ${item.unit.componentId}`)
    component.retiredObservations = [...component.retiredObservations ?? [],
      structuredClone(item.unit.value) as NonNullable<Component['retiredObservations']>[number]]
  }
  return { components: [...components.values()].sort((a, b) => a.id.localeCompare(b.id)), incompatible }
}
