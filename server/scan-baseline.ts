import { catalogId } from '../src/data/catalog-identity.ts'
import type { Component } from '../src/data/model.ts'
import { applyRepositoryScanSchema, scanAreas, type RepositoryDiscovery, type ScanArea } from '../src/data/scan-schema.ts'
import { repositoryKey } from './catalog-freshness.ts'
import { Conflict, InvalidInput, NotFound } from './errors.ts'
import { digest } from './git.ts'
import { readPlan, writePlan } from './repository.ts'
import { requireClaimEvidence, requireRetainedInventory, validateDiscoveryCitations } from './scan-evidence.ts'
import { scanManifest } from './scan-manifests.ts'
import { filesForProject } from './scan-projects.ts'
import { loadScan, removeScan } from './scan-workspace.ts'

type Coverage = NonNullable<NonNullable<Component['scan']>['coverage']>
type Gap = NonNullable<Component['gaps']>[number]

/** The scan area a gap belongs to, from its `area` prefix (`api`, `api.endpoints`, `messaging/delivery`). Other gaps are component-level. */
export function gapArea(area: string): ScanArea {
  const lower = area.toLowerCase()
  return scanAreas.find(name => lower === name || (lower.startsWith(name) && /^[./:]/.test(lower.slice(name.length)))) ?? 'dependencies'
}

function unique<T>(items: T[]) {
  return [...new Map(items.map(item => [JSON.stringify(item), item])).values()]
}

export interface ScanContext {
  repository: string
  revision: string
  order: number
  sourceFingerprint: string
  scannedAt: string
}

/**
 * Merges one discovery into the stored component. Only the areas the discovery covers are replaced:
 * - dependency results (dependsOn, unresolvedDependencies) and component-level evidence change only with `dependencies` coverage;
 * - gaps are replaced per area;
 * - an area this scan did not examine keeps its state, except that `complete` becomes `partial` when it was recorded at
 *   another revision, so `scan.status` is `complete` only when every area was examined at this revision.
 */
export function mergeComponent(previous: Record<string, unknown> & Partial<Component>, discovery: RepositoryDiscovery, context: ScanContext) {
  const sameRevision = previous.scan?.revision === context.revision
  const coverage: Coverage = {}
  for (const area of scanAreas) {
    const before = previous.scan?.coverage?.[area]
    const state = discovery.coverage[area] ?? (before === 'complete' && !sameRevision ? 'partial' : before)
    if (state) coverage[area] = state
  }
  const scanned = new Set(scanAreas.filter(area => discovery.coverage[area]))
  const dependencies = scanned.has('dependencies')
  const gaps: Gap[] = [...(previous.gaps ?? []).filter(gap => !scanned.has(gapArea(gap.area))), ...(discovery.gaps ?? [])]
  const next: Record<string, unknown> = {
    ...previous,
    id: discovery.id,
    productId: discovery.productId,
    order: context.order,
    name: discovery.name,
    ...(discovery.kind ? { kind: discovery.kind } : {}),
    ...(discovery.description ? { description: discovery.description } : {}),
    ...(discovery.ownership ? { ownership: discovery.ownership } : {}),
    ...(discovery.role ? { role: discovery.role } : {}),
    repo: context.repository,
    sourcePath: discovery.sourcePath,
    sourceRevision: context.revision,
    evidence: dependencies ? discovery.evidence ?? [] : unique([...(previous.evidence ?? []), ...(discovery.evidence ?? [])]),
    gaps,
    scan: {
      status: scanAreas.every(area => coverage[area] === 'complete') ? 'complete' : 'partial',
      scannedAt: context.scannedAt,
      revision: context.revision,
      sourceFingerprint: context.sourceFingerprint,
      coverage,
    },
  }
  if (dependencies) {
    next.dependsOn = discovery.dependsOn ?? []
    next.unresolvedDependencies = discovery.unresolvedDependencies ?? []
  }
  for (const area of ['api', 'data', 'messaging'] as const) if (discovery.coverage[area]) next[area] = discovery[area]
  if (discovery.jobs !== undefined) next.jobs = discovery.jobs
  if (discovery.executionFlows !== undefined) next.executionFlows = discovery.executionFlows
  if ((next.dependsOn as unknown[] | undefined)?.length && !(next.evidence as unknown[]).length) {
    throw new InvalidInput(`${discovery.id}: resolved dependencies require evidence`)
  }
  return next
}

export async function applyRepositoryScan(root: string, input: unknown) {
  const args = applyRepositoryScanSchema.parse(input)
  const scan = await loadScan(args.scanId)
  const { directory, metadata } = scan
  if (metadata.incremental) {
    throw new InvalidInput('Incremental scans cannot replace catalog inventories; '
      + 'use apply_catalog_investigation for flows/findings or prepare a baseline scan for reconciled contracts')
  }
  const plan = await readPlan(root)
  if (plan.revision !== args.expectedRevision || plan.context.token !== args.expectedContext) {
    throw new Conflict('Stale edit: re-read the plan before applying repository discoveries')
  }
  if (plan.manifest.id !== metadata.targetProjectId || plan.context.checkoutId !== metadata.targetCheckoutId) {
    throw new InvalidInput('Repository scan belongs to another Groundwork project or checkout')
  }
  const productIds = new Set(plan.snapshot.products.map(product => product.id))
  const existingIds = new Set(plan.snapshot.components.map(component => component.id))
  const scannedRepository = await repositoryKey(metadata.repository)
  const components = await Promise.all(plan.snapshot.components.map(async component => ({
    component,
    repository: component.repo ? await repositoryKey(component.repo) : null,
  })))
  const batchIds = new Set(args.discoveries.map(discovery => discovery.id))
  if (batchIds.size !== args.discoveries.length) throw new InvalidInput('Repository discoveries contain duplicate component IDs')
  if (new Set(args.discoveries.map(discovery => discovery.sourcePath)).size !== args.discoveries.length) {
    throw new InvalidInput('Repository discoveries contain duplicate project paths')
  }
  const changes: Record<string, string> = {}
  const nextOrder = new Map(plan.snapshot.products.map(product => [
    product.id,
    plan.snapshot.components
      .filter(component => component.productId === product.id)
      .reduce((maximum, component) => Math.max(maximum, component.order ?? 0), 0) + 1,
  ]))
  const budgetLimited = Object.hasOwn(metadata.excluded, 'budget') || Object.hasOwn(metadata.excluded, 'packet-budget')
  const scannedAt = new Date().toISOString()
  for (const discovery of args.discoveries) {
    const project = metadata.projects.find(project => project.path === discovery.sourcePath)
    if (!project) throw new InvalidInput(`${discovery.id}: sourcePath was not detected by this scan`)
    requireClaimEvidence(discovery)
    for (const flow of discovery.executionFlows ?? []) {
      if (flow.sourceRevision !== metadata.revision) throw new InvalidInput(`${flow.id}: execution flow revision does not match the pinned scan revision`)
    }
    await validateDiscoveryCitations(scan, discovery)
    if (!productIds.has(discovery.productId)) throw new NotFound(`${discovery.id}: unknown product ${discovery.productId}`)
    const collision = components.find(item => item.component.id === discovery.id)
    if (collision && (collision.repository !== scannedRepository || (collision.component.sourcePath ?? '.') !== discovery.sourcePath)) {
      throw new InvalidInput(`${discovery.id}: component ID belongs to another repository or project path`)
    }
    const identityMatch = components
      .find(item => item.repository === scannedRepository && (item.component.sourcePath ?? '.') === discovery.sourcePath)?.component
    if (identityMatch && identityMatch.id !== discovery.id) {
      throw new InvalidInput(`${discovery.id}: repository project already belongs to component ${identityMatch.id}`)
    }
    for (const dependency of discovery.dependsOn ?? []) {
      if (dependency === discovery.id) throw new InvalidInput(`${discovery.id}: component cannot depend on itself`)
      if (!existingIds.has(dependency) && !batchIds.has(dependency)) {
        throw new InvalidInput(`${discovery.id}: unresolved dependency ${dependency} must remain in unresolvedDependencies`)
      }
    }
    requireRetainedInventory(collision?.component, discovery)
    for (const area of metadata.areas) if (!discovery.coverage[area]) throw new InvalidInput(`${discovery.id}: missing ${area} coverage result`)
    if (budgetLimited && metadata.areas.some(area => discovery.coverage[area] === 'complete')) {
      throw new InvalidInput(`${discovery.id}: budget-limited scan areas must report partial coverage`)
    }
    const previous = collision ? JSON.parse(plan.files[`components/${collision.component.id}.json`]) : {}
    const order = discovery.order ?? previous.order ?? nextOrder.get(discovery.productId)!
    if (discovery.order === undefined && previous.order === undefined) nextOrder.set(discovery.productId, order + 1)
    const projectFiles = filesForProject(metadata.files, project, metadata.projects)
    const next = mergeComponent(previous, discovery, {
      repository: metadata.repository,
      revision: metadata.revision,
      order,
      sourceFingerprint: digest(JSON.stringify(projectFiles.map(file => [file.path, file.digest]))),
      scannedAt,
    })
    changes[`components/${discovery.id}.json`] = JSON.stringify(next, null, 2) + '\n'
  }
  const manifest = scanManifest(plan, changes, metadata, 'baseline', args.discoveries.map(item => ({
    componentId: item.id,
    sourcePath: item.sourcePath,
    areas: Object.keys(item.coverage),
    observationIds: (item.executionFlows ?? []).map(flow => catalogId(plan.manifest.id, item.id, 'flow', flow.id)),
  })))
  changes[manifest.file] = manifest.raw
  const result = await writePlan(root, { expectedRevision: args.expectedRevision, expectedContext: args.expectedContext, changes })
  const cleanupError = await removeScan(directory).then(() => null).catch(error => error instanceof Error ? error.message : String(error))
  return {
    ...result,
    manifestId: manifest.manifestId,
    applied: args.discoveries.map(discovery => discovery.id),
    repository: metadata.repository,
    sourceRevision: metadata.revision,
    cleanup: cleanupError ? { status: 'deferred', error: cleanupError } : { status: 'complete' },
  }
}
