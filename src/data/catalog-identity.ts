import { z } from 'zod'
import { repositoryIdentity } from './repository-identity.ts'

/** Logical catalog identity is independent of the portable directory layout. */
export const catalogKinds = ['component', 'endpoint', 'schema', 'data', 'message', 'flow', 'finding', 'job'] as const
export type CatalogKind = typeof catalogKinds[number]
/**
 * A catalog ID qualifies an entity by its scope, component, kind and entity, each URI-encoded. The scope is the
 * repository identity (`volvo-cars%2Fgpe-pretax`) in the migrated form and the project's manifest ID in the legacy
 * one. Both forms parse, and lookups accept either, so nothing persisted before the migration has to be rewritten.
 */
export function catalogId(scope: string, component: string, kind: CatalogKind, entity: string) {
  const segments = [scope, component, kind, entity]
  // An empty segment would compose an ID that parseCatalogId refuses, so it is refused where it is built instead.
  if (segments.some(segment => !segment)) throw new CatalogIdError('A catalog ID needs a scope, component, kind and entity')
  if (!catalogKinds.includes(kind)) throw new CatalogIdError(`Unknown catalog kind: ${kind}`)
  return segments.map(encodeURIComponent).join('/')
}
/** A caller-supplied catalog ID that does not parse; the HTTP layer maps it to 400. */
export class CatalogIdError extends Error {}
export function parseCatalogId(value: string) {
  const parts = value.split('/')
  if (parts.length !== 4) throw new CatalogIdError('Use a repository/component/kind/entity catalog ID')
  let decoded: string[]
  try {
    decoded = parts.map(decodeURIComponent)
  } catch {
    throw new CatalogIdError('Invalid catalog ID')
  }
  const [scope, component, kind, entity] = decoded
  const known = catalogKinds.includes(kind as CatalogKind)
  if (!scope || !component || !entity || !known || catalogId(scope, component, kind as CatalogKind, entity) !== value) {
    throw new CatalogIdError('Invalid catalog ID')
  }
  return { scope, component, kind: kind as CatalogKind, entity }
}

/**
 * The immutable legacy ID map. A home's catalog can describe other repositories, so a legacy ID's first segment
 * names the *home*, not the repository the entity lives in; only this map can say which repository that was.
 * Migration writes it to `legacy-ids.json`; until then it is derived in memory and never written.
 */
export const legacyIdMapSchema = z.strictObject({
  version: z.literal(1),
  ids: z.record(z.string().min(1), z.string().min(1)),
})
export interface LegacyIdMap {
  /** Explicit whole-ID translations, as `legacy-ids.json` records them. */
  ids: Map<string, string>
  /** `<legacy-scope>/<component>` → repository identity, the rule the explicit entries follow. */
  scopes: Map<string, string>
  /**
   * The `<legacy-scope>/<component>` keys the evidence disagreed about. A key here has no rule, so only an
   * explicit whole-ID entry can translate its IDs; migration reports them rather than picking a repository.
   */
  conflicts: Set<string>
}
export const emptyLegacyIdMap = (): LegacyIdMap => ({ ids: new Map(), scopes: new Map(), conflicts: new Set() })
export const legacyScopeKey = (scope: string, component: string) => `${encodeURIComponent(scope)}/${encodeURIComponent(component)}`

/**
 * Records that `scope/component/…` legacy IDs belong to `repository`. Evidence is read in whatever order the home
 * happens to store it, so conflicting evidence cannot be resolved by taking the first: the rule is dropped and the
 * key is reported as a conflict instead, leaving its IDs untranslated rather than attributed to a guess.
 */
export function recordLegacyScope(map: LegacyIdMap, scope: string, component: string, repository: string | undefined | null) {
  if (!repository) return
  const key = legacyScopeKey(scope, component)
  if (map.conflicts.has(key)) return
  const identity = repositoryIdentity(repository)
  const known = map.scopes.get(key)
  if (known === undefined) { map.scopes.set(key, identity); return }
  if (known === identity) return
  map.scopes.delete(key)
  map.conflicts.add(key)
}

/**
 * The map in a form that survives JSON, which its `Map`s do not. Both the explicit entries and the derived rules
 * are kept, because both decide which IDs an entry answers to. Conflicts stay explicit so a viewer cannot invent
 * an alias for a contested scope after the map has crossed JSON.
 */
export interface LegacyIdProjection { ids: Record<string, string>; scopes: Record<string, string>; conflicts?: string[] }
export const legacyIdProjection = (map: LegacyIdMap): LegacyIdProjection =>
  ({ ids: Object.fromEntries(map.ids), scopes: Object.fromEntries(map.scopes), conflicts: [...map.conflicts] })
export const legacyIdMapFromProjection = (projection: LegacyIdProjection): LegacyIdMap =>
  ({ ids: new Map(Object.entries(projection.ids ?? {})), scopes: new Map(Object.entries(projection.scopes ?? {})), conflicts: new Set(projection.conflicts ?? []) })

/** Reads a stored `legacy-ids.json`, keeping both its explicit entries and the component rules they imply. */
export function parseLegacyIdMap(raw: string): LegacyIdMap {
  const map = emptyLegacyIdMap()
  const stored = legacyIdMapSchema.parse(JSON.parse(raw))
  for (const [legacy, current] of Object.entries(stored.ids)) {
    map.ids.set(legacy, current)
    try {
      const from = parseCatalogId(legacy), to = parseCatalogId(current)
      if (from.component === to.component) recordLegacyScope(map, from.scope, from.component, to.scope)
    } catch { /* An entry that is not a catalog ID stays an explicit translation only. */ }
  }
  return map
}

/**
 * The migrated form of a legacy ID, or null when the map cannot say which repository it belonged to. An ID the map
 * cannot resolve is kept unchanged and shown as unresolved, never guessed.
 */
export function translateCatalogId(value: string, map: LegacyIdMap): string | null {
  const explicit = map.ids.get(value)
  if (explicit) return explicit
  let parsed: ReturnType<typeof parseCatalogId>
  try { parsed = parseCatalogId(value) } catch { return null }
  const repository = map.scopes.get(legacyScopeKey(parsed.scope, parsed.component))
  if (repository === undefined) return null
  return catalogId(repository, parsed.component, parsed.kind, parsed.entity)
}

/** Every form of one catalog ID: the value itself first, then its migrated form when the map knows one. */
export function catalogIdForms(value: string, map: LegacyIdMap): string[] {
  const translated = translateCatalogId(value, map)
  return translated && translated !== value ? [value, translated] : [value]
}

/**
 * The map read backwards: which legacy IDs translate to a migrated one. A migrated home stores its IDs in the new
 * form, so the aliases it must also answer to are the legacy IDs that pointed at them, which only this direction
 * can name.
 */
export interface LegacyIdIndex {
  /** Migrated ID → the legacy IDs explicitly translated to it. */
  ids: Map<string, string[]>
  /** `<repository>/<component>` → the legacy scopes that named it, from the unambiguous rules only. */
  scopes: Map<string, string[]>
}
export function legacyIdIndex(map: LegacyIdMap): LegacyIdIndex {
  const index: LegacyIdIndex = { ids: new Map(), scopes: new Map() }
  const push = (into: Map<string, string[]>, key: string, value: string) => {
    const known = into.get(key)
    if (known) { if (!known.includes(value)) known.push(value) } else into.set(key, [value])
  }
  for (const [legacy, current] of map.ids) push(index.ids, current, legacy)
  for (const [key, repository] of map.scopes) {
    const [scope, component] = key.split('/').map(decodeURIComponent)
    push(index.scopes, legacyScopeKey(repository, component), scope)
  }
  return index
}
/** The legacy IDs that resolve to `value`, excluding `value` itself. Order is stable, so aliases do not churn. */
export function legacyIdForms(value: string, index: LegacyIdIndex): string[] {
  const forms = new Set(index.ids.get(value) ?? [])
  try {
    const parsed = parseCatalogId(value)
    for (const scope of index.scopes.get(legacyScopeKey(parsed.scope, parsed.component)) ?? []) {
      forms.add(catalogId(scope, parsed.component, parsed.kind, parsed.entity))
    }
  } catch { /* Not a catalog ID, so no rule can name a legacy form of it. */ }
  forms.delete(value)
  return [...forms]
}

/** The explicit entries of a map, in the shape migration persists. */
export function legacyIdMapDocument(map: LegacyIdMap) {
  return { version: 1 as const, ids: Object.fromEntries([...map.ids].sort(([a], [b]) => a.localeCompare(b))) }
}
