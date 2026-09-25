import { InvalidInput } from './errors.ts'
import type { Files } from './format.ts'
import { CATALOG_DIR, GROUNDWORK_DIR, LOCAL_CATALOGS_DIR, MEMBERS_DIR, PHYSICAL_DOCUMENT_SOURCE, PLANS_DIR, PRODUCTS_DIR } from './paths.ts'

export const physicalDocumentPattern = new RegExp(`^(?:${PHYSICAL_DOCUMENT_SOURCE})$`)
const root = `${GROUNDWORK_DIR}/`
const plans = `${PLANS_DIR}/`
const catalog = `${CATALOG_DIR}/`
const members = `${MEMBERS_DIR}/`
const products = `${PRODUCTS_DIR}/`

/** Map one logical document to its single physical home. */
export function physicalPath(name: string): string {
  if (name.startsWith('products/') || name.startsWith('members/')) return root + name
  if (name.startsWith('components/')) return catalog + name
  return plans + name
}

export function encodeStorage(files: Files): Files {
  return Object.fromEntries(Object.entries(files).map(([name, raw]) => [physicalPath(name), raw]))
}

export function decodeStorage(physical: Files): { files: Files } {
  const files: Files = {}
  for (const [name, raw] of Object.entries(physical)) {
    if (name.startsWith(`${LOCAL_CATALOGS_DIR}/`)) continue
    let logical: string
    if (name.startsWith(products) || name.startsWith(members)) logical = name.slice(root.length)
    else if (name.startsWith(catalog)) logical = name.slice(catalog.length)
    else if (name.startsWith(plans)) logical = name.slice(plans.length)
    else throw new InvalidInput(`Unsupported Groundwork document: ${name}`)
    files[logical] = raw
  }
  return { files }
}

export function encodeCatalogAt(files: Files, directory: string): Files {
  if (Object.keys(files).some(name => !/^components\/[a-zA-Z0-9_-]+\.json$/.test(name))) {
    throw new InvalidInput('A local catalog contains only component documents')
  }
  return Object.fromEntries(Object.entries(files).map(([name, raw]) => [`${directory}/${name}`, raw]))
}

export function decodeCatalogAt(physical: Files, directory: string): Files {
  return Object.fromEntries(Object.entries(physical).filter(([name]) => name.startsWith(`${directory}/`))
    .map(([name, raw]) => [name.slice(directory.length + 1), raw]))
}
