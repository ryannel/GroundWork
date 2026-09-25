import type { z } from 'zod'
import {
  componentReadSchema, featureSchema, memberSchema, productSchema, projectSchema, sectionSchemas, workspaceSchema,
  type FeatureRecord, type Member, type Project,
} from './content-schema.ts'
import { componentRepositories, referenceKey, resolveComponentReference } from './component-reference.ts'
import { componentKindLabel } from './component-structure.ts'
import { apiProvider } from './api-reference.ts'
import { actionFlow } from './flow-context.ts'
import { executionFlowIssues } from './execution-flow.ts'
import type { Component, Db, Feature, Product, Workspace } from './model.ts'
import type { FeatureSpec, SchemaField } from './spec.ts'

export type ContentDocuments = Record<string, unknown>
export class ContentError extends Error {
  issues: string[]
  constructor(issues: string[]) {
    super(`Content validation failed:\n${issues.map(issue => `• ${issue}`).join('\n')}`)
    this.name = 'ContentError'
    this.issues = issues
  }
}
export interface ContentSnapshot extends Db { project: Project; members: Member[] }

/** Documents parsed into typed buckets; nothing cross-referenced yet. */
interface ParsedDocuments {
  project?: Project
  members: Member[]
  workspaces: Workspace[]
  products: Product[]
  components: Component[]
  records: FeatureRecord[]
  specs: Map<string, FeatureSpec>
}
type SectionKind = keyof typeof sectionSchemas
const isSection = (kind: string): kind is SectionKind => Object.hasOwn(sectionSchemas, kind)
/** Typed dispatch: each section document parses to the matching member of a feature spec. */
const sectionParsers: { [K in SectionKind]: z.ZodType<NonNullable<FeatureSpec[K]>> } = sectionSchemas

/** Reports file- and JSON-path-qualified shape issues; returns the parsed value when valid. */
function parseWith<T>(schema: z.ZodType<T>, file: string, input: unknown, issues: string[]): T | undefined {
  const result = schema.safeParse(input)
  if (result.success) return result.data
  for (const issue of result.error.issues) issues.push(`${file}:${issue.path.join('.') || '$'}: ${issue.message}`)
  return undefined
}

export function parseDocuments(documents: ContentDocuments): { parsed: ParsedDocuments; issues: string[] } {
  const issues: string[] = []
  const parsed: ParsedDocuments = { members: [], workspaces: [], products: [], components: [], records: [], specs: new Map() }
  const source = new Map<string, string>()
  const entity = <T extends { id: string }>(bucket: T[], kind: string, file: string, expectedId: string, value: T | undefined) => {
    if (!value) return
    if (value.id !== expectedId) issues.push(`${file}: ID must match filename/folder "${expectedId}"`)
    const key = `${kind}:${value.id}`
    if (source.has(key)) issues.push(`${file}: duplicate ${key}, also in ${source.get(key)}`)
    source.set(key, file)
    bucket.push(value)
  }
  const section = <K extends SectionKind>(featureId: string, kind: K, file: string, input: unknown) => {
    const value = parseWith(sectionParsers[kind], file, input, issues)
    if (!value) return
    const spec = parsed.specs.get(featureId) ?? {}
    spec[kind] = value
    parsed.specs.set(featureId, spec)
  }
  for (const [file, input] of Object.entries(documents).sort(([a], [b]) => a.localeCompare(b))) {
    const entityFile = /^(workspaces|products|components|members)\/([^/]+)\.json$/.exec(file)
    const featureFile = /^features\/([^/]+)\/(feature|purpose|journey|design|flow|api|storage|tests)\.json$/.exec(file)
    if (file === 'project.json') parsed.project = parseWith(projectSchema, file, input, issues)
    else if (entityFile) {
      const [, folder, id] = entityFile
      if (folder === 'workspaces') entity(parsed.workspaces, 'workspace', file, id, parseWith(workspaceSchema, file, input, issues))
      else if (folder === 'products') entity(parsed.products, 'product', file, id, parseWith(productSchema, file, input, issues))
      else if (folder === 'components') entity(parsed.components, 'component', file, id, parseWith(componentReadSchema, file, input, issues))
      else entity(parsed.members, 'member', file, id, parseWith(memberSchema, file, input, issues))
    } else if (featureFile) {
      const [, featureId, kind] = featureFile
      if (kind === 'feature') entity(parsed.records, 'feature', file, featureId, parseWith(featureSchema, file, input, issues))
      else if (isSection(kind)) section(featureId, kind, file, input)
    } else issues.push(`${file}: unrecognized content file`)
  }
  if (!parsed.project) issues.push('project.json: a valid versioned project configuration is required')
  return { parsed, issues }
}

/** Lookups shared by every cross-reference rule, built once per revision. */
export interface ContentContext {
  project: Project
  workspaces: Workspace[]
  products: Product[]
  memberById: Map<string, Member>
  workspaceById: Map<string, Workspace>
  productById: Map<string, Product>
  componentById: Map<string, Component>
  /** Which repository each catalogued component belongs to, so a reference can be resolved to one. */
  componentRepository: Map<string, string | undefined>
}

function checker(issues: string[]) {
  return {
    has: (map: Map<string, unknown>, id: string, path: string) => { if (!map.has(id)) issues.push(`${path}: unknown reference "${id}"`) },
    unique: (values: string[], path: string) => {
      const seen = new Set<string>()
      for (const value of values) { if (seen.has(value)) issues.push(`${path}: duplicate "${value}"`); seen.add(value) }
    },
  }
}

/** Workspaces, products, project viewer and routing slugs. */
export function validateStructure(ctx: ContentContext): string[] {
  const issues: string[] = []
  const { has, unique } = checker(issues)
  unique(ctx.workspaces.map(w => w.slug), 'workspaces.slug')
  for (const workspace of ctx.workspaces) {
    if (workspace.slug !== workspace.id && ctx.workspaceById.has(workspace.slug)) {
      issues.push(`workspaces/${workspace.id}: slug conflicts with another workspace ID`)
    }
    unique(ctx.products.filter(p => p.workspaceId === workspace.id).map(p => p.slug), `workspaces/${workspace.id}/products.slug`)
  }
  if (ctx.project.viewerId) has(ctx.memberById, ctx.project.viewerId, 'project.json:viewerId')
  for (const product of ctx.products) has(ctx.workspaceById, product.workspaceId, `products/${product.id}.json:workspaceId`)
  return issues
}

/** Catalog integrity for one component: findings, containment, dependencies and execution flows. */
export function validateComponent(component: Component, ctx: ContentContext): string[] {
  const issues: string[] = []
  const { has, unique } = checker(issues)
  const path = `components/${component.id}.json`
  issues.push(...executionFlowIssues(component, ctx.componentRepository).map(issue => `${path}:executionFlows: ${issue}`))
  unique((component.findings ?? []).map(finding => finding.id), `${path}:findings`)
  for (const finding of component.findings ?? []) {
    if (finding.repository !== component.repo) issues.push(`${path}:finding ${finding.id}: repository must match its component`)
    for (const evidence of finding.evidence) {
      if (evidence.revision !== finding.sourceRevision) issues.push(`${path}:finding ${finding.id}: inconsistent observation revision`)
    }
    // Missing subjects remain historical observations, never inferred active entities.
  }
  has(ctx.productById, component.productId, `${path}:productId`)
  if (component.parentId) {
    has(ctx.componentById, component.parentId, `${path}:parentId`)
    const parent = ctx.componentById.get(component.parentId)
    if (parent && parent.productId !== component.productId) issues.push(`${path}:parentId: parent must belong to the same product`)
    if (parent?.kind && !['service', 'module'].includes(parent.kind)) issues.push(`${path}:parentId: only a service or module can contain components`)
    if (component.kind === 'service' || component.kind === 'external-service') {
      issues.push(`${path}:parentId: services and external providers must be top-level; use dependsOn for dependencies`)
    }
    const seen = new Set([component.id])
    let ancestor = parent
    while (ancestor) {
      if (seen.has(ancestor.id)) { issues.push(`${path}:parentId: containment cycle`); break }
      seen.add(ancestor.id); ancestor = ctx.componentById.get(ancestor.parentId ?? '')
    }
  }
  // Two references that resolve to the same component are one dependency, whichever form each was written in.
  unique((component.dependsOn ?? []).map(reference => referenceKey(reference, ctx.componentRepository)), `${path}:dependsOn`)
  const workspaceId = ctx.productById.get(component.productId)?.workspaceId
  for (const reference of component.dependsOn ?? []) {
    const resolved = resolveComponentReference(reference, ctx.componentRepository)
    // A bare name can only mean a component of this catalog, so an unknown one is an error. A qualified reference
    // names another repository's component, which this home need not hold; it stays unresolved instead.
    if (!resolved.resolved) {
      if (typeof reference === 'string') has(ctx.componentById, reference, `${path}:dependsOn`)
      continue
    }
    if (resolved.component === component.id) issues.push(`${path}:dependsOn: cannot depend on itself`)
    const dependency = ctx.componentById.get(resolved.component)
    if (dependency && ctx.productById.get(dependency.productId)?.workspaceId !== workspaceId) {
      issues.push(`${path}:dependsOn: dependency belongs to another workspace`)
    }
  }
  return issues
}

const localImage = /^(?:\/images\/|assets\/)(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp|gif|avif)$/
const isHttpUrl = (value: string) => { try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false } }

/** Feature record references plus every cross-section link in its spec. */
export function validateFeatureSpec(feature: Feature, ctx: ContentContext): string[] {
  const issues: string[] = []
  const { has, unique } = checker(issues)
  const root = `features/${feature.id}`
  has(ctx.productById, feature.productId, `${root}/feature.json:productId`)
  has(ctx.memberById, feature.ownerId, `${root}/feature.json:ownerId`)
  unique(feature.touches, `${root}/feature.json:touches`)
  const workspaceId = ctx.productById.get(feature.productId)?.workspaceId
  const componentRef = (id: string, path: string) => {
    has(ctx.componentById, id, `${root}/${path}`)
    const owner = ctx.productById.get(ctx.componentById.get(id)?.productId ?? '')
    if (owner && workspaceId && owner.workspaceId !== workspaceId) issues.push(`${root}/${path}: component "${id}" belongs to another workspace`)
  }
  for (const id of feature.touches) componentRef(id, 'feature.json:touches')
  const spec = feature.spec ?? {}
  const sections = {
    journey: spec.journey?.steps ?? [], design: spec.design?.mockups ?? [], flow: spec.flow?.nodes ?? [],
    edges: spec.flow?.edges ?? [], api: spec.api?.contracts ?? [], storage: spec.storage?.tables ?? [],
    tests: spec.tests?.cases ?? [], purpose: spec.purpose?.success ?? [],
  }
  const nodeById = new Map(sections.flow.map(node => [node.id, node]))
  const edgeById = new Map(sections.edges.map(edge => [edge.id, edge]))
  const contractById = new Map(sections.api.map(contract => [contract.id, contract]))
  const idsOf = Object.fromEntries(Object.entries(sections).map(([kind, items]) => [kind, new Set(items.map(item => item.id))])) as
    Record<keyof typeof sections, Set<string>>
  for (const [section, items] of Object.entries(sections)) unique(items.map(item => item.id), `${root}/${section}:id`)
  const refs = (kind: keyof typeof sections, ids: string[] | undefined, path: string) => {
    unique(ids ?? [], `${root}/${path}`)
    for (const id of ids ?? []) if (!idsOf[kind].has(id)) issues.push(`${root}/${path}: unknown ${kind} reference "${id}"`)
  }
  for (const step of sections.journey) {
    refs('flow', step.flow, `journey.json:${step.id}.flow`); refs('edges', step.flowEdges, `journey.json:${step.id}.flowEdges`)
    refs('api', step.contracts, `journey.json:${step.id}.contracts`); refs('design', step.design ? [step.design] : [], `journey.json:${step.id}.design`)
    for (const edgeId of step.flowEdges ?? []) {
      const edge = edgeById.get(edgeId)
      if (edge && (!step.flow?.includes(edge.from) || !step.flow.includes(edge.to))) {
        issues.push(`${root}/journey.json:${step.id}: edge ${edgeId} leaves this action's nodes`)
      }
    }
    const action = actionFlow(spec, step)
    unique(action.nodes.map(node => `${node.col}:${node.row}`), `${root}/journey.json:${step.id}.flow positions`)
    for (const contract of step.contracts ?? []) {
      if (!action.edges.some(edge => edge.contracts?.includes(contract))) {
        issues.push(`${root}/journey.json:${step.id}: contract ${contract} has no boundary in this action`)
      }
    }
  }
  for (const node of sections.flow) {
    if (node.component) componentRef(node.component, `flow.json:${node.id}.component`)
    refs('storage', node.tables, `flow.json:${node.id}.tables`)
    if (node.logic && node.kind !== 'decision') issues.push(`${root}/flow.json:${node.id}: only a decision can have logic`)
    for (const branch of node.logic?.branches ?? []) {
      refs('edges', [branch.edgeId], `flow.json:${node.id}.logic`)
      const edge = edgeById.get(branch.edgeId)
      if (edge && edge.from !== node.id) issues.push(`${root}/flow.json:${node.id}: branch must leave this decision`)
    }
  }
  for (const edge of sections.edges) {
    refs('flow', [edge.from, ...(edge.to !== edge.from ? [edge.to] : [])], `flow.json:${edge.id}`)
    refs('api', edge.contracts, `flow.json:${edge.id}.contracts`)
    const from = nodeById.get(edge.from)?.component
    const to = nodeById.get(edge.to)?.component
    for (const id of edge.contracts ?? []) {
      const contract = contractById.get(id)
      if (contract && (contract.from !== from || contract.to !== to)) {
        issues.push(`${root}/flow.json:${edge.id}: contract ${id} does not match the boundary's components`)
      }
    }
  }
  const fields = (items: SchemaField[] | undefined, path: string) => {
    unique((items ?? []).map(field => field.name), `${root}/${path}`)
    for (const field of items ?? []) fields(field.fields, `${path}.${field.name}`)
  }
  for (const contract of sections.api) {
    componentRef(contract.from, `api.json:${contract.id}.from`); componentRef(contract.to, `api.json:${contract.id}.to`)
    fields(contract.responseSchema?.before, `api.json:${contract.id}.responseSchema.before`)
    fields(contract.responseSchema?.after, `api.json:${contract.id}.responseSchema.after`)
  }
  unique((spec.api?.guides ?? []).map(g => g.componentId), `${root}/api.json:guides.componentId`)
  for (const guide of spec.api?.guides ?? []) {
    componentRef(guide.componentId, 'api.json:guides.componentId')
    unique(guide.capabilities.map(c => c.id), `${root}/api.json:guides.${guide.componentId}.capabilities`)
    for (const capability of guide.capabilities) {
      refs('api', capability.contractIds, `api.json:guides.${guide.componentId}.${capability.id}`)
      for (const id of capability.contractIds) {
        const contract = contractById.get(id)
        if (contract && apiProvider(contract) !== guide.componentId) {
          issues.push(`${root}/api.json:guide ${guide.componentId}: contract ${id} belongs to another component's API`)
        }
      }
    }
  }
  for (const table of sections.storage) {
    componentRef(table.component, `storage.json:${table.id}.component`)
    unique(table.columns.map(column => column.name), `${root}/storage.json:${table.id}.columns`)
  }
  for (const test of sections.tests) {
    refs('journey', test.steps, `tests.json:${test.id}.steps`); refs('api', test.contracts, `tests.json:${test.id}.contracts`)
    refs('storage', test.tables, `tests.json:${test.id}.tables`)
  }
  for (const criterion of sections.purpose) refs('tests', criterion.tests, `purpose.json:${criterion.id}.tests`)
  for (const mock of sections.design) {
    if (mock.kind === 'live') issues.push(`${root}/design.json:${mock.id}: live prototypes are not supported; use an image or an external URL`)
    if (mock.kind !== 'live' && !(mock.kind === 'image' && localImage.test(mock.ref)) && !isHttpUrl(mock.ref)) {
      issues.push(`${root}/design.json:${mock.id}: external reference must be an http(s) URL or a raster image under assets/ or /images/`)
    }
  }
  return issues
}

export function contentContext(
  parts: Pick<ContentSnapshot, 'project' | 'members' | 'workspaces' | 'products' | 'components'>,
  homeRepository?: string,
): ContentContext {
  const { project, members, workspaces, products, components } = parts
  return {
    project, workspaces, products,
    memberById: new Map(members.map(member => [member.id, member])),
    workspaceById: new Map(workspaces.map(w => [w.id, w])),
    productById: new Map(products.map(p => [p.id, p])),
    componentById: new Map(components.map(c => [c.id, c])),
    componentRepository: componentRepositories(components, homeRepository),
  }
}

const displayOrder = (a: { order?: number; name: string }, b: { order?: number; name: string }) =>
  (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name)

/** Load a whole revision before exposing any of it. Same entry point for browser and CLI. */
export function loadContent(documents: ContentDocuments, homeRepository?: string): ContentSnapshot {
  const { parsed, issues } = parseDocuments(documents)
  if (issues.length || !parsed.project) throw new ContentError(issues)
  const { project, members, workspaces, products, components, records, specs } = parsed
  const ctx = contentContext({ project, members, workspaces, products, components }, homeRepository)
  const recordIds = new Set(records.map(record => record.id))
  const features: Feature[] = records.map(record => {
    const spec = specs.get(record.id)
    return { ...record, owner: ctx.memberById.get(record.ownerId)?.name ?? '', ...(spec ? { spec } : {}) }
  })
  for (const id of specs.keys()) if (!recordIds.has(id)) issues.push(`features/${id}: section documents require feature.json`)
  issues.push(...validateStructure(ctx))
  for (const component of components) issues.push(...validateComponent(component, ctx))
  for (const feature of features) issues.push(...validateFeatureSpec(feature, ctx))
  if (issues.length) throw new ContentError(issues)
  return {
    project, members, features,
    workspaces: workspaces.sort(displayOrder), products: products.sort(displayOrder), components: components.sort(displayOrder),
  }
}

/** Pure repository factory; UI queries and a future API adapter share this boundary. Indexes are built once per snapshot. */
export function createRepository(snapshot: ContentSnapshot) {
  const products = new Map(snapshot.products.map(p => [p.id, p]))
  const components = new Map(snapshot.components.map(c => [c.id, c]))
  const workspaces = new Map(snapshot.workspaces.flatMap(w => [[w.id, w], [w.slug, w]] as const))
  const children = new Map<string, Component[]>()
  for (const c of snapshot.components) if (c.parentId) children.set(c.parentId, [...(children.get(c.parentId) ?? []), c])
  const scopes = new Map<string, ReadonlySet<string>>()
  const ancestorPaths = new Map<string, Component[]>()
  const byUpdated = (a: Feature, b: Feature) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.id.localeCompare(b.id)
  /** A component and everything it contains. Containment only: depending on a resource never makes it part of the service. */
  const scope = (id: string): ReadonlySet<string> => {
    let ids = scopes.get(id)
    if (ids) return ids
    const found = new Set([id])
    for (const current of found) for (const child of children.get(current) ?? []) found.add(child.id)
    scopes.set(id, ids = found)
    return ids
  }
  /** Containment path from the top-level owner down to the component itself. */
  const ancestors = (id: string): Component[] => {
    let path = ancestorPaths.get(id)
    if (path) return path
    path = []
    const seen = new Set<string>()
    for (let c = components.get(id); c && !seen.has(c.id); c = c.parentId ? components.get(c.parentId) : undefined) { seen.add(c.id); path.unshift(c) }
    ancestorPaths.set(id, path)
    return path
  }
  const q = {
    workspaces: () => snapshot.workspaces,
    workspace: (idOrSlug: string) => workspaces.get(idOrSlug),
    products: (workspaceId?: string) => workspaceId ? snapshot.products.filter(p => p.workspaceId === workspaceId) : snapshot.products,
    product: (id: string) => products.get(id),
    components: (productId?: string) => productId ? snapshot.components.filter(c => c.productId === productId) : snapshot.components,
    component: (id: string) => components.get(id),
    scope,
    ancestors,
    /** Whether a feature touches the component or anything it contains. */
    touches: (feature: Pick<Feature, 'touches'>, componentId: string) => { const ids = scope(componentId); return feature.touches.some(id => ids.has(id)) },
    componentLabel: (id: string) => ancestors(id).map(c => c.name).join(' / '),
    componentType: (id: string) => { const c = components.get(id); return c ? componentKindLabel(c) : undefined },
    features: (productId?: string) => snapshot.features.filter(f => !productId || f.productId === productId).sort(byUpdated),
    featuresInWorkspace: (workspaceId: string) => snapshot.features.filter(f => products.get(f.productId)?.workspaceId === workspaceId).sort(byUpdated),
    viewer: () => snapshot.members.find(member => member.id === snapshot.project.viewerId),
  }
  return { db: snapshot, q }
}
export type Repository = ReturnType<typeof createRepository>
export type RepositoryQueries = Repository['q']
