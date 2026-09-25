import { lstat, readdir } from 'node:fs/promises'
import path from 'node:path'
import { productRepositories, validateProductRepositories } from '../src/data/content.ts'
import type { Product } from '../src/data/model.ts'
import { repositoryIdentity } from '../src/data/repository-identity.ts'
import { NotInitialised } from './format.ts'
import { configRoot, inventory, registry } from './registry.ts'
import { readHubRegistry } from './registry-v3.ts'
import { readPlan } from './repository.ts'

export interface LoadedHome {
  repository: string
  root: string
  products: Product[]
}

async function pathPatternExists(root: string, pattern: string): Promise<boolean> {
  if (pattern === '.') return true
  const segments = pattern.replace(/^\.\//, '').split('/')
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) return false
  let candidates = [root]
  for (const [index, segment] of segments.entries()) {
    const final = index === segments.length - 1
    const regex = new RegExp(`^${segment.split('*').map(part => part.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')).join('.*')}$`)
    const next: string[] = []
    for (const directory of candidates) {
      if (segment.includes('*')) {
        const children = await readdir(directory, { withFileTypes: true }).catch(() => [])
        for (const child of children) if (regex.test(child.name) && (final || child.isDirectory())) {
          next.push(path.join(directory, child.name))
        }
      } else {
        const child = path.join(directory, segment)
        const stat = await lstat(child).catch(() => null)
        if (stat && (final || stat.isDirectory())) next.push(child)
      }
    }
    if (!next.length) return false
    // A broad glob should not make validation walk an unbounded tree.
    candidates = next.slice(0, 10000)
  }
  return true
}

export async function validateClonedPaths(homes: LoadedHome[], clones: Map<string, string>): Promise<string[]> {
  const issues: string[] = []
  for (const home of homes) for (const product of home.products) for (const [index, entry] of (product.repositories ?? []).entries()) {
    const identities = [entry.repository, ...(entry.aliases ?? [])].map(repositoryIdentity)
    const clone = identities.map(identity => clones.get(identity)).find(Boolean)
    if (!clone) continue
    for (const pattern of entry.paths ?? []) if (!await pathPatternExists(clone, pattern)) {
      issues.push(`products/${home.repository}#${product.id}.json:repositories.${index}: path ${pattern} does not exist in cloned ${entry.repository}`)
    }
  }
  return issues
}

/** Product IDs are local to a home; qualify them before checking claims across homes. */
export function validateCrossHomeOwnership(homes: LoadedHome[]): string[] {
  const products = homes.flatMap(home => home.products.map(product => ({
    ...product, id: `${repositoryIdentity(home.repository)}#${product.id}`,
  })))
  return validateProductRepositories(products)
}

/** Load every registered home we can locate and report the exact coverage of the cross-home check. */
export async function validateAllHomes() {
  const hub = await readHubRegistry(configRoot())
  const checkouts = await inventory()
  const preferred = new Set(checkouts.filter(entry => entry.preferred).map(entry => entry.root))
  const clones = new Map(checkouts.filter(entry => entry.preferred && entry.repositoryId)
    .map(entry => [repositoryIdentity(entry.repositoryId!), entry.root]))
  const roots = hub ? checkouts.filter(entry => entry.registryVersion === 3 && entry.authoritativeHome).map(entry => entry.root)
    : (await registry()).projects.map(record => record.root)
  const ordered = [...new Set(roots)].sort((a, b) => Number(preferred.has(b)) - Number(preferred.has(a)))
  const homes: LoadedHome[] = []
  const authoritativeRepositories = new Set(checkouts.filter(entry => entry.registryVersion === 3 && entry.authoritativeHome)
    .map(entry => entry.repositoryId))
  const sourceOnly: string[] = hub ? [...new Set(checkouts.filter(entry => entry.registryVersion === 3
    && !entry.authoritativeHome && !authoritativeRepositories.has(entry.repositoryId) && !entry.error).map(entry => entry.root))] : []
  const unreadable: { root: string; error: string }[] = []
  const warnings: { root: string; warning: string }[] = []
  if (hub) {
    unreadable.push(...checkouts.filter(entry => entry.registryVersion === 3 && entry.error)
      .map(entry => ({ root: entry.root, error: entry.error! })))
    const discovered = new Set(checkouts.map(entry => entry.root))
    for (const root of Object.values(hub.checkouts).flat()) if (!discovered.has(root)) {
      unreadable.push({ root, error: 'Registered checkout is unavailable' })
    }
  }
  const covered = new Set<string>()
  for (const root of ordered) {
    try {
      const plan = await readPlan(root)
      if (plan.repository.warning) warnings.push({ root, warning: plan.repository.warning })
      const repository = repositoryIdentity(plan.repository.id)
      if (!plan.snapshot.products.length) { sourceOnly.push(root); continue }
      if (covered.has(repository)) continue
      covered.add(repository)
      homes.push({ repository, root, products: plan.snapshot.products.map(product => ({ ...product,
        repositories: productRepositories(product, plan.snapshot.products, plan.snapshot.components, plan.repository.id),
      })) })
    } catch (error) {
      if (error instanceof NotInitialised) sourceOnly.push(root)
      else unreadable.push({ root, error: (error as Error).message })
    }
  }
  const issues = [...validateCrossHomeOwnership(homes), ...await validateClonedPaths(homes, clones)]
  return {
    valid: !issues.length && !unreadable.length,
    coveredHomes: homes.map(({ repository, root, products }) => ({ repository, root, products: products.map(item => item.id) })),
    sourceOnly,
    unreadable,
    warnings,
    issues,
  }
}
