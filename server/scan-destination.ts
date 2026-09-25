import { access, realpath } from 'node:fs/promises'
import { constants } from 'node:fs'
import { repositoryIdentity } from '../src/data/repository-identity.ts'
import { Conflict, InvalidInput } from './errors.ts'
import { activity, context } from './git.ts'
import { inventory as hubInventory } from './registry.ts'
import { readCatalogTarget, readPlan } from './repository.ts'
import type { ScanMetadata } from './scan-workspace.ts'

export interface ScanDestination {
  kind: 'source' | 'local'
  root: string
  repository: string
  checkoutId: string
  revision: string
  context: string
}

/** Resolve and pin the physical catalog destination once, before the worker sees a source snapshot. */
export async function chooseScanDestination(homeRoot: string, input: string, repository: string,
  override?: 'source' | 'local'): Promise<{ destination: ScanDestination; warnings: string[] }> {
  const home = await readPlan(homeRoot)
  const canonical = repositoryIdentity(repository)
  const roots: string[] = []
  const explicit = await realpath(input).catch(() => null)
  if (explicit) roots.push(explicit)
  const registered = (await hubInventory()).filter(item => item.repositoryId === canonical)
  for (const item of registered.filter(item => item.preferred)) roots.push(item.root)
  for (const item of registered) roots.push(item.root)
  let sourceRoot: string | null = null
  for (const root of new Set(roots)) {
    const ctx = await context(root).catch(() => null)
    if (!ctx?.isGit || repositoryIdentity(ctx.repository.id) !== canonical) continue
    if (!await access(root, constants.W_OK).then(() => true, () => false)) continue
    sourceRoot = root
    break
  }
  // A legacy source home validates components against its own products. Until that home is migrated, a scan
  // prepared by another home cannot safely write its product-scoped findings into the source catalog.
  const externalLegacySource = sourceRoot && await realpath(sourceRoot) !== await realpath(homeRoot)
    && (await readCatalogTarget(sourceRoot, canonical, 'source')).layout !== 'catalog-v3'
  const kind = override ?? (sourceRoot && !externalLegacySource ? 'source' : 'local')
  if (kind === 'source' && !sourceRoot) throw new InvalidInput(`No writable checkout of ${canonical} is available for a source catalog`)
  if (kind === 'source' && externalLegacySource) throw new InvalidInput('Migrate the source home before writing another product\'s catalog into it; use a local destination')
  const root = kind === 'source' ? sourceRoot! : home.context.root
  const ctx = kind === 'source' ? await context(root) : home.context
  const target = await readCatalogTarget(root, canonical, kind)
  const destination: ScanDestination = {
    kind, root, repository: canonical, checkoutId: ctx.checkoutId,
    revision: target.revision, context: ctx.token,
  }
  const dirtyRoot = sourceRoot ?? explicit
  const changes = dirtyRoot ? (await activity(dirtyRoot).catch(() => null))?.changes ?? [] : []
  const warnings = changes.length ? [`The scanned clone ${dirtyRoot} has ${changes.length} uncommitted change(s); the scan observes committed revision only.`] : []
  if (externalLegacySource && kind === 'local') warnings.push('The source checkout uses a legacy product-scoped catalog; writing this scan to the home local catalog until it is migrated.')
  return { destination, warnings }
}

/** Every apply uses the destination frozen at preparation, not a freshly selected clone or catalog. */
export async function requirePreparedDestination(homeRoot: string, metadata: ScanMetadata,
  guard: { expectedRevision: string; expectedContext: string }) {
  const home = await readPlan(homeRoot)
  if (home.manifest.id !== metadata.targetProjectId || home.context.checkoutId !== metadata.targetCheckoutId) {
    throw new InvalidInput('Repository scan belongs to another Groundwork home or checkout')
  }
  if (metadata.homeRevision && (home.revision !== metadata.homeRevision || home.context.token !== metadata.homeContext)) {
    throw new Conflict('Home product declarations changed after scan preparation; prepare a new scan')
  }
  const destination = metadata.destination ?? {
    kind: 'local' as const, root: homeRoot, repository: metadata.repository,
    checkoutId: home.context.checkoutId, revision: home.revision, context: home.context.token,
  }
  if (destination.kind === 'local' && await realpath(destination.root) !== await realpath(homeRoot)) {
    throw new InvalidInput('Local catalog destination differs from its named home')
  }
  const target = await readCatalogTarget(destination.root, destination.repository, destination.kind)
  if (target.context.checkoutId !== destination.checkoutId
    || target.revision !== destination.revision || target.context.token !== destination.context) {
    throw new Conflict('Catalog destination changed after scan preparation; prepare a new scan')
  }
  if (guard.expectedRevision !== target.revision || guard.expectedContext !== target.context.token) {
    throw new Conflict('Stale catalog destination guard; re-read the prepared target')
  }
  return { home, destination, target }
}
