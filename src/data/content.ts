import type { z } from 'zod'
import {
  componentReadSchema, featureSchema, memberSchema, productReadSchema, projectSchema, sectionSchemas, workspaceSchema,
  type FeatureRecord, type Member, type Project,
} from './content-schema.ts'
import { componentRepositories, referenceKey, resolveComponentReference } from './component-reference.ts'
import { componentKindLabel } from './component-structure.ts'
import { apiProvider } from './api-reference.ts'
import { actionFlow } from './flow-context.ts'
import { executionFlowIssues } from './execution-flow.ts'
import { isProvisional, parseRemote, repositoryIdentity } from './repository-identity.ts'
import type { Component, Db, Feature, Product, ProductRepository, Workspace } from './model.ts'
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
export interface ContentSnapshot extends Db { project: Project; members: Member[]; homeRepository?: string }

/** A product can own a whole repository or selected directory patterns within it. `*` matches within one path segment. */
const sameRepository = (left: string, right: string) => repositoryIdentity(left) === repositoryIdentity(right)
/** Aliases are repository identity facts shared by every product in the loaded home. */
const resolvedRepository = (value: string, products: Product[]) => {
  let current = repositoryIdentity(value)
  const seen = new Set<string>()
  while (true) {
    if (seen.has(current)) return [...seen].sort()[0]
    seen.add(current)
    const entry = products.flatMap(product => product.repositories ?? []).find(candidate =>
      candidate.aliases?.some(alias => sameRepository(alias, current)))
    if (!entry) break
    current = repositoryIdentity(entry.repository)
  }
  return current
}
const pathSegments = (value: string) => value === '.' ? [] : value.replace(/^\.\//, '').split('/')
const segmentMatches = (pattern: string, value: string) =>
  new RegExp(`^${pattern.split('*').map(part => part.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')).join('.*')}$`).test(value)
export const pathPatternCovers = (pattern: string, sourcePath = '.') => {
  const expected = pathSegments(pattern), actual = pathSegments(sourcePath)
  return expected.length <= actual.length && expected.every((segment, index) => segmentMatches(segment, actual[index]))
}
/** Whether two per-segment `*` patterns can match any common directory name. */
function segmentPatternsOverlap(left: string, right: string) {
  const alphabet = [...new Set([...left.replaceAll('*', ''), ...right.replaceAll('*', ''), '\0'])]
  const queue: [number, number][] = [[0, 0]], seen = new Set<string>()
  for (let offset = 0; offset < queue.length; offset++) {
    const [a, b] = queue[offset], key = `${a}:${b}`
    if (seen.has(key)) continue
    seen.add(key)
    if (a === left.length && b === right.length) return true
    if (left[a] === '*') queue.push([a + 1, b])
    if (right[b] === '*') queue.push([a, b + 1])
    for (const character of alphabet) {
      const nextA = left[a] === '*' ? a : left[a] === character ? a + 1 : -1
      const nextB = right[b] === '*' ? b : right[b] === character ? b + 1 : -1
      if (nextA >= 0 && nextB >= 0) queue.push([nextA, nextB])
    }
  }
  return false
}
export const pathPatternsOverlap = (left: string, right: string) => {
  const a = pathSegments(left), b = pathSegments(right)
  return a.slice(0, Math.min(a.length, b.length)).every((segment, index) => segmentPatternsOverlap(segment, b[index]))
}
const repositoryEntryMatches = (entry: ProductRepository, repository: string, products: Product[]) =>
  resolvedRepository(entry.repository, products) === resolvedRepository(repository, products)
const repositoryEntryCovers = (entry: ProductRepository, sourcePath?: string) =>
  !entry.paths?.length || entry.paths.some(pattern => pathPatternCovers(pattern, sourcePath))

/** Membership is derived from the product's declarations. Legacy products keep their component `productId` meaning. */
export function componentMembership(
  component: Pick<Component, 'repo' | 'sourcePath' | 'productId'>,
  products: Product[], homeRepository?: string,
): { ownedBy: string | null; usedBy: string[]; productIds: string[]; conflictingOwners: string[] } {
  const repository = component.repo ?? homeRepository
  const declaredOwners: string[] = [], legacyOwners: string[] = [], used: string[] = []
  for (const product of products) {
    if (component.repo === undefined && component.productId === product.id) { legacyOwners.push(product.id); continue }
    if (component.repo === undefined && component.productId !== undefined) continue
    const declared = product.repositories
    if (declared) {
      if (!repository) continue
      for (const entry of declared) {
        if (!repositoryEntryMatches(entry, repository, products) || !repositoryEntryCovers(entry, component.sourcePath)) continue
        const target = entry.role === 'owned' ? declaredOwners : used
        if (!target.includes(product.id)) target.push(product.id)
      }
    } else if (component.productId === product.id) legacyOwners.push(product.id)
  }
  // A pre-migration product can remain beside a migrated declaration after a branch merge. The new declaration
  // owns the path; the old component productId is only the fallback when no declaration claims it.
  const owned = declaredOwners.length ? declaredOwners : legacyOwners
  if (!owned.length && products.length === 1 && products[0].repositories === undefined
    && repository && homeRepository && sameRepository(repository, homeRepository)) {
    const sole = products[0]
    owned.push(sole.id)
  }
  const productIds = [...new Set([...owned, ...used])]
  return { ownedBy: owned.length === 1 ? owned[0] : null, usedBy: used, productIds, conflictingOwners: owned.length > 1 ? owned : [] }
}
export const productComponents = (snapshot: Pick<ContentSnapshot, 'products' | 'components' | 'homeRepository'>, productId: string,
  includeUsed = true) => snapshot.components.filter(component => {
    const membership = componentMembership(component, snapshot.products, snapshot.homeRepository)
    return membership.ownedBy === productId || includeUsed && membership.usedBy.includes(productId)
  })
/** What a legacy product shows as owned before its repositories are written by migration. */
export function productRepositories(product: Product, products: Product[], components: Component[], homeRepository?: string): ProductRepository[] {
  if (product.repositories) return product.repositories
  const repositories = new Map<string, ProductRepository>()
  // A sole legacy product implicitly owns its home repository even before a scan has produced a component there.
  // Scanning an external repository must not make that structural ownership disappear from the UI.
  if (products.length === 1 && homeRepository) {
    repositories.set(repositoryIdentity(homeRepository), { repository: repositoryIdentity(homeRepository), role: 'owned' })
  }
  for (const component of components) {
    if (component.productId !== product.id) continue
    const repository = component.repo ?? homeRepository
    if (repository) repositories.set(repositoryIdentity(repository), { repository: repositoryIdentity(repository), role: 'owned' })
  }
  return [...repositories.values()]
}

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
      else if (folder === 'products') entity(parsed.products, 'product', file, id, parseWith(productReadSchema, file, input, issues))
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
  membershipByComponent: Map<string, ReturnType<typeof componentMembership>>
  homeRepository?: string
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
  }
  // Viewer paths identify a product by its home repository and slug, independent of Hub workspace views.
  unique(ctx.products.map(p => p.slug), 'products.slug')
  if (ctx.project.viewerId) has(ctx.memberById, ctx.project.viewerId, 'project.json:viewerId')
  for (const product of ctx.products) if (product.workspaceId) {
    has(ctx.workspaceById, product.workspaceId, `products/${product.id}.json:workspaceId`)
  }
  issues.push(...validateProductRepositories(ctx.products))
  return issues
}

/** Ownership is checked even when no catalog exists: product declarations are the structure. */
export function validateProductRepositories(products: Product[]): string[] {
  const issues: string[] = []
  const claims: { productId: string; repository: string; pattern: string }[] = []
  const aliases = new Map<string, string>()
  for (const product of products) for (const [index, entry] of (product.repositories ?? []).entries()) {
    const path = `products/${product.id}.json:repositories.${index}`
    for (const value of [entry.repository, ...(entry.aliases ?? [])]) {
      if (!parseRemote(value) && !isProvisional(value)) issues.push(`${path}: unknown repository identity ${value}`)
    }
    for (const alias of entry.aliases ?? []) {
      const key = repositoryIdentity(alias), target = repositoryIdentity(entry.repository)
      const previous = aliases.get(key)
      if (previous && previous !== target) issues.push(`${path}: alias ${key} names both ${previous} and ${target}`)
      aliases.set(key, target)
    }
    if (new Set(entry.paths ?? []).size !== (entry.paths ?? []).length) issues.push(`${path}: duplicate path pattern`)
    if (entry.role === 'owned') {
      for (const pattern of entry.paths?.length ? entry.paths : ['.']) {
        claims.push({ productId: product.id, repository: resolvedRepository(entry.repository, products), pattern })
      }
    }
  }
  for (const start of aliases.keys()) {
    const seen = new Set<string>()
    let current: string | undefined = start
    while (current && aliases.has(current)) {
      if (seen.has(current)) {
        issues.push(`products.repositories: repository alias cycle involving ${[...seen].join(' → ')}`)
        break
      }
      seen.add(current)
      current = aliases.get(current)
    }
  }
  for (let index = 0; index < claims.length; index++) for (const next of claims.slice(index + 1)) {
    const claim = claims[index]
    if (claim.productId !== next.productId && claim.repository === next.repository
      && pathPatternsOverlap(claim.pattern, next.pattern)) {
      issues.push(`products/${claim.productId}.json and products/${next.productId}.json: overlapping ownership of ${claim.repository} (${claim.pattern} and ${next.pattern})`)
    }
  }
  return [...new Set(issues)]
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
  if (component.productId) has(ctx.productById, component.productId, `${path}:productId`)
  const membership = ctx.membershipByComponent.get(component.id)
  if (membership?.conflictingOwners.length) issues.push(`${path}: overlapping product ownership: ${membership.conflictingOwners.join(', ')}`)
  if (component.parentId) {
    has(ctx.componentById, component.parentId, `${path}:parentId`)
    const parent = ctx.componentById.get(component.parentId)
    if (parent) {
      const childProducts = membership?.productIds ?? []
      const parentProducts = ctx.membershipByComponent.get(parent.id)?.productIds ?? []
      if ((childProducts.length || parentProducts.length)
        && !childProducts.some(productId => parentProducts.includes(productId))) {
        issues.push(`${path}:parentId: parent must belong to the same product`)
      }
    }
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
  const workspaceIds = new Set(membership?.productIds.map(id => ctx.productById.get(id)?.workspaceId) ?? [])
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
    const dependencyWorkspaceIds = ctx.membershipByComponent.get(dependency?.id ?? '')?.productIds
      .map(id => ctx.productById.get(id)?.workspaceId) ?? []
    if (dependency && workspaceIds.size && !dependencyWorkspaceIds.some(id => workspaceIds.has(id))) {
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
    const memberWorkspaces = ctx.membershipByComponent.get(id)?.productIds
      .map(productId => ctx.productById.get(productId)?.workspaceId) ?? []
    if (ctx.componentById.has(id) && (workspaceId
      ? !memberWorkspaces.includes(workspaceId)
      : !(ctx.membershipByComponent.get(id)?.productIds.length))) {
      issues.push(`${root}/${path}: component "${id}" belongs to another workspace`)
    }
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
    membershipByComponent: new Map(components.map(component => [component.id, componentMembership(component, products, homeRepository)])),
    homeRepository,
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
    project, members, features, homeRepository,
    workspaces: workspaces.sort(displayOrder), products: products.sort(displayOrder), components: components.sort(displayOrder),
  }
}

/** Pure repository factory; UI queries and a future API adapter share this boundary. Indexes are built once per snapshot. */
export function createRepository(snapshot: ContentSnapshot) {
  const products = new Map(snapshot.products.map(p => [p.id, p]))
  const components = new Map(snapshot.components.map(c => [c.id, c]))
  const memberships = new Map(snapshot.components.map(c => [c.id, componentMembership(c, snapshot.products, snapshot.homeRepository)]))
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
    workspace: (idOrSlug?: string) => idOrSlug ? workspaces.get(idOrSlug) : undefined,
    products: (workspaceId?: string) => workspaceId ? snapshot.products.filter(p => p.workspaceId === workspaceId) : snapshot.products,
    product: (id: string) => products.get(id),
    productRepositories: (id: string) => {
      const product = products.get(id)
      return product ? productRepositories(product, snapshot.products, snapshot.components, snapshot.homeRepository) : []
    },
    componentOwner: (id: string) => products.get(memberships.get(id)?.ownedBy ?? ''),
    components: (productId?: string) => productId ? productComponents(snapshot, productId) : snapshot.components,
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
