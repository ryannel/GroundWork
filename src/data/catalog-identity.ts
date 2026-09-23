/** Logical catalog identity is independent of the portable directory layout. */
export const catalogKinds = ['component', 'endpoint', 'schema', 'data', 'message', 'flow', 'finding', 'job'] as const
export type CatalogKind = typeof catalogKinds[number]
export function catalogId(project: string, component: string, kind: CatalogKind, entity: string) {
  return [project, component, kind, entity].map(encodeURIComponent).join('/')
}
export function parseCatalogId(value: string) {
  const parts = value.split('/')
  if (parts.length !== 4) throw new Error('Use a project/component/kind/entity catalog ID')
  const [project, component, kind, entity] = parts.map(decodeURIComponent)
  if (!project || !component || !entity || !catalogKinds.includes(kind as CatalogKind) || catalogId(project, component, kind as CatalogKind, entity) !== value) throw new Error('Invalid catalog ID')
  return { project, component, kind: kind as CatalogKind, entity }
}
