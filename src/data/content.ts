import { z } from 'zod'
import { documentSchemas, sectionSchemas, type FeatureRecord, type Member, type Project } from './content-schema.ts'
import { componentPath, componentKindLabel } from './component-structure.ts'
import { actionFlow } from './flow-context.ts'
import type { Component, Db, Feature, Product, Workspace } from './model.ts'
import type { FeatureSpec, SchemaField } from './spec.ts'

export type ContentDocuments = Record<string, unknown>
export class ContentError extends Error {
  issues: string[]
  constructor(issues: string[]) { super(`Content validation failed:\n${issues.map(issue => `• ${issue}`).join('\n')}`); this.name = 'ContentError'; this.issues = issues }
}
export interface ContentSnapshot extends Db { project: Project; members: Member[] }

/** Load a whole revision before exposing any of it. Same entry point for browser and CLI. */
export function loadContent(documents: ContentDocuments, liveMockIds: readonly string[] = []): ContentSnapshot {
  const issues: string[] = []
  const parsed: Record<string, unknown[]> = { workspace: [], product: [], component: [], member: [], feature: [] }
  const specs = new Map<string, FeatureSpec>()
  let project: Project | undefined
  const source = new Map<string, string>()
  for (const [file, input] of Object.entries(documents).sort(([a], [b]) => a.localeCompare(b))) {
    const entity = /^(workspaces|products|components|members)\/([^/]+)\.json$/.exec(file)
    const feature = /^features\/([^/]+)\/(feature|purpose|journey|design|flow|api|storage|tests)\.json$/.exec(file)
    const kind = file === 'project.json' ? 'project' : entity ? entity[1].slice(0, -1) : feature?.[2]
    if (!kind) { issues.push(`${file}: unrecognized content file`); continue }
    const schema = documentSchemas[kind as keyof typeof documentSchemas] as z.ZodType
    const result = schema.safeParse(input)
    if (!result.success) { for (const issue of result.error.issues) issues.push(`${file}:${issue.path.join('.') || '$'}: ${issue.message}`); continue }
    const data = result.data as { id: string }
    if (kind === 'project') project = result.data as Project
    else if (kind in sectionSchemas) {
      const featureId = feature![1]
      const spec = specs.get(featureId) ?? {}
      Object.assign(spec, { [kind]: data }); specs.set(featureId, spec)
    } else {
      const expectedId = entity?.[2] ?? feature![1]
      if (data.id !== expectedId) issues.push(`${file}: ID must match filename/folder "${expectedId}"`)
      const key = `${kind}:${data.id}`
      if (source.has(key)) issues.push(`${file}: duplicate ${key}, also in ${source.get(key)}`)
      source.set(key, file)
      parsed[kind].push(data)
    }
  }
  if (!project) issues.push('project.json: a valid versioned project configuration is required')
  if (issues.length) throw new ContentError(issues)
  const members = parsed.member as Member[]
  const workspaces = parsed.workspace as Workspace[]
  const products = parsed.product as Product[]
  const components = parsed.component as Component[]
  const records = parsed.feature as FeatureRecord[]
  const memberById = new Map(members.map(member => [member.id, member]))
  const features: Feature[] = records.map(record => ({ ...record, owner: memberById.get(record.ownerId)?.name ?? '', ...(specs.has(record.id) ? { spec: specs.get(record.id) } : {}) }))
  for (const id of specs.keys()) if (!records.some(record => record.id === id)) issues.push(`features/${id}: section documents require feature.json`)
  const workspaceById = new Map(workspaces.map(w => [w.id, w]))
  const productById = new Map(products.map(p => [p.id, p]))
  const componentById = new Map(components.map(c => [c.id, c]))
  const has = (map: Map<string, unknown>, id: string, path: string) => { if (!map.has(id)) issues.push(`${path}: unknown reference "${id}"`) }
  const unique = (values: string[], path: string) => { const seen = new Set<string>(); for (const value of values) { if (seen.has(value)) issues.push(`${path}: duplicate "${value}"`); seen.add(value) } }
  unique(workspaces.map(w => w.slug), 'workspaces.slug')
  for (const workspace of workspaces) {
    if (workspaces.some(other => other.id !== workspace.id && other.id === workspace.slug)) issues.push(`workspaces/${workspace.id}: slug conflicts with another workspace ID`)
    unique(products.filter(p => p.workspaceId === workspace.id).map(p => p.slug), `workspaces/${workspace.id}/products.slug`)
  }
  if (project!.viewerId) has(memberById, project!.viewerId, 'project.json:viewerId')
  for (const product of products) has(workspaceById, product.workspaceId, `products/${product.id}.json:workspaceId`)
  for (const component of components) {
    const path = `components/${component.id}.json`
    has(productById, component.productId, `${path}:productId`)
    if (component.parentId) {
      has(componentById, component.parentId, `${path}:parentId`)
      const parent = componentById.get(component.parentId)
      if (parent && parent.productId !== component.productId) issues.push(`${path}:parentId: parent must belong to the same product`)
      if (parent?.kind && !['service', 'module'].includes(parent.kind)) issues.push(`${path}:parentId: only a service or module can contain components`)
      if (component.kind === 'service' || component.kind === 'external-service') issues.push(`${path}:parentId: services and external providers must be top-level; use dependsOn for dependencies`)
      const seen = new Set([component.id])
      let ancestor = parent
      while (ancestor) {
        if (seen.has(ancestor.id)) { issues.push(`${path}:parentId: containment cycle`); break }
        seen.add(ancestor.id); ancestor = componentById.get(ancestor.parentId ?? '')
      }
    }
    unique(component.dependsOn ?? [], `${path}:dependsOn`)
    for (const dependencyId of component.dependsOn ?? []) {
      has(componentById, dependencyId, `${path}:dependsOn`)
      if (dependencyId === component.id) issues.push(`${path}:dependsOn: cannot depend on itself`)
      const dependency = componentById.get(dependencyId)
      if (dependency && productById.get(dependency.productId)?.workspaceId !== productById.get(component.productId)?.workspaceId) issues.push(`${path}:dependsOn: dependency belongs to another workspace`)
    }
  }
  for (const feature of features) {
    const root = `features/${feature.id}`
    has(productById, feature.productId, `${root}/feature.json:productId`)
    has(memberById, feature.ownerId, `${root}/feature.json:ownerId`)
    unique(feature.touches, `${root}/feature.json:touches`)
    const workspaceId = productById.get(feature.productId)?.workspaceId
    const componentRef = (id: string, path: string) => {
      has(componentById, id, `${root}/${path}`)
      const owner = productById.get(componentById.get(id)?.productId ?? '')
      if (owner && workspaceId && owner.workspaceId !== workspaceId) issues.push(`${root}/${path}: component "${id}" belongs to another workspace`)
    }
    for (const id of feature.touches) componentRef(id, 'feature.json:touches')
    const spec = feature.spec ?? {}
    const sections = {
      journey: spec.journey?.steps ?? [], design: spec.design?.mockups ?? [], flow: spec.flow?.nodes ?? [],
      edges: spec.flow?.edges ?? [], api: spec.api?.contracts ?? [], storage: spec.storage?.tables ?? [],
      tests: spec.tests?.cases ?? [], purpose: spec.purpose?.success ?? [],
    }
    for (const [section, items] of Object.entries(sections)) unique(items.map(item => item.id), `${root}/${section}:id`)
    const refs = (kind: keyof typeof sections, ids: string[] | undefined, path: string) => {
      unique(ids ?? [], `${root}/${path}`)
      for (const id of ids ?? []) if (!sections[kind].some(item => item.id === id)) issues.push(`${root}/${path}: unknown ${kind} reference "${id}"`)
    }
    for (const step of sections.journey) {
      refs('flow', step.flow, `journey.json:${step.id}.flow`); refs('edges', step.flowEdges, `journey.json:${step.id}.flowEdges`)
      refs('api', step.contracts, `journey.json:${step.id}.contracts`); refs('design', step.design ? [step.design] : [], `journey.json:${step.id}.design`)
      for (const edgeId of step.flowEdges ?? []) {
        const edge = sections.edges.find(edge => edge.id === edgeId)
        if (edge && (!step.flow?.includes(edge.from) || !step.flow.includes(edge.to))) issues.push(`${root}/journey.json:${step.id}: edge ${edgeId} leaves this action's nodes`)
      }
      const action = actionFlow(spec, step)
      unique(action.nodes.map(node => `${node.col}:${node.row}`), `${root}/journey.json:${step.id}.flow positions`)
      for (const contract of step.contracts ?? []) if (!action.edges.some(edge => edge.contracts?.includes(contract))) issues.push(`${root}/journey.json:${step.id}: contract ${contract} has no boundary in this action`)
    }
    for (const node of sections.flow) {
      if (node.component) componentRef(node.component, `flow.json:${node.id}.component`)
      refs('storage', node.tables, `flow.json:${node.id}.tables`)
      if (node.logic && node.kind !== 'decision') issues.push(`${root}/flow.json:${node.id}: only a decision can have logic`)
      for (const branch of node.logic?.branches ?? []) {
        refs('edges', [branch.edgeId], `flow.json:${node.id}.logic`)
        const edge = sections.edges.find(edge => edge.id === branch.edgeId)
        if (edge && edge.from !== node.id) issues.push(`${root}/flow.json:${node.id}: branch must leave this decision`)
      }
    }
    for (const edge of sections.edges) {
      refs('flow', [edge.from, ...(edge.to !== edge.from ? [edge.to] : [])], `flow.json:${edge.id}`); refs('api', edge.contracts, `flow.json:${edge.id}.contracts`)
      const from = sections.flow.find(node => node.id === edge.from)?.component
      const to = sections.flow.find(node => node.id === edge.to)?.component
      for (const id of edge.contracts ?? []) {
        const contract = sections.api.find(contract => contract.id === id)
        if (contract && (contract.from !== from || contract.to !== to)) issues.push(`${root}/flow.json:${edge.id}: contract ${id} does not match the boundary's components`)
      }
    }
    const fields = (items: SchemaField[] | undefined, path: string) => { unique((items ?? []).map(field => field.name), `${root}/${path}`); for (const field of items ?? []) fields(field.fields, `${path}.${field.name}`) }
    for (const contract of sections.api) {
      componentRef(contract.from, `api.json:${contract.id}.from`); componentRef(contract.to, `api.json:${contract.id}.to`)
      fields(contract.responseSchema?.before, `api.json:${contract.id}.responseSchema.before`); fields(contract.responseSchema?.after, `api.json:${contract.id}.responseSchema.after`)
    }
    for (const table of sections.storage) { componentRef(table.component, `storage.json:${table.id}.component`); unique(table.columns.map(column => column.name), `${root}/storage.json:${table.id}.columns`) }
    for (const test of sections.tests) { refs('journey', test.steps, `tests.json:${test.id}.steps`); refs('api', test.contracts, `tests.json:${test.id}.contracts`); refs('storage', test.tables, `tests.json:${test.id}.tables`) }
    for (const criterion of sections.purpose) refs('tests', criterion.tests, `purpose.json:${criterion.id}.tests`)
    for (const mock of sections.design) {
      if (mock.kind === 'live' && !liveMockIds.includes(mock.ref)) issues.push(`${root}/design.json:${mock.id}: unregistered live prototype "${mock.ref}"`)
      const localImage = mock.kind === 'image' && /^(?:\/images\/|assets\/)(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp|gif|avif)$/.test(mock.ref)
      if (mock.kind !== 'live' && !localImage) { try { if (!['http:', 'https:'].includes(new URL(mock.ref).protocol)) throw new Error() } catch { issues.push(`${root}/design.json:${mock.id}: external reference must be an http(s) URL or a raster image under assets/ or /images/`) } }
    }
  }
  if (issues.length) throw new ContentError(issues)
  const displayOrder = (a: { order?: number; name: string }, b: { order?: number; name: string }) =>
    (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name)
  return { project: project!, members, workspaces: workspaces.sort(displayOrder), products: products.sort(displayOrder), components: components.sort(displayOrder), features }
}

/** Pure repository factory; UI queries and a future API adapter share this boundary. */
export function createRepository(snapshot: ContentSnapshot) {
  const products = new Map(snapshot.products.map(p => [p.id, p]))
  const components = new Map(snapshot.components.map(c => [c.id, c]))
  const workspaces = new Map(snapshot.workspaces.flatMap(w => [[w.id, w], [w.slug, w]] as const))
  const byUpdated = (a: Feature, b: Feature) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.id.localeCompare(b.id)
  const q = {
    workspaces: () => snapshot.workspaces,
    workspace: (idOrSlug: string) => workspaces.get(idOrSlug),
    products: (workspaceId?: string) => workspaceId ? snapshot.products.filter(p => p.workspaceId === workspaceId) : snapshot.products,
    product: (id: string) => products.get(id),
    components: (productId?: string) => productId ? snapshot.components.filter(c => c.productId === productId) : snapshot.components,
    component: (id: string) => components.get(id),
    componentLabel: (id: string) => componentPath(id, snapshot.components),
    componentType: (id: string) => { const c = components.get(id); return c ? componentKindLabel(c) : undefined },
    features: (productId?: string) => snapshot.features.filter(f => !productId || f.productId === productId).sort(byUpdated),
    featuresInWorkspace: (workspaceId: string) => snapshot.features.filter(f => products.get(f.productId)?.workspaceId === workspaceId).sort(byUpdated),
    viewer: () => snapshot.members.find(member => member.id === snapshot.project.viewerId),
  }
  return { db: snapshot, q }
}
