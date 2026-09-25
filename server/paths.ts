import { parseRemote } from '../src/data/repository-identity.ts'

/** On-disk layout of a Groundwork checkout. Every module that touches `.groundwork` names paths from here. */
export const GROUNDWORK_DIR = '.groundwork'
/** Feature documents, decisions and raster assets (and, in the legacy layout, the whole catalog). */
export const PLANS_DIR = `${GROUNDWORK_DIR}/plans`
/** Split catalog documents (products, components, scans) in the catalog-v1 layout. */
export const CATALOG_DIR = `${GROUNDWORK_DIR}/catalog`
/** Products in the v3 layout; the legacy and split layouts keep them inside the plans or catalog directory. */
export const PRODUCTS_DIR = `${GROUNDWORK_DIR}/products`
/** A v3 home's catalogs of *other* repositories, one directory per repository host and path. */
export const LOCAL_CATALOGS_DIR = `${GROUNDWORK_DIR}/local-catalogs`
/** Portable physical path of another repository's catalog, using its canonical host and path. */
export function localCatalogDirectory(repository: string) {
  const remote = parseRemote(repository)
  const value = remote ? `${remote.host}/${remote.path}`
    : repository.startsWith('local:') ? `local/${repository.slice('local:'.length)}` : ''
  const segments = value.split('/')
  if (segments.length < 2 || segments.some(segment => !/^(?:[a-zA-Z0-9][a-zA-Z0-9._:-]*|\[[0-9a-fA-F:.]+\](?::[0-9]+)?)$/.test(segment)
    || segment === '..' || segment === '.')) throw new Error(`Invalid repository identity for local catalog: ${repository}`)
  return `${LOCAL_CATALOGS_DIR}/${segments.join('/')}`
}
/** The immutable legacy ID map a migrated home keeps so content-addressed records still resolve. */
export const LEGACY_IDS_FILE = `${GROUNDWORK_DIR}/legacy-ids.json`
export const MEMBERS_DIR = `${GROUNDWORK_DIR}/members`
export const PROJECT_FILE = `${GROUNDWORK_DIR}/project.json`
/** Agent guide and JSON Schemas that `installInstructions` copies into a checkout. */
export const GUIDE_FILE = `${GROUNDWORK_DIR}/GUIDE.md`
export const SCHEMAS_DIR = `${GROUNDWORK_DIR}/schemas`
/** Held while one process writes; never committed. */
export const LOCK_FILE = `${GROUNDWORK_DIR}/write.lock`
/** Before/after images of an in-flight write; its presence means recovery is pending. */
export const JOURNAL_FILE = `${GROUNDWORK_DIR}/transaction.json`
/** Prefix of the staging directory `initialise` renames into place. */
export const INIT_STAGING_PREFIX = `${GROUNDWORK_DIR}/init-`
/** Every path that holds catalog or planning documents. */
export const STORAGE_ROOTS = [PLANS_DIR, CATALOG_DIR, MEMBERS_DIR, PRODUCTS_DIR, LOCAL_CATALOGS_DIR, PROJECT_FILE, LEGACY_IDS_FILE] as const
/** Entries Groundwork adds to a repository's .gitignore. */
export const IGNORED_PATHS = ['node_modules/', LOCK_FILE, JOURNAL_FILE, `${INIT_STAGING_PREFIX}*`, `${GROUNDWORK_DIR}/**/*.tmp`] as const

export const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024
/** Temporary files written next to their target by `atomicFile` (`<name>.<uuid>.tmp`). */
export const TEMP_FILE_PATTERN = /\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.tmp$/

const id = '[a-zA-Z0-9_-]+'
/** One path segment of a repository identity used as a directory name under local-catalogs/; never `.` or `..`. */
const repositorySegment = '[a-zA-Z0-9][a-zA-Z0-9._-]*'
/** A bracketed IPv6 literal, the form a normalised identity spells an IPv6 host in: `[2001:db8::1]`. */
const ipv6Segment = '\\[[0-9a-fA-F.]*:[0-9a-fA-F:.]*\\]'
/** The host segment of a repository identity, which keeps a non-default port, as `ghe.example.com:2222`. */
const repositoryHost = `(?:${repositorySegment}|${ipv6Segment})(?::[0-9]+)?`
/** Unanchored source of a logical planning document path; both document patterns compose from it. */
export const LOGICAL_DOCUMENT_SOURCE = [
  'scan-manifests/[a-f0-9]{64}\\.json',
  'project\\.json',
  `(?:products|components|members)/${id}\\.json`,
  `features/${id}/(?:feature|journey|design|flow|api|storage|tests|delivery)\\.json`,
  `features/${id}/(?:baselines|assessments)/[a-f0-9]{64}\\.json`,
  `features/${id}/brief\\.md`,
  `(?:decisions|features/${id}/decisions)/${id}\\.md`,
].join('|')
/** Unanchored source of the documents in a catalog directory, shared by `catalog/` and every `local-catalogs/<repository>/`. */
export const CATALOG_DOCUMENT_SOURCE = 'scans/[a-f0-9]{64}\\.json'
  + `|components/${id}/(?:component|api|data|messaging|knowledge)\\.json|components/${id}/flows/${id}\\.json`
/** Unanchored source of a physical document path in any storage layout. */
export const PHYSICAL_DOCUMENT_SOURCE = [
  `\\.groundwork/plans/(?:${LOGICAL_DOCUMENT_SOURCE})`,
  '\\.groundwork/project\\.json',
  '\\.groundwork/legacy-ids\\.json',
  `\\.groundwork/members/${id}\\.json`,
  `\\.groundwork/products/${id}\\.json`,
  `\\.groundwork/catalog/(?:layout\\.json|products/${id}\\.json|${CATALOG_DOCUMENT_SOURCE})`,
  `\\.groundwork/local-catalogs/${repositoryHost}(?:/${repositorySegment})+/(?:${CATALOG_DOCUMENT_SOURCE})`,
].join('|')
