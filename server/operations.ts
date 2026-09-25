import { z } from 'zod'
import { catalogComponentSchema, catalogDocumentIssues } from '../shared/catalog-document.ts'
import { verifyCatalogSource } from './catalog-write.ts'
import { checkCatalogFreshness, catalogFreshnessSchema } from './catalog-freshness.ts'
import { queryCatalog, searchCatalogSchema, getCatalogEntitySchema } from './catalog.ts'
import { readPlan, writePlan, writeCatalogTarget } from './repository.ts'
import { selectRoot, inventory } from './registry.ts'
import { activity, context, git } from './git.ts'
import { InvalidInput } from './errors.ts'
import {
  assertCurrent, createFeature, createFeatureFields, planDelivery, planDeliveryFields, recordProgress, recordProgressFields, recordProgressRules,
  linkBranch, linkBranchFields, createWorktreeFields, createWorktreeRules,
} from './plan-mutations.ts'

const selection = { checkoutId: z.string().optional(), ref: z.string().optional() }
const checkoutSelection = { checkoutId: z.string().optional() }
const expected = { expectedRevision: z.string().min(1), expectedContext: z.string().min(1) }

type Plan = Awaited<ReturnType<typeof readPlan>>
type Selection = { checkoutId?: string; ref?: string }
/** Checkout selection is split from the payload once, before dispatch; the root is resolved only when an operation asks. */
type Target = { root: () => Promise<string>; ref?: string }
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
  write_catalog: define({
    schema: z.strictObject({ ...checkoutSelection, ...expected, repository: z.string().min(1),
      destination: z.enum(['source', 'local']), sourceRoot: z.string().min(1).optional(), component: catalogComponentSchema }),
    description: 'Replace one component catalog document at a pinned source commit. Requires source citations, explicit gaps, '
      + 'covered paths, and a current catalog revision and checkout context.',
    readOnly: false, destructive: true,
    run: async (args, target) => {
      const issues = catalogDocumentIssues(args.component, args.repository)
      if (issues.length) throw new InvalidInput(issues.join('; '))
      const root = await writableRoot(target)
      if (args.destination === 'local' && !args.sourceRoot) throw new InvalidInput('A local catalog write requires sourceRoot')
      await verifyCatalogSource(args.sourceRoot ?? root, args.repository, args.component)
      return writeCatalogTarget(root, args.repository, args.destination, {
        expectedRevision: args.expectedRevision, expectedContext: args.expectedContext,
        changes: { [`components/${args.component.id}.json`]: JSON.stringify(args.component, null, 2) + '\n' },
      })
    },
  }),
  projects: define({
    schema: z.strictObject({}),
    description: 'Discover registered projects, checkouts and local workspace groups.',
    ...read,
    run: async () => inventory(),
  }),
  read_plan: define({
    schema: z.strictObject(selection),
    description: 'Read validated documents, revision, exact checkout context, declared delivery progress and observed Git activity. ref '
      + 'selects a read-only committed version.',
    ...read,
    run: async (_args, { root, ref }) => { const selected = await root();
      return { ...await readPlan(selected, ref), activity: await activity(selected) } },
  }),
  check_catalog_freshness: define({
    schema: catalogFreshnessSchema.extend(selection),
    description: 'Compare each component observation with a local source commit. Report changed cited files, changed covered files '
      + 'without citations, and changed files outside every component. Does not fetch or claim runtime correctness.',
    ...read,
    run: async (args, { root, ref }) => checkCatalogFreshness(await root(), args, ref),
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

export async function operate(name: OperationName, input: unknown, scopeRoot?: string): Promise<unknown> {
  if (!isOperationName(name)) throw new InvalidInput(`Unknown operation: ${name}`)
  const operation = operations[name] as unknown as OperationDef<z.ZodType>
  const { checkoutId, ref, ...args } = operation.schema.parse(input) as Selection & Record<string, unknown>
  return operation.run(args, { root: () => scopeRoot ? Promise.resolve(scopeRoot) : selectRoot(checkoutId), ref })
}
