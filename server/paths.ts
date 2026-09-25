import { parseRemote } from '../shared/repository-identity.ts'

/** On-disk layout of a Groundwork checkout. Every module that touches `.groundwork` names paths from here. */
export const GROUNDWORK_DIR = '.groundwork'
/** Feature documents, decisions and raster assets. */
export const PLANS_DIR = `${GROUNDWORK_DIR}/plans`
/** Source catalog documents. */
export const CATALOG_DIR = `${GROUNDWORK_DIR}/catalog`
/** Product documents. */
export const PRODUCTS_DIR = `${GROUNDWORK_DIR}/products`
/** Local catalogs of other repositories, one directory per repository host and path. */
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
export const MEMBERS_DIR = `${GROUNDWORK_DIR}/members`
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
export const STORAGE_ROOTS = [PLANS_DIR, CATALOG_DIR, MEMBERS_DIR, PRODUCTS_DIR, LOCAL_CATALOGS_DIR] as const
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
  `(?:products|components|members)/${id}\\.json`,
  `features/${id}/(?:feature|journey|design|flow|api|storage|tests|delivery)\\.json`,
  `features/${id}/brief\\.md`,
  `(?:decisions|features/${id}/decisions)/${id}\\.md`,
].join('|')
/** A physical component document in either catalog destination. */
export const CATALOG_DOCUMENT_SOURCE = `components/${id}\\.json`
export const PHYSICAL_DOCUMENT_SOURCE = [
  `\\.groundwork/plans/(?:features/${id}/(?:feature|journey|design|flow|api|storage|tests|delivery)\\.json`
    + `|features/${id}/brief\\.md|(?:decisions|features/${id}/decisions)/${id}\\.md)`,
  `\\.groundwork/members/${id}\\.json`,
  `\\.groundwork/products/${id}\\.json`,
  `\\.groundwork/catalog/${CATALOG_DOCUMENT_SOURCE}`,
  `\\.groundwork/local-catalogs/${repositoryHost}(?:/${repositorySegment})+/${CATALOG_DOCUMENT_SOURCE}`,
].join('|')
