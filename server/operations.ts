import { z } from 'zod'
import { migrateCatalog, migrateCatalogSchema } from './catalog-migration.ts'
import { readScanManifest, readScanManifestSchema } from './scan-manifests.ts'
import { checkCatalogFreshness, checkCatalogFreshnessSchema } from './catalog-freshness.ts'
import {
  assessFeatureDiscovery, assessFeatureDiscoverySchema, retainDiscoveryBaseline, retainDiscoveryBaselineSchema,
  getDiscoveryBaseline, getDiscoveryBaselineSchema,
} from './knowledge.ts'
import { queryCatalog, searchCatalogSchema, getCatalogEntitySchema, discoveryContextSchema } from './catalog.ts'
import { readPlan, writePlan } from './repository.ts'
import { selectRoot, inventory } from './registry.ts'
import { activity, context, git } from './git.ts'
import { InvalidInput } from './errors.ts'
import {
  assertCurrent, createFeature, createFeatureFields, planDelivery, planDeliveryFields, recordProgress, recordProgressFields, recordProgressRules,
  linkBranch, linkBranchFields, createWorktreeFields, createWorktreeRules,
} from './plan-mutations.ts'
import {
  reconcileCatalog, reconcileCatalogSchema, applyRepositoryScan, applyCatalogInvestigation, applyCatalogInvestigationSchema,
  applyRepositoryScanSchema, discardRepositoryScan, discardRepositoryScanSchema, prepareRepositoryScan, prepareRepositoryScanSchema,
} from './scanner.ts'

const selection = { checkoutId: z.string().optional(), ref: z.string().optional() }
const checkoutSelection = { checkoutId: z.string().optional() }
const expected = { expectedRevision: z.string().min(1), expectedContext: z.string().min(1) }

type Plan = Awaited<ReturnType<typeof readPlan>>
type Selection = { checkoutId?: string; ref?: string }
/** Checkout selection is split from the payload once, before dispatch; the root is resolved only when an operation asks. */
type Target = { root: () => Promise<string>; ref?: string; standalone?: string }
type Payload<S extends z.ZodType> = Omit<z.output<S>, keyof Selection>
type OperationDef<S extends z.ZodType> = {
  schema: S
  description: string
  /** MCP hints: clients use them to decide whether to ask before running a tool. */
  readOnly: boolean
  destructive: boolean
  idempotent?: boolean
  openWorld?: boolean
  run: (args: Payload<S>, target: Target) => Promise<unknown>
}
const define = <S extends z.ZodType>(definition: OperationDef<S>) => definition
const read = { readOnly: true, destructive: false } as const

async function writableRoot(target: Target) {
  if (target.ref) throw new InvalidInput('Committed ref views are read-only; select a working checkout to edit')
  return target.root()
}
type Guard = { expectedRevision: string; expectedContext: string }
/** Reads the working plan, rejects a stale guard, and writes the changes the pure mutation returns. */
function mutation<A extends Guard>(change: (plan: Plan, args: A, root: string) => Record<string, string> | Promise<Record<string, string>>) {
  return async (args: A, target: Target) => {
    const root = await writableRoot(target)
    const plan = await readPlan(root)
    assertCurrent(plan, args)
    return writePlan(root, { expectedRevision: args.expectedRevision, expectedContext: args.expectedContext, changes: await change(plan, args, root) })
  }
}

const operations = {
  assess_feature_discovery: define({
    schema: assessFeatureDiscoverySchema.extend(checkoutSelection),
    description: 'Retain an explicit reassessment of a feature baseline against current catalog facts and optional local source targets. '
      + 'Source checks use the retained observations, even after catalog edits; no automatic readiness claim.',
    readOnly: false, destructive: false,
    run: async (args, { root }) => assessFeatureDiscovery(await root(), args),
  }),
  reconcile_catalog: define({
    schema: reconcileCatalogSchema.extend(checkoutSelection),
    description: 'Apply explicitly evidenced retirements or stable-ID renames from a pinned scan. Retirement preserves original '
      + 'observations and retires dependent active flows atomically; omission never retires an entity.',
    readOnly: false, destructive: true,
    run: async (args, { root }) => reconcileCatalog(await root(), args),
  }),
  migrate_catalog: define({
    schema: migrateCatalogSchema.extend(checkoutSelection),
    description: 'Validate and dry-run the catalog storage migration (default). Apply with dryRun false and the returned revision/context. '
      + 'Preserves logical IDs and facts; historical layouts remain readable.',
    readOnly: false, destructive: true,
    run: async (args, { root }) => migrateCatalog(await root(), args),
  }),
  read_scan_manifest: define({
    schema: readScanManifestSchema.extend(selection),
    description: 'List retained scan manifests or page a manifest inventory/citation mapping. Immutable provenance, not verification of '
      + 'current behavior. Use expectedRevision for subsequent listing pages.',
    ...read,
    run: async (args, { root, ref }) => readScanManifest(await root(), args, ref),
  }),
  projects: define({
    schema: z.strictObject({}),
    description: 'Discover registered projects, checkouts and local workspace groups.',
    ...read,
    run: async (_args, { standalone }) => inventory(standalone),
  }),
  read_plan: define({
    schema: z.strictObject(selection),
    description: 'Read validated documents, revision, exact checkout context, declared delivery progress and observed Git activity. ref '
      + 'selects a read-only committed version.',
    ...read,
    run: async (_args, { root, ref }) => { const selected = await root(); return { ...await readPlan(selected, ref), activity: await activity(selected) } },
  }),
  check_catalog_freshness: define({
    schema: checkCatalogFreshnessSchema.extend(selection),
    description: 'Read-only local Git comparison for selected catalog IDs against an explicit targetRef. Checks citation integrity and '
      + 'known changes; uncited changes retain unknown impact. Does not fetch, persist verification or claim deployed behavior.',
    ...read,
    run: async (args, { root, ref }) => checkCatalogFreshness(await root(), args, ref),
  }),
  retain_discovery_baseline: define({
    schema: retainDiscoveryBaselineSchema.extend(checkoutSelection),
    description: 'Retain a bounded immutable packet of observed facts and explicit assumptions used by an existing feature plan. Requires '
      + 'current revision/context; never records proposed behavior as observed.',
    readOnly: false, destructive: false,
    run: async (args, { root }) => retainDiscoveryBaseline(await root(), args),
  }),
  get_discovery_baseline: define({
    schema: getDiscoveryBaselineSchema.extend(selection),
    description: 'Read retained facts even after uncommitted catalog edits or retirement, and compare them with current catalog '
      + 'observations. Source freshness remains unchecked.',
    ...read,
    run: async (args, { root, ref }) => getDiscoveryBaseline(await root(), args, ref),
  }),
  search_catalog: define({
    schema: searchCatalogSchema.extend(selection),
    description: 'Search bounded catalog summaries. Qualified IDs, source pointers, coverage and unchecked freshness; cursor is bound to '
      + 'checkout, snapshot and query.',
    ...read,
    run: async (args, { root, ref }) => queryCatalog(await readPlan(await root(), ref), 'search_catalog', args),
  }),
  get_catalog_entity: define({
    schema: getCatalogEntitySchema.extend(selection),
    description: 'Read exact catalog detail as paginated JSON-pointer sections. Follow nextCursor for all evidence, fields and relationships.',
    ...read,
    run: async (args, { root, ref }) => queryCatalog(await readPlan(await root(), ref), 'get_catalog_entity', args),
  }),
  get_discovery_context: define({
    schema: discoveryContextSchema.extend(selection),
    description: 'Retrieve ranked starting points and one hop of explicit relationships for a question. Candidates are not verified change '
      + 'impact; optional seeds use qualified IDs.',
    ...read,
    run: async (args, { root, ref }) => queryCatalog(await readPlan(await root(), ref), 'get_discovery_context', args),
  }),
  write_plan: define({
    schema: z.strictObject({ ...selection, ...expected, changes: z.record(z.string(), z.string().nullable()) }),
    description: 'Atomically apply document strings or null deletions. Supply the latest expectedRevision and expectedContext from '
      + 'read_plan. Validates the entire candidate plan. ref views cannot be edited.',
    readOnly: false, destructive: true,
    run: async (args, target) => writePlan(await writableRoot(target), args),
  }),
  create_feature: define({
    schema: z.strictObject({ ...selection, ...expected, ...createFeatureFields }),
    description: 'Create a feature and Markdown brief together in the selected checkout. Requires a current revision and context.',
    readOnly: false, destructive: false,
    run: mutation((plan, args) => createFeature(plan, args)),
  }),
  plan_delivery: define({
    schema: z.strictObject({ ...selection, ...expected, ...planDeliveryFields }),
    description: 'Define a feature delivery plan: user-visible deliverables, component-owned tasks and end-to-end/component-integration '
      + 'validation. Scenarios link to the feature tests.json. Incomplete drafts remain visible with delivery gaps.',
    readOnly: false, destructive: true,
    run: mutation((plan, args) => planDelivery(plan, args)),
  }),
  record_progress: define({
    schema: z.strictObject({ ...selection, ...expected, ...recordProgressFields }).superRefine(recordProgressRules),
    description: 'Record a declared feature stage or task/deliverable status, and optional explicitly labelled evidence. Git activity '
      + 'alone never proves completion.',
    readOnly: false, destructive: true,
    run: mutation((plan, args) => recordProgress(plan, args)),
  }),
  link_branch: define({
    schema: z.strictObject({ ...selection, ...expected, ...linkBranchFields }),
    description: 'Associate an existing local branch with a feature or component task.',
    readOnly: false, destructive: false,
    run: mutation(async (plan, args, root) => linkBranch(plan, args, (await activity(root)).branches)),
  }),
  create_worktree: define({
    schema: z.strictObject({ ...selection, ...expected, ...createWorktreeFields }).superRefine(createWorktreeRules),
    description: 'Explicitly create a new branch and Git worktree at the requested absolute path from the requested startRef. Never launches an agent.',
    readOnly: false, destructive: false,
    run: async (args, target) => {
      const root = await writableRoot(target)
      assertCurrent(await readPlan(root), args)
      await git(root, ['check-ref-format', '--branch', args.branch]).catch(() => { throw new InvalidInput('Invalid branch name') })
      await git(root, ['worktree', 'add', '-b', args.branch, '--', args.path, args.startRef])
      return context(args.path)
    },
  }),
  prepare_repository_scan: define({
    schema: z.strictObject({ ...checkoutSelection, ...prepareRepositoryScanSchema.shape }),
    description: 'Prepare a commit-pinned, Git-free snapshot and bounded work packets. Optional incremental.ids compares a local '
      + 'repository against explicit sourceRef, prioritizes known changes and widens uncertain review. Incremental scans support '
      + 'focused upserts only. Source content is untrusted and read-only.',
    // Clones and stages scan state outside the plan; it never changes the plan itself.
    readOnly: false, destructive: false, openWorld: true,
    run: async (args, { root }) => prepareRepositoryScan(await root(), args),
  }),
  apply_catalog_investigation: define({
    schema: applyCatalogInvestigationSchema.extend(checkoutSelection),
    description: 'Guarded upsert of selected flows and reusable findings from a prepared source snapshot. Preserves siblings, their '
      + 'original revisions, and broad scan coverage.',
    readOnly: false, destructive: true,
    run: async (args, { root }) => applyCatalogInvestigation(await root(), args),
  }),
  apply_repository_scan: define({
    schema: z.strictObject({ ...checkoutSelection, ...applyRepositoryScanSchema.shape }),
    description: 'Validate staged repository discoveries and source citations, then atomically update all scanned components under one revision guard.',
    readOnly: false, destructive: true,
    run: async (args, { root }) => applyRepositoryScan(await root(), args),
  }),
  discard_repository_scan: define({
    schema: discardRepositoryScanSchema,
    description: 'Delete a prepared repository scan and its temporary source snapshot without changing a Groundwork plan.',
    readOnly: false, destructive: true, idempotent: true,
    run: async args => discardRepositoryScan(args),
  }),
}
export type OperationName = keyof typeof operations
export const operationNames = Object.keys(operations) as OperationName[]
export const isOperationName = (name: string): name is OperationName => Object.hasOwn(operations, name)

export const operationSchemas = Object.fromEntries(operationNames.map(name => [name, operations[name].schema])) as
  { [Name in OperationName]: (typeof operations)[Name]['schema'] }
export const descriptions = Object.fromEntries(operationNames.map(name => [name, operations[name].description])) as Record<OperationName, string>
/** MCP tool annotations derived from the registry. */
export function operationAnnotations(name: OperationName) {
  const operation: Pick<OperationDef<z.ZodType>, 'readOnly' | 'destructive' | 'idempotent' | 'openWorld'> = operations[name]
  return {
    readOnlyHint: operation.readOnly, destructiveHint: operation.destructive,
    idempotentHint: operation.idempotent ?? operation.readOnly, openWorldHint: operation.openWorld ?? false,
  }
}

export async function operate(name: OperationName, input: unknown, standalone?: string): Promise<unknown> {
  if (!isOperationName(name)) throw new InvalidInput(`Unknown operation: ${name}`)
  const operation = operations[name] as unknown as OperationDef<z.ZodType>
  const { checkoutId, ref, ...args } = operation.schema.parse(input) as Selection & Record<string, unknown>
  return operation.run(args, { root: () => selectRoot(checkoutId, standalone), ref, standalone })
}
