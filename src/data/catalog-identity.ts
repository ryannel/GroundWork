/** Logical catalog identity is independent of the portable directory layout. */
export const catalogKinds = ['component', 'endpoint', 'schema', 'data', 'message', 'flow', 'finding', 'job'] as const
export type CatalogKind = typeof catalogKinds[number]
export function catalogId(project: string, component: string, kind: CatalogKind, entity: string) {
  return [project, component, kind, entity].map(encodeURIComponent).join('/')
}
/** A caller-supplied catalog ID that does not parse; the HTTP layer maps it to 400. */
export class CatalogIdError extends Error {}
export function parseCatalogId(value: string) {
  const parts = value.split('/')
  if (parts.length !== 4) throw new CatalogIdError('Use a project/component/kind/entity catalog ID')
  let decoded: string[]
  try {
    decoded = parts.map(decodeURIComponent)
  } catch {
    throw new CatalogIdError('Invalid catalog ID')
  }
  const [project, component, kind, entity] = decoded
  const known = catalogKinds.includes(kind as CatalogKind)
  if (!project || !component || !entity || !known || catalogId(project, component, kind as CatalogKind, entity) !== value) {
    throw new CatalogIdError('Invalid catalog ID')
  }
  return { project, component, kind: kind as CatalogKind, entity }
}
