import type { Component } from '../../shared/model.ts'
import type { ComponentReference } from '../../shared/component-reference.ts'
import { repositoryIdentity } from '../../shared/repository-identity.ts'

/** A viewer-only ID. The tuple keeps repository and local component ID distinct even if either contains `#`. */
export const viewerComponentId = (repository: string, localId: string) =>
  JSON.stringify([repositoryIdentity(repository), localId])

/** Find the actual viewer ID for a stored repository/local ID pair after projection. */
export function selectViewerComponentId(components: Component[], repository: string, localId: string): string | undefined {
  const canonical = repositoryIdentity(repository)
  return components.find(component => repositoryIdentity(component.repo ?? canonical) === canonical
    && (component.id === localId || component.id === viewerComponentId(canonical, localId)))?.id
}

/**
 * Give the existing ID-based graph a unique, repository-qualified component set.
 * This changes only in-memory viewer values; persisted IDs and references remain untouched.
 * Resolved catalog components take precedence over home components at the same qualified identity.
 */
export function qualifyViewerComponents(homeComponents: Component[], homeRepository: string,
  resolvedComponents: Component[] = []): Component[] {
  const home = repositoryIdentity(homeRepository)
  const byKey = new Map<string, { component: Component; repository: string }>()
  for (const component of [...homeComponents, ...resolvedComponents]) {
    const repository = repositoryIdentity(component.repo ?? home)
    byKey.set(viewerComponentId(repository, component.id), { component, repository })
  }
  const byLocalId = new Map<string, string[]>()
  for (const [key, { component }] of byKey) byLocalId.set(component.id, [...byLocalId.get(component.id) ?? [], key])
  const viewerIds = new Map([...byKey].map(([key, { component }]) => [key,
    byLocalId.get(component.id)?.length === 1 ? component.id : key]))

  const dependency = (reference: ComponentReference): ComponentReference => {
    if (typeof reference !== 'string') {
      const key = viewerComponentId(reference.repository, reference.component)
      return viewerIds.get(key) ?? reference
    }
    const matches = byLocalId.get(reference) ?? []
    return matches.length === 1 ? viewerIds.get(matches[0])! : reference
  }
  const parent = (localId: string, childRepository: string) => {
    const sameRepository = viewerComponentId(childRepository, localId)
    if (byKey.has(sameRepository)) return viewerIds.get(sameRepository)!
    const matches = byLocalId.get(localId) ?? []
    return matches.length === 1 ? viewerIds.get(matches[0])! : localId
  }
  return [...byKey].map(([key, { component, repository }]) => ({
    ...component,
    id: viewerIds.get(key)!,
    repo: repository,
    ...(component.parentId ? { parentId: parent(component.parentId, repository) } : {}),
    ...(component.dependsOn ? { dependsOn: component.dependsOn.map(dependency) } : {}),
    ...(component.executionFlows ? { executionFlows: component.executionFlows.map(flow => ({
      ...flow,
      steps: flow.steps.map(step => ({ ...step,
        ...(step.dependencyIds ? { dependencyIds: step.dependencyIds.map(dependency) } : {}),
      })),
    })) } : {}),
  }))
}
