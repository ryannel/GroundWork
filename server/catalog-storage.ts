import { InvalidInput } from './errors.ts'
import { type Files } from './format.ts'
import {
  CATALOG_DIR, GROUNDWORK_DIR, LEGACY_IDS_FILE, LOCAL_CATALOGS_DIR, MEMBERS_DIR, PHYSICAL_DOCUMENT_SOURCE, PLANS_DIR, PRODUCTS_DIR, PROJECT_FILE,
} from './paths.ts'

export const layoutFile = `${CATALOG_DIR}/layout.json`
export const layoutText = '{"version":1}\n'
/** `legacy`: everything under plans/. `catalog-v1`: the split catalog beside project.json. `catalog-v3`: no project manifest at all. */
export type Layout = 'legacy' | 'catalog-v1' | 'catalog-v3'
export const physicalDocumentPattern = new RegExp(`^(?:${PHYSICAL_DOCUMENT_SOURCE})$`)
const plans = `${PLANS_DIR}/`, catalog = `${CATALOG_DIR}/`, members = `${MEMBERS_DIR}/`, groundwork = `${GROUNDWORK_DIR}/`
const components = `${CATALOG_DIR}/components/`
const products = `${PRODUCTS_DIR}/`, localCatalogs = `${LOCAL_CATALOGS_DIR}/`
const legacyProjectFile = `${PLANS_DIR}/project.json`

export function encodeStorage(files: Files, layout: Layout): Files {
  // Only migration writes the v3 layout, and it arrives with the last phase; until then every write stays legacy.
  if (layout === 'catalog-v3') throw new InvalidInput('This release reads the v3 layout but does not write it; migrate the home with a release that does')
  if (layout === 'legacy') return Object.fromEntries(Object.entries(files).map(([name, raw]) => [plans + name, raw]))
  const result: Files = { [layoutFile]: layoutText }
  for (const [name, raw] of Object.entries(files)) {
    if (name === 'project.json' || name.startsWith('members/')) result[groundwork + name] = raw
    else if (name.startsWith('products/')) result[catalog + name] = raw
    else if (name.startsWith('scan-manifests/')) result[`${catalog}scans/${name.split('/')[1]}`] = raw
    else if (name.startsWith('components/')) {
      const component = JSON.parse(raw)
      const { api, data, messaging, executionFlows, findings, ...metadata } = component
      const prefix = `${components}${name.slice('components/'.length, -5)}/`
      const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n'
      result[prefix + 'component.json'] = json(metadata)
      for (const [area, value] of Object.entries({ api, data, messaging })) if (value !== undefined) result[prefix + area + '.json'] = json(value)
      // Preserve an explicitly empty array separately from an omitted field.
      if (findings !== undefined || executionFlows !== undefined) {
        const flowOrder = executionFlows === undefined ? undefined : executionFlows.map((flow: { id: string }) => flow.id)
        result[prefix + 'knowledge.json'] = json({ ...(findings !== undefined ? { findings } : {}), ...(flowOrder !== undefined ? { flowOrder } : {}) })
      }
      for (const flow of executionFlows ?? []) result[prefix + `flows/${flow.id}.json`] = json(flow)
    } else result[plans + name] = raw
  }
  return result
}

export function decodeStorage(physical: Files): { files: Files; layout: Layout } {
  const split = physical[layoutFile] !== undefined || physical[PROJECT_FILE] !== undefined
  if (!split) {
    // A migrated home is marked by its legacy ID map, so a legacy manifest beside it is a pre-migration branch
    // that was merged afterwards, not a half-applied migration.
    if (physical[LEGACY_IDS_FILE] === undefined && (physical[legacyProjectFile] !== undefined || !Object.keys(physical).length)) {
      // The legacy manifest is what makes a home legacy, not the absence of anything else: a v3 home can hold
      // nothing but plan documents. An empty checkout stays legacy so it is still reported as uninitialised.
      if (Object.keys(physical).some(name => !name.startsWith(plans))) {
        throw new InvalidInput('Catalog files without a layout marker; repair or recover the migration')
      }
      return { layout: 'legacy', files: Object.fromEntries(Object.entries(physical).map(([name, raw]) => [name.slice(plans.length), raw])) }
    }
    return { layout: 'catalog-v3', files: decodeVersion3(physical) }
  }
  if (!physical[PROJECT_FILE] || physical[layoutFile] === undefined || JSON.parse(physical[layoutFile]).version !== 1) {
    throw new InvalidInput('Unsupported or incomplete catalog layout')
  }
  const files: Files = {}, componentIds = new Set<string>()
  for (const [name, raw] of Object.entries(physical)) {
    if (name === layoutFile) continue
    if (name.startsWith(plans)) {
      const logical = name.slice(plans.length)
      if (!/^(?:features\/|decisions\/)/.test(logical)) {
        throw new InvalidInput('Mixed catalog authority: legacy catalog documents exist in plans; recover or reconcile explicitly')
      }
      files[logical] = raw
    } else if (name === PROJECT_FILE || name.startsWith(members)) files[name.slice(groundwork.length)] = raw
    else if (name.startsWith(`${catalog}products/`)) files[name.slice(catalog.length)] = raw
    else if (name.startsWith(`${catalog}scans/`)) files[`scan-manifests/${name.split('/').at(-1)}`] = raw
    else if (name.startsWith(components)) componentIds.add(name.split('/')[3])
    else throw new InvalidInput(`Unknown catalog document: ${name}`)
  }
  for (const componentId of componentIds) files[`components/${componentId}.json`] = assembleComponent(physical, componentId)
  return { layout: 'catalog-v1', files }
}

/**
 * The migrated layout: products at the top of `.groundwork/`, this repository's own catalog under `catalog/`, and no
 * project manifest, because identity comes from the repository's origin. Local catalogs of other repositories and the
 * legacy ID map are accepted here so a v3 home loads; reading their content arrives with the phases that use them.
 * A branch created before the migration and merged afterwards brings legacy documents back under `plans/`; they are
 * read individually, as the format rules require, rather than being refused under a folder-level version.
 */
function decodeVersion3(physical: Files): Files {
  const files: Files = {}, merged: Files = {}, componentIds = new Set<string>()
  for (const [name, raw] of Object.entries(physical)) {
    if (name === LEGACY_IDS_FILE || name.startsWith(localCatalogs)) continue
    if (name.startsWith(plans)) {
      const logical = name.slice(plans.length)
      // The merged legacy manifest is superseded: a migrated home takes its identity from its repository.
      if (logical === 'project.json') continue
      if (/^(?:features\/|decisions\/)/.test(logical)) files[logical] = raw
      else merged[logical] = raw
    } else if (name.startsWith(members) || name.startsWith(products)) files[name.slice(groundwork.length)] = raw
    else if (name.startsWith(`${catalog}scans/`)) files[`scan-manifests/${name.split('/').at(-1)}`] = raw
    else if (name.startsWith(components)) componentIds.add(name.split('/')[3])
    else throw new InvalidInput(`Unknown catalog document: ${name}`)
  }
  for (const componentId of componentIds) files[`components/${componentId}.json`] = assembleComponent(physical, componentId)
  for (const [name, raw] of Object.entries(merged)) {
    if (files[name] !== undefined) throw new InvalidInput(`Merged pre-migration document conflicts with the migrated one: ${name}`)
    files[name] = raw
  }
  return files
}

/** Rebuilds one logical component document from the split files under `catalog/components/<id>/`. */
function assembleComponent(physical: Files, componentId: string): string {
  const prefix = `${components}${componentId}/`
  if (!physical[prefix + 'component.json']) throw new InvalidInput(`Missing component metadata: ${componentId}`)
  const component = JSON.parse(physical[prefix + 'component.json'])
  for (const field of ['api', 'data', 'messaging', 'executionFlows', 'findings']) {
    if (field in component) throw new InvalidInput(`Mixed component authority: ${componentId}.${field}`)
  }
  for (const area of ['api', 'data', 'messaging']) {
    const areaFile = physical[prefix + area + '.json']
    if (areaFile !== undefined) component[area] = JSON.parse(areaFile)
  }
  const knowledge = physical[prefix + 'knowledge.json'] === undefined ? {} : JSON.parse(physical[prefix + 'knowledge.json'])
  if (Object.keys(knowledge).some(key => !['findings', 'flowOrder'].includes(key))) throw new InvalidInput('Unsupported component knowledge field')
  if ('findings' in knowledge) component.findings = knowledge.findings
  const flowFiles = Object.keys(physical).filter(name => name.startsWith(prefix + 'flows/'))
  if ('flowOrder' in knowledge) {
    const order = knowledge.flowOrder
    if (!Array.isArray(order) || new Set(order).size !== order.length || flowFiles.length !== order.length) {
      throw new InvalidInput('Invalid flow inventory')
    }
    component.executionFlows = knowledge.flowOrder.map((flowId: string) => {
      const name = prefix + `flows/${flowId}.json`
      if (!flowFiles.includes(name)) throw new InvalidInput('Missing flow document')
      const flow = JSON.parse(physical[name]); if (flow.id !== flowId) throw new InvalidInput('Flow identity mismatch')
      return flow
    })
  } else if (flowFiles.length) throw new InvalidInput('Flow files require an ordered inventory')
  if (component.id !== componentId) throw new InvalidInput('Component directory identity mismatch')
  return JSON.stringify(component, null, 2) + '\n'
}
