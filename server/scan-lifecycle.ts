import { catalogId, type CatalogKind } from '../src/data/catalog-identity.ts'
import type { Component } from '../src/data/model.ts'
import { applyCatalogInvestigationSchema, reconcileCatalogSchema, type LifecycleRetirement } from '../src/data/scan-schema.ts'
import { catalogIndex } from './catalog.ts'
import { repositoryKey } from './catalog-freshness.ts'
import { readPlan, writePlan } from './repository.ts'
import { validateCitations, type Citation } from './scan-evidence.ts'
import { scanManifest, type ManifestScope } from './scan-manifests.ts'
import { investigationCoverage } from './scan-policy.ts'
import { filesForProject } from './scan-projects.ts'
import { loadScan, removeScan, type LoadedScan } from './scan-workspace.ts'

type Plan = Awaited<ReturnType<typeof readPlan>>

function requireScanTarget(plan: Plan, scan: LoadedScan, message: string) {
  if (plan.manifest.id !== scan.metadata.targetProjectId || plan.context.checkoutId !== scan.metadata.targetCheckoutId) throw new Error(message)
}

/** The component must come from the scanned repository, and its project boundary must be one the scan detected. */
async function requireComponentSource(component: Component | undefined, scan: LoadedScan, message: string): Promise<Component> {
  const matches = component?.repo
    && await repositoryKey(component.repo) === await repositoryKey(scan.metadata.repository)
    && scan.metadata.projects.some(project => project.path === (component.sourcePath ?? '.'))
  if (!matches) throw new Error(message)
  return component!
}

function upsert<T extends { id: string }>(before: T[], updates: T[]) {
  return [...before.filter(item => !updates.some(update => update.id === item.id)), ...updates].sort((a, b) => a.id.localeCompare(b.id))
}

export async function applyCatalogInvestigation(root: string, input: unknown) {
  const args = applyCatalogInvestigationSchema.parse(input)
  if (!args.flows.length && !args.findings.length && !args.jobs.length) throw new Error('Supply at least one investigated flow or finding')
  const primary = await loadScan(args.scanId)
  const { metadata } = primary
  const plan = await readPlan(root)
  if (plan.revision !== args.expectedRevision || plan.context.token !== args.expectedContext) throw new Error('Stale investigation; re-read and reconcile')
  requireScanTarget(plan, primary, 'Scan belongs to another project or checkout')
  const component = await requireComponentSource(
    plan.snapshot.components.find(component => component.id === args.componentId), primary,
    'Investigation source does not match the component repository and boundary',
  )
  const boundary = component.sourcePath ?? '.'
  for (const group of [args.flows, args.findings, args.jobs]) {
    if (new Set(group.map(item => item.id)).size !== group.length) throw new Error('Duplicate investigation IDs')
  }
  for (const item of [...args.flows, ...args.findings]) {
    if (item.sourceRevision !== metadata.revision) throw new Error('Investigation must use the pinned source revision')
  }
  const observationId = (kind: CatalogKind, id: string) => catalogId(plan.manifest.id, component.id, kind, id)
  const entities = new Set(catalogIndex(plan).map(entry => entry.id))
  for (const job of args.jobs) entities.add(observationId('job', job.id))
  for (const flow of args.flows) entities.add(observationId('flow', flow.id))
  const scannedRepository = await repositoryKey(metadata.repository)
  for (const finding of args.findings) {
    if (await repositoryKey(finding.repository) !== scannedRepository) throw new Error('Finding repository differs from its source snapshot')
    for (const subject of finding.subjects) {
      if (!entities.has(observationId(subject.kind, subject.id))) throw new Error(`Unknown investigation subject: ${subject.id}`)
    }
  }
  const supporting = await Promise.all(args.sourceScans.map(id => loadScan(id)))
  const sources = [primary, ...supporting]
  const sourceKeys = await Promise.all(sources.map(source => repositoryKey(source.metadata.repository)))
  if (new Set(sourceKeys).size !== sourceKeys.length) throw new Error('Use one pinned scan per repository')
  for (const source of supporting) requireScanTarget(plan, source, 'Supporting source scan belongs to another checkout')

  const citations: { evidence: Citation; observationId: string }[] = [
    ...args.flows.flatMap(flow => [...flow.steps, ...flow.transitions].flatMap(item => item.evidence)
      .map(evidence => ({ evidence, observationId: observationId('flow', flow.id) }))),
    ...args.findings.flatMap(finding => finding.evidence.map(evidence => ({ evidence, observationId: observationId('finding', finding.id) }))),
    ...args.jobs.flatMap(job => job.evidence.map(evidence => ({ evidence, observationId: observationId('job', job.id) }))),
  ]
  // Which projects of each supporting scan were cited, and by which observations.
  const cited = supporting.map(() => new Map<string, Set<string>>())
  for (const { evidence, observationId } of citations) {
    const index = sourceKeys.indexOf(await repositoryKey(evidence.repository ?? metadata.repository))
    const source = sources[index]
    if (!source) throw new Error('Cross-repository evidence requires a matching pinned sourceScans snapshot')
    const citedBoundary = index === 0 ? boundary : source.metadata.projects.find(project =>
      filesForProject(source.metadata.files, project, source.metadata.projects).some(file => file.path === evidence.path))?.path
    if (!citedBoundary) throw new Error('External evidence is outside prepared source boundaries')
    await validateCitations(source, citedBoundary, [evidence])
    if (index > 0) {
      const observations = cited[index - 1].get(citedBoundary) ?? new Set<string>()
      cited[index - 1].set(citedBoundary, observations.add(observationId))
    }
  }
  // Job `source` pointers name files in the investigated component, like freshness citations.
  await validateCitations(primary, boundary, [], args.jobs.flatMap(job => job.source ? [job.source] : []))

  const next = {
    ...component,
    ...(args.jobs.length ? { jobs: upsert(component.jobs ?? [], args.jobs) } : {}),
    executionFlows: upsert(component.executionFlows ?? [], args.flows),
    findings: upsert(component.findings ?? [], args.findings),
  }
  const changes: Record<string, string> = { [`components/${component.id}.json`]: JSON.stringify(next, null, 2) + '\n' }
  const manifest = scanManifest(plan, changes, metadata, 'investigation', [{
    componentId: component.id,
    sourcePath: boundary,
    areas: [],
    observationIds: [
      ...args.flows.map(flow => observationId('flow', flow.id)),
      ...args.findings.map(finding => observationId('finding', finding.id)),
      ...args.jobs.map(job => observationId('job', job.id)),
    ],
  }])
  changes[manifest.file] = manifest.raw
  const supportingManifestIds: string[] = []
  supporting.forEach((source, index) => {
    const scope: ManifestScope[] = [...cited[index]].map(([sourcePath, observations]) => ({
      componentId: component.id, sourcePath, areas: [], observationIds: [...observations].sort(),
    }))
    if (!scope.length) return
    const supportingManifest = scanManifest(plan, changes, source.metadata, 'investigation', scope)
    changes[supportingManifest.file] = supportingManifest.raw
    supportingManifestIds.push(supportingManifest.manifestId)
  })
  const result = await writePlan(root, { expectedRevision: args.expectedRevision, expectedContext: args.expectedContext, changes })
  // Supporting scans stay available until they expire or are discarded; only the primary scan is consumed.
  const cleanupError = await removeScan(primary.directory).then(() => null).catch(error => String(error))
  return {
    ...result,
    supportingManifestIds,
    manifestId: manifest.manifestId,
    componentId: component.id,
    flows: args.flows.map(flow => flow.id),
    findings: args.findings.map(finding => finding.id),
    sourceRevision: metadata.revision,
    coverage: investigationCoverage,
    cleanup: cleanupError ?? 'complete',
  }
}

type Observation = { id: string; name: string; path?: string }

/** True when `flow` starts from, or passes through, the observation being retired. */
function flowUses(flow: NonNullable<Component['executionFlows']>[number], action: { kind: string; id: string }) {
  switch (action.kind) {
    case 'endpoint': return flow.endpointId === action.id
    case 'message':
      return (flow.trigger?.kind === 'message' && flow.trigger.messageId === action.id)
        || flow.steps.some(step => step.messageIds?.includes(action.id))
    case 'data': return flow.steps.some(step => step.dataRecordIds?.includes(action.id))
    case 'job': return flow.trigger?.kind === 'job' && flow.trigger.jobId === action.id
    default: return false
  }
}

/** The requested retirements plus a retirement of every active flow that depends on a retired endpoint, message, data record or job. */
export function retirementCascade(component: Pick<Component, 'executionFlows'>, retire: LifecycleRetirement[]): LifecycleRetirement[] {
  const actions = [...retire]
  for (const action of retire) {
    for (const flow of component.executionFlows ?? []) {
      if (!flowUses(flow, action) || actions.some(item => item.kind === 'flow' && item.id === flow.id)) continue
      actions.push({ ...action, kind: 'flow', id: flow.id, reason: `Retired active flow because ${action.kind}/${action.id} was retired: ${action.reason}` })
    }
  }
  return actions
}

export async function reconcileCatalog(root: string, input: unknown) {
  const args = reconcileCatalogSchema.parse(input)
  const scan = await loadScan(args.scanId)
  const { metadata } = scan
  if (!args.retire.length && !args.rename.length) throw new Error('Supply an evidenced retirement or rename')
  const plan = await readPlan(root)
  if (plan.revision !== args.expectedRevision || plan.context.token !== args.expectedContext) throw new Error('Stale reconciliation; reread the catalog')
  requireScanTarget(plan, scan, 'Scan belongs to another checkout')
  const component = await requireComponentSource(
    plan.snapshot.components.find(item => item.id === args.componentId), scan, 'Reconciliation source boundary mismatch',
  )
  const keys = [...args.retire, ...args.rename].map(item => `${item.kind}/${item.id}`)
  if (new Set(keys).size !== keys.length) throw new Error('Conflicting lifecycle actions for one identity')
  await validateCitations(scan, component.sourcePath ?? '.', [...args.retire, ...args.rename].flatMap(item => item.evidence))
  const next = structuredClone(component)
  const groups: Record<string, Observation[] | undefined> = {
    endpoint: next.api?.endpoints, schema: next.api?.schemas, data: next.data?.records,
    message: next.messaging?.messages, job: next.jobs, flow: next.executionFlows,
  }
  const retired = [...(next.retiredObservations ?? [])]
  const actions = retirementCascade(next, args.retire)
  if (args.rename.some(item => actions.some(action => action.kind === item.kind && action.id === item.id))) {
    throw new Error('A renamed flow is also affected by retirement; reconcile explicitly')
  }
  const retiredAt = new Date().toISOString()
  for (const action of actions) {
    const group = groups[action.kind]
    const index = group?.findIndex(item => item.id === action.id) ?? -1
    if (!group || index < 0) throw new Error(`Unknown active ${action.kind}/${action.id}`)
    retired.push({
      kind: action.kind, id: action.id, retiredAt, sourceRevision: metadata.revision, reason: action.reason,
      evidence: action.evidence, observation: group[index] as unknown as Record<string, unknown>,
    })
    group.splice(index, 1)
  }
  for (const action of args.rename) {
    const item = groups[action.kind]?.find(item => item.id === action.id)
    if (!item) throw new Error(`Unknown active ${action.kind}/${action.id}`)
    if (action.path && action.kind !== 'endpoint') throw new Error('Only endpoint renames can change a route path')
    // Rename evidence is distinct from old implementation citations, particularly for flows.
    const paths = 'path' in item ? { pathBefore: item.path, ...(action.path ? { pathAfter: action.path } : {}) } : {}
    next.catalogChanges = [...(next.catalogChanges ?? []), {
      kind: action.kind, id: action.id, nameBefore: item.name, nameAfter: action.name, ...paths,
      sourceRevision: metadata.revision, evidence: action.evidence,
    }]
    item.name = action.name
    if (action.path && 'path' in item) item.path = action.path
  }
  if (retired.length) next.retiredObservations = retired
  const changes = { [`components/${component.id}.json`]: JSON.stringify(next, null, 2) + '\n' }
  const manifest = scanManifest(plan, changes, metadata, 'investigation', [{
    componentId: component.id,
    sourcePath: component.sourcePath ?? '.',
    areas: [],
    observationIds: [...actions, ...args.rename].map(item => catalogId(plan.manifest.id, component.id, item.kind, item.id)),
  }])
  changes[manifest.file] = manifest.raw
  const result = await writePlan(root, { expectedRevision: args.expectedRevision, expectedContext: args.expectedContext, changes })
  const cleanup = await removeScan(scan.directory).then(() => 'complete').catch(() => 'deferred')
  return {
    ...result,
    manifestId: manifest.manifestId,
    retired: actions.map(item => `${item.kind}/${item.id}`),
    renamed: args.rename.map(item => `${item.kind}/${item.id}`),
    cleanup,
  }
}
