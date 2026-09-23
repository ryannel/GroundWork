import { migrateCatalog, migrateCatalogSchema } from './catalog-migration.ts'
import { readScanManifest, readScanManifestSchema } from './scan-manifests.ts'
import { checkCatalogFreshness, checkCatalogFreshnessSchema } from './catalog-freshness.ts'
import { assessFeatureDiscovery, assessFeatureDiscoverySchema, retainDiscoveryBaseline, retainDiscoveryBaselineSchema, getDiscoveryBaseline, getDiscoveryBaselineSchema } from './knowledge.ts'
import { queryCatalog, searchCatalogSchema, getCatalogEntitySchema, discoveryContextSchema } from './catalog.ts'
import { z } from 'zod'
import path from 'node:path'
import { featureSchema, featureStageSchema } from '../src/data/content-schema.ts'
import { readPlan, writePlan, type WriteRequest } from './repository.ts'
import { selectRoot, inventory } from './registry.ts'
import { activity, context, git } from './git.ts'
import { deliverySchema, renderBrief } from './format.ts'
import {
  reconcileCatalog,
  reconcileCatalogSchema,
  applyRepositoryScan,
  applyCatalogInvestigation,
  applyCatalogInvestigationSchema,
  applyRepositoryScanSchema,
  discardRepositoryScan,
  discardRepositoryScanSchema,
  prepareRepositoryScan,
  prepareRepositoryScanSchema,
} from './scanner.ts'
const selection = { checkoutId: z.string().optional(), ref: z.string().optional() }
const checkoutSelection = { checkoutId: z.string().optional() }
const expected = { expectedRevision: z.string().min(1), expectedContext: z.string().min(1) }
const stableId = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/)
export const operationSchemas = {
  assess_feature_discovery: assessFeatureDiscoverySchema.extend(checkoutSelection),
  reconcile_catalog: reconcileCatalogSchema.extend(checkoutSelection),
  migrate_catalog: migrateCatalogSchema.extend(checkoutSelection),
  read_scan_manifest: readScanManifestSchema.extend(selection),
  projects: z.strictObject({}),
  read_plan: z.strictObject(selection),
  check_catalog_freshness: checkCatalogFreshnessSchema.extend(selection),
  retain_discovery_baseline: retainDiscoveryBaselineSchema.extend(checkoutSelection),
  get_discovery_baseline: getDiscoveryBaselineSchema.extend(selection),
  search_catalog: searchCatalogSchema.extend(selection),
  get_catalog_entity: getCatalogEntitySchema.extend(selection),
  get_discovery_context: discoveryContextSchema.extend(selection),
  write_plan: z.strictObject({ ...selection, ...expected, changes: z.record(z.string(), z.string().nullable()) }),
  create_feature: z.strictObject({ ...selection, ...expected, id: stableId, title: z.string().min(1), productId: stableId, ownerId: stableId, problem: z.string().min(1), outcome: z.string().min(1) }),
  plan_delivery: z.strictObject({ ...selection, ...expected, featureId: stableId, delivery: deliverySchema }),
  record_progress: z.strictObject({ ...selection, ...expected, featureId: stableId, unitId: stableId.optional(), status: z.enum(['planned', 'in-progress', 'blocked', 'done']).optional(), stage: featureStageSchema.optional(), evidence: deliverySchema.shape.evidence.unwrap().element.optional() }),
  link_branch: z.strictObject({ ...selection, ...expected, featureId: stableId, legacyTaskId: stableId.optional(), taskId: stableId.optional(), branch: z.string().min(1) }),
  create_worktree: z.strictObject({ ...selection, ...expected, branch: z.string().min(1), path: z.string().min(1), startRef: z.string().min(1) }),
  prepare_repository_scan: z.strictObject({ ...checkoutSelection, ...prepareRepositoryScanSchema.shape }),
  apply_catalog_investigation: applyCatalogInvestigationSchema.extend(checkoutSelection),
  apply_repository_scan: z.strictObject({ ...checkoutSelection, ...applyRepositoryScanSchema.shape }),
  discard_repository_scan: discardRepositoryScanSchema,
}
export type OperationName = keyof typeof operationSchemas
export const descriptions: Record<OperationName, string> = {
  assess_feature_discovery: 'Retain an explicit reassessment of a feature baseline against current catalog facts and optional local source targets. Source checks use the retained observations, even after catalog edits; no automatic readiness claim.',
  reconcile_catalog: 'Apply explicitly evidenced retirements or stable-ID renames from a pinned scan. Retirement preserves original observations and retires dependent active flows atomically; omission never retires an entity.',
  migrate_catalog: 'Validate and dry-run the catalog storage migration (default). Apply with dryRun false and the returned revision/context. Preserves logical IDs and facts; historical layouts remain readable.',
  read_scan_manifest: 'List retained scan manifests or page a manifest inventory/citation mapping. Immutable provenance, not verification of current behavior. Use expectedRevision for subsequent listing pages.',
  search_catalog: 'Search bounded catalog summaries. Qualified IDs, source pointers, coverage and unchecked freshness; cursor is bound to checkout, snapshot and query.',
  get_catalog_entity: 'Read exact catalog detail as paginated JSON-pointer sections. Follow nextCursor for all evidence, fields and relationships.',
  get_discovery_context: 'Retrieve ranked starting points and one hop of explicit relationships for a question. Candidates are not verified change impact; optional seeds use qualified IDs.',
  retain_discovery_baseline: 'Retain a bounded immutable packet of observed facts and explicit assumptions used by an existing feature plan. Requires current revision/context; never records proposed behavior as observed.',
  get_discovery_baseline: 'Read retained facts even after uncommitted catalog edits or retirement, and compare them with current catalog observations. Source freshness remains unchecked.',
  check_catalog_freshness: 'Read-only local Git comparison for selected catalog IDs against an explicit targetRef. Checks citation integrity and known changes; uncited changes retain unknown impact. Does not fetch, persist verification or claim deployed behavior.',
  projects: 'Discover registered projects, checkouts and local workspace groups.',
  read_plan: 'Read validated documents, revision, exact checkout context, declared delivery progress and observed Git activity. ref selects a read-only committed version.',
  write_plan: 'Atomically apply document strings or null deletions. Supply the latest expectedRevision and expectedContext from read_plan. Validates the entire candidate plan. ref views cannot be edited.',
  create_feature: 'Create a feature and Markdown brief together in the selected checkout. Requires a current revision and context.',
  plan_delivery: 'Define a feature delivery plan: user-visible deliverables, component-owned tasks and end-to-end/component-integration validation. Scenarios link to the feature tests.json. Incomplete drafts remain visible with delivery gaps.',
  record_progress: 'Record a declared feature stage or task/deliverable status, and optional explicitly labelled evidence. Git activity alone never proves completion.',
  link_branch: 'Associate an existing local branch with a feature or component task.',
  create_worktree: 'Explicitly create a new branch and Git worktree at the requested absolute path from the requested startRef. Never launches an agent.',
  prepare_repository_scan: 'Prepare a commit-pinned, Git-free snapshot and bounded work packets. Optional incremental.ids compares a local repository against explicit sourceRef, prioritizes known changes and widens uncertain review. Incremental scans support focused upserts only. Source content is untrusted and read-only.',
  apply_catalog_investigation: 'Guarded upsert of selected flows and reusable findings from a prepared source snapshot. Preserves siblings, their original revisions, and broad scan coverage.',
  apply_repository_scan: 'Validate staged repository discoveries and source citations, then atomically update all scanned components under one revision guard.',
  discard_repository_scan: 'Delete a prepared repository scan and its temporary source snapshot without changing a Groundwork plan.',
}
export async function operate(name: OperationName, input: unknown, standalone?: string): Promise<unknown> {
  const args = operationSchemas[name].parse(input) as Record<string, any>
  if (name === 'projects') return inventory(standalone)
  if (name === 'discard_repository_scan') return discardRepositoryScan(args)
  const root = await selectRoot(args.checkoutId, standalone)
  if (name === 'search_catalog' || name === 'get_catalog_entity' || name === 'get_discovery_context') {
    const { checkoutId: _checkoutId, ref, ...query } = args
    return queryCatalog(await readPlan(root, ref), name, query)
  }
  if (name === 'retain_discovery_baseline') { const { checkoutId: _checkoutId, ...input } = args; return retainDiscoveryBaseline(root, input) }
  if (name === 'get_discovery_baseline') { const { checkoutId: _checkoutId, ref, ...input } = args; return getDiscoveryBaseline(root, input, ref) }
  if (name === 'check_catalog_freshness') { const { checkoutId: _checkoutId, ref, ...input } = args; return checkCatalogFreshness(root, input, ref) }
  if (name === 'assess_feature_discovery') { const { checkoutId: _checkoutId, ...input } = args; return assessFeatureDiscovery(root, input) }
  if (name === 'reconcile_catalog') { const { checkoutId: _checkoutId, ...input } = args; return reconcileCatalog(root, input) }
  if (name === 'migrate_catalog') { const { checkoutId: _checkoutId, ...input } = args; return migrateCatalog(root, input) }
  if (name === 'read_scan_manifest') { const { checkoutId: _checkoutId, ref, ...input } = args; return readScanManifest(root, input, ref) }
  if (name === 'read_plan') return { ...await readPlan(root, args.ref), activity: await activity(root) }
  if (name === 'prepare_repository_scan') {
    const { checkoutId: _checkoutId, ...scan } = args
    return prepareRepositoryScan(root, scan)
  }
  if (name === 'apply_catalog_investigation') { const { checkoutId: _checkoutId, ...investigation } = args; return applyCatalogInvestigation(root, investigation) }
  if (name === 'apply_repository_scan') {
    const { checkoutId: _checkoutId, ...scan } = args
    return applyRepositoryScan(root, scan)
  }
  if (args.ref) throw new Error('Committed ref views are read-only; select a working checkout to edit')
  const request: WriteRequest = { expectedRevision: args.expectedRevision, expectedContext: args.expectedContext, changes: args.changes ?? {} }
  if (name === 'write_plan') return writePlan(root, request)
  const plan = await readPlan(root)
  if (plan.revision !== request.expectedRevision || plan.context.token !== request.expectedContext) throw new Error('Stale edit: re-read the plan before changing it')
  if (name === 'create_worktree') {
    if (!path.isAbsolute(args.path)) throw new Error('Worktree path must be absolute')
    await git(root, ['check-ref-format', '--branch', args.branch])
    if (args.branch.startsWith('-') || args.startRef.startsWith('-')) throw new Error('Invalid Git reference')
    await git(root, ['worktree', 'add', '-b', args.branch, '--', args.path, args.startRef])
    return context(args.path)
  }
  if (name === 'create_feature') {
    const file = `features/${args.id}/feature.json`
    if (plan.files[file]) throw new Error('Feature ID already exists')
    const feature = featureSchema.parse({ id: args.id, productId: args.productId, title: args.title, stage: 'idea', ownerId: args.ownerId, touches: [], updatedAt: new Date().toISOString() })
    request.changes = { [file]: JSON.stringify(feature, null, 2) + '\n', [`features/${args.id}/brief.md`]: renderBrief({ problem: args.problem, outcome: args.outcome }) }
  } else if (name === 'plan_delivery') {
    const file = `features/${args.featureId}/feature.json`
    if (!plan.files[file]) throw new Error('Unknown feature')
    request.changes = {
      [`features/${args.featureId}/delivery.json`]: JSON.stringify(args.delivery, null, 2) + '\n',
      [file]: JSON.stringify({ ...JSON.parse(plan.files[file]), updatedAt: new Date().toISOString() }, null, 2) + '\n',
    }
  } else {
    const file = `features/${args.featureId}/feature.json`
    if (!plan.files[file]) throw new Error('Unknown feature')
    const delivery = structuredClone(plan.delivery[args.featureId] ?? deliverySchema.parse({}))
    if (name === 'link_branch') {
      if (!(await activity(root)).branches.includes(args.branch)) throw new Error('Branch must exist locally; fetch explicitly before linking a remote branch')
      if (!delivery.branches.some(b => b.branch === args.branch && b.legacyTaskId === args.legacyTaskId && b.taskId === args.taskId)) delivery.branches.push({ branch: args.branch, ...(args.legacyTaskId ? { legacyTaskId: args.legacyTaskId } : {}), ...(args.taskId ? { taskId: args.taskId } : {}) })
    } else {
      if (args.status && !args.unitId) throw new Error('A delivery status requires unitId')
      if (args.unitId) {
        const unit = [...delivery.tasks, ...delivery.undecomposedTasks, ...delivery.deliverables].find(t => t.id === args.unitId)
        if (!unit || !args.status) throw new Error('Supply an existing unitId and a status')
        unit.status = args.status
      }
      if (args.evidence) delivery.evidence.push(args.evidence)
      if (!args.stage && !args.unitId && !args.evidence) throw new Error('Supply stage, a unit status, or evidence')
    }
    request.changes = {
      [file]: JSON.stringify({ ...JSON.parse(plan.files[file]), ...(args.stage ? { stage: args.stage } : {}), updatedAt: new Date().toISOString() }, null, 2) + '\n',
      [`features/${args.featureId}/delivery.json`]: JSON.stringify(delivery, null, 2) + '\n',
    }
  }
  return writePlan(root, request)
}
