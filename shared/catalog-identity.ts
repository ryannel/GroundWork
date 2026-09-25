/** Stable catalog IDs always name the source repository, component and entry. */
export const catalogKinds = ['component', 'endpoint', 'schema', 'data', 'message', 'flow', 'job'] as const
export type CatalogKind = typeof catalogKinds[number]
export class CatalogIdError extends Error {}
export function catalogId(repository: string, component: string, kind: CatalogKind, entity: string) {
  const segments = [repository, component, kind, entity]
  if (segments.some(segment => !segment)) throw new CatalogIdError('A catalog ID needs a repository, component, kind and entity')
  if (!catalogKinds.includes(kind)) throw new CatalogIdError(`Unknown catalog kind: ${kind}`)
  return segments.map(encodeURIComponent).join('/')
}
export function parseCatalogId(value: string) {
  const parts = value.split('/')
  if (parts.length !== 4) throw new CatalogIdError('Use a repository/component/kind/entity catalog ID')
  let decoded: string[]
  try { decoded = parts.map(decodeURIComponent) }
  catch { throw new CatalogIdError('Invalid catalog ID') }
  const [scope, component, kind, entity] = decoded
  if (!scope || !component || !entity || !catalogKinds.includes(kind as CatalogKind)
    || catalogId(scope, component, kind as CatalogKind, entity) !== value) {
    throw new CatalogIdError('Invalid catalog ID')
  }
  return { scope, component, kind: kind as CatalogKind, entity }
}
