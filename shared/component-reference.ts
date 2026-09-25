import { repositoryIdentity } from './repository-identity.ts'
import type { Component } from './model.ts'

/**
 * A reference to a component. The migrated form names the repository the component belongs to, because components
 * are qualified by repository and not by product; a bare local name only means anything
 * while the catalog that holds it still shows which repository each component is in.
 */
export type ComponentReference = string | { repository: string; component: string }

export const referenceComponent = (reference: ComponentReference) => typeof reference === 'string' ? reference : reference.component
export const referenceRepository = (reference: ComponentReference) => typeof reference === 'string' ? undefined : reference.repository
/** How a reference reads in text: `volvo-cars/gpe-pretax#pretax-api` for a qualified one, the bare name otherwise. */
export const referenceLabel = (reference: ComponentReference) =>
  typeof reference === 'string' ? reference : `${reference.repository}#${reference.component}`

/** Which repository each catalogued component belongs to; a declared component has none of its own. */
export function componentRepositories(components: Component[], home?: string) {
  const repositories = new Map<string, string | undefined>()
  for (const component of components) {
    repositories.set(component.id, component.repo ? repositoryIdentity(component.repo) : home)
  }
  return repositories
}

export interface ResolvedReference {
  /** The local component ID the reference names. */
  component: string
  /** The repository the reference names, when it says or the catalog knows. */
  repository?: string
  /** Whether a component in the loaded catalog answers to this reference. */
  resolved: boolean
  label: string
}
/**
 * Resolves one reference against the loaded catalog. A bare name resolves to the component with that ID, whichever
 * repository it turns out to be in; a qualified reference resolves only when that component is in that repository,
 * because two repositories may each hold a component of the same name. Anything else stays unresolved and is shown
 * as such, never guessed into a repository it might not belong to.
 */
export function resolveComponentReference(reference: ComponentReference, repositories: Map<string, string | undefined>): ResolvedReference {
  const component = referenceComponent(reference)
  const declared = referenceRepository(reference)
  const known = repositories.get(component)
  if (declared === undefined) {
    return { component, repository: known, resolved: repositories.has(component), label: referenceLabel(reference) }
  }
  const wanted = repositoryIdentity(declared)
  const resolved = repositories.has(component) && known !== undefined && known === wanted
  return { component, repository: wanted, resolved, label: referenceLabel(reference) }
}

/**
 * What two references must agree on to be the same dependency. A reference the catalog resolves is keyed by the
 * component it resolves to, so `db` and `{repository: "acme/db", component: "db"}` are one dependency when the
 * catalog places `db` in `acme/db`. A reference nothing resolves cannot be shown to mean the same component as a
 * differently written one, so it keeps its own form as its key rather than being assumed equivalent.
 */
export function referenceKey(reference: ComponentReference, repositories?: Map<string, string | undefined>): string {
  const resolved = repositories && resolveComponentReference(reference, repositories)
  if (resolved?.resolved) return `${resolved.repository ?? ''}#${resolved.component}`
  return `?${referenceLabel(reference)}`
}
