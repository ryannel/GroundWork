/** On-disk layout of a Groundwork checkout. Every module that touches `.groundwork` names paths from here. */
export const GROUNDWORK_DIR = '.groundwork'
/** Feature documents, decisions and raster assets (and, in the legacy layout, the whole catalog). */
export const PLANS_DIR = `${GROUNDWORK_DIR}/plans`
/** Split catalog documents (products, components, scans) in the catalog-v1 layout. */
export const CATALOG_DIR = `${GROUNDWORK_DIR}/catalog`
export const MEMBERS_DIR = `${GROUNDWORK_DIR}/members`
export const PROJECT_FILE = `${GROUNDWORK_DIR}/project.json`
/** Held while one process writes; never committed. */
export const LOCK_FILE = `${GROUNDWORK_DIR}/write.lock`
/** Before/after images of an in-flight write; its presence means recovery is pending. */
export const JOURNAL_FILE = `${GROUNDWORK_DIR}/transaction.json`
/** Prefix of the staging directory `initialise` renames into place. */
export const INIT_STAGING_PREFIX = `${GROUNDWORK_DIR}/init-`
/** Every path that holds catalog or planning documents. */
export const STORAGE_ROOTS = [PLANS_DIR, CATALOG_DIR, MEMBERS_DIR, PROJECT_FILE] as const
/** Entries Groundwork adds to a repository's .gitignore. */
export const IGNORED_PATHS = ['node_modules/', LOCK_FILE, JOURNAL_FILE, `${INIT_STAGING_PREFIX}*`, `${GROUNDWORK_DIR}/**/*.tmp`] as const

export const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024
/** Temporary files written next to their target by `atomicFile` (`<name>.<uuid>.tmp`). */
export const TEMP_FILE_PATTERN = /\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.tmp$/

const id = '[a-zA-Z0-9_-]+'
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
/** Unanchored source of a physical document path in either storage layout. */
export const PHYSICAL_DOCUMENT_SOURCE = [
  `\\.groundwork/plans/(?:${LOGICAL_DOCUMENT_SOURCE})`,
  '\\.groundwork/project\\.json',
  `\\.groundwork/members/${id}\\.json`,
  `\\.groundwork/catalog/(?:layout\\.json|products/${id}\\.json|scans/[a-f0-9]{64}\\.json`
    + `|components/${id}/(?:component|api|data|messaging|knowledge)\\.json|components/${id}/flows/${id}\\.json)`,
].join('|')
