import { componentMembership, productRepositories } from '../src/data/content.ts'
import { repositoryIdentity } from '../src/data/repository-identity.ts'
import type { Component } from '../src/data/model.ts'
import { buildRevisionHistory } from './catalog-history.ts'
import { localDefaultBranch } from './catalog-branches.ts'
import { catalogCandidateFromComponents, materializeResolvedCatalog, resolveCatalogForProduct,
  type CatalogUnit, type Provenance, type ResolutionWarning } from './catalog-resolution.ts'
import { Conflict, InvalidInput, NotFound } from './errors.ts'
import { digest } from './git.ts'
import { parseScanManifest } from '../src/data/scan-manifest.ts'
import { readCatalogTarget, readPlan, writeCatalogTarget } from './repository.ts'
import { validateTransition } from './transitions.ts'

export interface CatalogProposalRequest {
  homeRoot: string
  productId: string
  repository: string
  /** A writable checkout of the repository whose shared source catalog will receive the proposal. */
  sourceRoot: string
  /** Applying always requires the ID returned by a fresh dry run. */
  apply?: boolean
  expectedProposalId?: string
}
export interface ProposedUnit {
  componentId: string
  kind: CatalogUnit['kind']
  id: string
  provenance: Provenance
}
export interface ProposedDocument { path: string; before: string | null; after: string }
export interface CatalogProposal {
  proposalId: string
  productId: string
  repository: string
  homeRepository: string
  units: ProposedUnit[]
  documents: ProposedDocument[]
  warnings: ResolutionWarning[]
  issues: string[]
  canApply: boolean
  applied: boolean
}

const localWinner = (provenance: Provenance) => provenance.catalog === 'local'
  && (provenance.reason === 'local-newer' || provenance.reason === 'local-only')
const unitId = (unit: CatalogUnit) => unit.kind === 'area' ? unit.area
  : unit.kind === 'retirement' ? `${unit.retiredKind}/${unit.id}` : unit.id
const documentText = (component: Component) => `${JSON.stringify(component, null, 2)}\n`

/**
 * Prepare a reviewable proposal from a home's local catalog into a selected source checkout.
 * The default is a read-only preview. Apply re-prepares and compares its ID before the guarded write.
 */
export async function proposeLocalCatalog(request: CatalogProposalRequest): Promise<CatalogProposal> {
  const repository = repositoryIdentity(request.repository)
  const home = await readPlan(request.homeRoot)
  const homeRepository = repositoryIdentity(home.repository.id)
  const product = home.snapshot.products.find(item => item.id === request.productId)
  if (!product) throw new NotFound(`Product ${request.productId} is not in home repository ${homeRepository}`)
  const declared = productRepositories(product, home.snapshot.products, home.snapshot.components, homeRepository)
    .some(item => repositoryIdentity(item.repository) === repository)
  if (!declared) throw new InvalidInput(`Product ${request.productId} does not declare repository ${repository}`)

  const [source, local] = await Promise.all([
    readCatalogTarget(request.sourceRoot, repository, 'source'),
    readCatalogTarget(request.homeRoot, repository, 'local'),
  ])
  if (local.layout !== 'catalog-v3') throw new InvalidInput('Proposal requires a migrated local catalog')
  const belongs = (component: Component) => {
    const candidate = { ...component, repo: component.repo ?? repository }
    if (componentMembership(candidate, home.snapshot.products, homeRepository).productIds.includes(request.productId)) return true
    return !product.repositories && home.snapshot.components.some(item => item.id === component.id
      && repositoryIdentity(item.repo ?? homeRepository) === repository && item.productId === request.productId)
  }
  const sourceCandidate = catalogCandidateFromComponents(repository, source.plan.snapshot.components.filter(belongs))
  const localCandidate = catalogCandidateFromComponents(repository, local.plan.snapshot.components.filter(belongs), homeRepository)
  const observations = [...sourceCandidate.units, ...localCandidate.units]
  const defaultBranch = await localDefaultBranch(request.sourceRoot)
  const history = await buildRevisionHistory(request.sourceRoot,
    observations.map(item => item.revision), observations.flatMap(item => item.tree ? [item.tree] : []), defaultBranch?.ref)
  const resolution = resolveCatalogForProduct(homeRepository, sourceCandidate, localCandidate, history)
  const chosen = [
    ...resolution.areas.filter(item => localWinner(item.provenance)),
    ...resolution.flows.filter(item => localWinner(item.provenance)),
    ...resolution.findings.filter(item => localWinner(item.provenance)),
    ...resolution.retirements.filter(item => item.effective && localWinner(item.provenance)),
  ]
  const units: ProposedUnit[] = chosen.map(item => ({ componentId: item.unit.componentId,
    kind: item.unit.kind, id: unitId(item.unit), provenance: item.provenance }))
    .sort((a, b) => JSON.stringify([a.componentId, a.kind, a.id]).localeCompare(JSON.stringify([b.componentId, b.kind, b.id])))
  const affected = new Set(units.map(item => item.componentId))
  const materialized = materializeResolvedCatalog(resolution)
  const issues: string[] = []
  for (const detail of materialized.incompatible) if (affected.has(detail.unit.componentId)) {
    issues.push(`${detail.unit.componentId}/${detail.unit.kind}/${detail.unit.id} has incompatible references: ${detail.incompatible
      .map(ref => `${ref.kind}/${ref.id}`).join(', ')}`)
  }
  const changes: Record<string, string> = {}
  const documents: ProposedDocument[] = []
  for (const component of materialized.components) {
    if (!affected.has(component.id)) continue
    const boundary = component.sourcePath?.replace(/\/$/, '') || '.'
    const duplicate = source.plan.snapshot.components.find(existing => existing.id !== component.id
      && repositoryIdentity(existing.repo ?? repository) === repository
      && (existing.sourcePath?.replace(/\/$/, '') || '.') === boundary)
    if (duplicate) {
      issues.push(`${component.id} shares repository path ${boundary} with source component ${duplicate.id}; reconcile component identity first`)
      continue
    }
    const logicalPath = `components/${component.id}.json`
    if (source.files[logicalPath] && !sourceCandidate.units.some(item => item.componentId === component.id)) {
      issues.push(`${logicalPath} already belongs to another product in the source catalog`)
      continue
    }
    // A copied whole area must retain its observed revision. Otherwise the next resolution would date
    // the new source area by the source component's older identity metadata.
    for (const area of resolution.areas) {
      if (area.unit.componentId !== component.id || area.unit.area === 'identity' || !localWinner(area.provenance)) continue
      if (!['api', 'data', 'messaging', 'jobs', 'dependencies'].includes(area.unit.area) || !area.unit.revision) continue
      component.scan ??= { status: 'partial' }
      component.scan.areaRevisions ??= {}
      component.scan.areaRevisions[area.unit.area as keyof NonNullable<typeof component.scan.areaRevisions>] = {
        revision: area.unit.revision,
        ...(area.unit.tree ? { treeId: area.unit.tree.id, coveredPathsKey: area.unit.tree.coveredPathsKey } : {}),
      }
    }
    const before = source.files[logicalPath] ?? null
    const after = documentText(component)
    if (before && JSON.stringify(JSON.parse(before)) === JSON.stringify(JSON.parse(after))) continue
    changes[logicalPath] = after
    documents.push({ path: logicalPath, before, after })
  }
  // Promoted observations keep the immutable scan event that established their provenance. The local catalog
  // already scopes these records to this repository; never regenerate or rewrite their content-addressed bytes.
  for (const [logicalPath, raw] of documents.length && !issues.length ? Object.entries(local.files) : []) {
    if (!logicalPath.startsWith('scan-manifests/')) continue
    try {
      const manifest = parseScanManifest(raw)
      if (repositoryIdentity(manifest.repository) !== repository || !manifest.scope.some(item => affected.has(item.componentId))) continue
      if (logicalPath !== `scan-manifests/${digest(raw)}.json`) throw new InvalidInput(`Invalid local scan manifest ID: ${logicalPath}`)
      const before = source.files[logicalPath] ?? null
      if (before === raw) continue
      if (before !== null) throw new Conflict(`Source scan manifest differs from the immutable local record: ${logicalPath}`)
      changes[logicalPath] = raw
      documents.push({ path: logicalPath, before, after: raw })
    } catch (error) { issues.push(error instanceof Error ? error.message : String(error)) }
  }
  documents.sort((a, b) => a.path.localeCompare(b.path))
  if (documents.length && !issues.length) {
    try { validateTransition(source.files, changes, source.source) }
    catch (error) { issues.push(error instanceof Error ? error.message : String(error)) }
  }
  const proposalId = digest(JSON.stringify([home.revision, home.context.token, source.revision, source.context.token,
    local.revision, local.context.token, request.productId, repository, documents]))
  const canApply = documents.length > 0 && issues.length === 0
  const preview: CatalogProposal = { proposalId, productId: request.productId, repository, homeRepository,
    units, documents, warnings: resolution.warnings, issues, canApply, applied: false }
  if (!request.apply) return preview
  if (!request.expectedProposalId) throw new InvalidInput('Applying a catalog proposal requires its preview proposalId')
  if (request.expectedProposalId !== proposalId) throw new Conflict('Catalog proposal changed; review a new dry-run preview')
  if (!canApply) throw new InvalidInput(issues.join('; ') || 'Catalog proposal has no applicable changes')
  await writeCatalogTarget(request.sourceRoot, repository, 'source', {
    expectedRevision: source.revision, expectedContext: source.context.token, changes,
  })
  return { ...preview, applied: true }
}
