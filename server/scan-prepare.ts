import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { discardRepositoryScanSchema, prepareRepositoryScanSchema } from '../src/data/scan-schema.ts'
import { checkCatalogFreshness, repositoryKey } from './catalog-freshness.ts'
import { Conflict, InvalidInput } from './errors.ts'
import { readPlan } from './repository.ts'
import { acquire, listTree, readBlobs } from './scan-acquire.ts'
import { inventory } from './scan-inventory.ts'
import { incrementalMode, planPackets } from './scan-packets.ts'
import { incrementalApplyPolicy, incrementalReviewNote, workerContract } from './scan-policy.ts'
import { detectProjects, type InventoryFile } from './scan-projects.ts'
import { readonlyTree, removeScan, SCAN_TTL_MS, SCANNER_VERSION, scanDirectory, sweepScans, type ScanMetadata } from './scan-workspace.ts'

/** Freshness limits for the incremental check that narrows a preparation. */
const INCREMENTAL_MAX_FILES = 200
const INCREMENTAL_MAX_BYTES = 65536

async function writeSnapshot(directory: string, files: InventoryFile[], contents: Map<string, Buffer>) {
  for (const file of files) {
    const target = path.join(directory, ...file.path.split('/'))
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 })
    await writeFile(target, contents.get(file.path)!, { mode: 0o600, flag: 'wx' })
  }
}

export async function prepareRepositoryScan(root: string, input: unknown) {
  const args = prepareRepositoryScanSchema.parse(input)
  if (args.incremental && !args.sourceRef) throw new InvalidInput('Incremental preparation requires an explicit sourceRef and a matching local repository')
  const freshness = args.incremental ? await checkCatalogFreshness(root, {
    repositoryPath: args.repository, targetRef: args.sourceRef, ids: args.incremental.ids,
    maxFiles: INCREMENTAL_MAX_FILES, maxBytes: INCREMENTAL_MAX_BYTES,
  }) : undefined
  if (freshness && !freshness.targetRevision) {
    throw new InvalidInput(`Cannot pin incremental source: ${'reason' in freshness ? freshness.reason : 'unknown target'}`)
  }
  const incremental: ScanMetadata['incremental'] = freshness ? { mode: incrementalMode(freshness), report: freshness } : undefined
  const changedPaths = new Set(freshness && 'changes' in freshness ? freshness.changes.flatMap(change => change.files) : [])
  const base = await sweepScans()
  const temporary = await mkdtemp(path.join(base, 'pending-'))
  const id = randomUUID()
  const directory = scanDirectory(id)
  try {
    const acquisition = path.join(temporary, 'acquisition')
    const source = path.join(temporary, 'source')
    await mkdir(source, { recursive: true, mode: 0o700 })
    await mkdir(path.join(temporary, 'output'), { recursive: true, mode: 0o700 })
    const acquired = await acquire(args.repository, freshness?.targetRevision ?? args.sourceRef, acquisition)
    const plan = await readPlan(root)
    if (freshness && (freshness.catalogRevision !== plan.revision || freshness.context !== plan.context.token)) {
      throw new Conflict('Catalog changed during preparation; repeat incremental preparation')
    }
    const tree = await listTree(acquisition, acquired.revision)
    const { files, contents, excluded, dependencyFingerprints, omittedDependencyFingerprints } = await inventory(
      tree, args.budgets, digests => readBlobs(acquisition, digests),
    )
    await writeSnapshot(source, files, contents)
    const components = await Promise.all(plan.snapshot.components.map(async component => ({
      ...component, repo: component.repo ? await repositoryKey(component.repo) : component.repo,
    })))
    const projects = await detectProjects(source, files, await repositoryKey(acquired.repository), components)
    const { packets, skipped } = planPackets({
      projects, files, areas: args.areas, budgets: args.budgets,
      outputDirectory: path.join(directory, 'output'),
      incremental: incremental && { mode: incremental.mode, changedPaths },
    })
    if (skipped) excluded['packet-budget'] = skipped
    const createdAt = new Date()
    const metadata: ScanMetadata = {
      schemaVersion: 1,
      scannerVersion: SCANNER_VERSION,
      requestedRef: args.sourceRef ?? null,
      budgets: args.budgets,
      dependencyFingerprints,
      omittedDependencyFingerprints,
      id,
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + SCAN_TTL_MS).toISOString(),
      repository: acquired.repository,
      revision: acquired.revision,
      targetProjectId: plan.manifest.id,
      targetCheckoutId: plan.context.checkoutId,
      areas: args.areas,
      files,
      projects,
      packets,
      excluded,
      ...(incremental ? { incremental } : {}),
    }
    await writeFile(path.join(temporary, 'scan.json'), JSON.stringify(metadata, null, 2), { mode: 0o600 })
    await rm(acquisition, { recursive: true, force: true })
    await readonlyTree(source)
    await rename(temporary, directory)
    const snapshotPaths = new Set(files.map(file => file.path))
    return {
      scanId: id,
      ...(incremental ? {
        incremental,
        changedPathsOutsideSnapshot: [...changedPaths].filter(changed => !snapshotPaths.has(changed)),
        reviewNote: incrementalReviewNote,
        applyPolicy: incrementalApplyPolicy,
      } : {}),
      repository: acquired.repository,
      revision: acquired.revision,
      sourcePath: path.join(directory, 'source'),
      outputPath: path.join(directory, 'output'),
      projects,
      packets,
      excluded,
      limitsReached: Object.hasOwn(excluded, 'budget') || Object.hasOwn(excluded, 'packet-budget'),
      target: {
        project: plan.manifest,
        products: plan.snapshot.products.map(product => ({ id: product.id, name: product.name, kind: product.kind, description: product.description })),
        revision: plan.revision,
        context: plan.context,
      },
      workerContract,
    }
  } catch (error) {
    await removeScan(temporary)
    throw error
  }
}

export async function discardRepositoryScan(input: unknown) {
  const { scanId } = discardRepositoryScanSchema.parse(input)
  await removeScan(scanDirectory(scanId))
  return { discarded: scanId }
}
