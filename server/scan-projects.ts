import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Component } from '../src/data/model.ts'
import type { ScanArea } from '../src/data/scan-schema.ts'
import { idPattern } from '../src/data/schema-primitives.ts'
import { digest } from './git.ts'

export type { ScanArea }
export interface InventoryFile { path: string; digest: string; bytes: number }
export interface DetectedProject {
  path: string; name: string; suggestedId: string; manifest: string; existingComponentId?: string
  /** The ID this boundary derives from its manifest name and folder, independently of what the catalog holds. */
  derivedId: string
}

export const manifestNames = new Set([
  'package.json', 'go.mod', 'cargo.toml', 'pyproject.toml', 'pom.xml', 'build.gradle',
  'build.gradle.kts', 'composer.json', 'gemfile', 'mix.exs',
])
export const identityNames = new Set([
  'catalog-info.yaml', 'catalog-info.yml', 'backstage.yaml', 'backstage.yml', 'codeowners',
  'readme.md', 'dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
])
export const laneTerms: Record<ScanArea, RegExp> = {
  dependencies: /(?:^|[/._-])(client|provider|adapter|dependency|dependencies|config|manifest|package)(?:[/._-]|$)/i,
  api: /(?:^|[/._-])(api|openapi|swagger|graphql|proto|route|routes|router|controller|controllers|handler|handlers|endpoint|endpoints|dto|schema|interface|interfaces)(?:[/._-]|$)/i,
  data: /(?:^|[/._-])(data|database|db|migration|migrations|schema|model|models|entity|entities|record|records|repository|repositories|storage|store|redis|sql|prisma)(?:[/._-]|$)/i,
  messaging: /(?:^|[/._-])(event|events|message|messages|messaging|queue|queues|topic|topics|kafka|pubsub|publisher|publishers|consumer|consumers|producer|producers|asyncapi)(?:[/._-]|$)/i,
}

/** A directory segment that holds tests or fixtures: `test`, `tests`, `Api.Tests`, `unit-tests`, `IntegrationTests`, `__tests__`. Not `latest`. */
export function isTestSegment(segment: string) {
  return /^(?:.*[._-])?tests?$/i.test(segment) || /[a-z]Tests?$/.test(segment)
    || ['__tests__', 'assets', 'fixtures', 'approvedresults'].includes(segment.toLowerCase())
}

function repositoryName(repository: string) {
  return repository.split('/').at(-1)!.replace(/\.git$/, '')
}

/** Reads top-level `metadata` keys from a Backstage `catalog-info.yaml`; nested keys (annotations, labels) are ignored. */
export function catalogMetadata(source: string) {
  if (!/^kind:\s*Component\s*$/mi.test(source)) return null
  const lines = source.split(/\r?\n/)
  const start = lines.findIndex(line => /^metadata:\s*$/i.test(line))
  const block: string[] = []
  if (start >= 0) for (let index = start + 1; index < lines.length && (!lines[index].trim() || /^\s/.test(lines[index])); index++) block.push(lines[index])
  const indent = block.find(line => line.trim())?.match(/^\s*/)?.[0] ?? ''
  const value = (key: string) => {
    const line = block.find(line => line.startsWith(indent) && new RegExp(`^${key}:`, 'i').test(line.slice(indent.length)))
    return line?.slice(indent.length).replace(new RegExp(`^${key}:\\s*`, 'i'), '').trim().replace(/^(['"])(.*)\1$/, '$2') || undefined
  }
  return { title: value('title'), name: value('name') }
}

export function slug(value: string) {
  return value.toLowerCase().replace(/^@[^/]+\//, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'component'
}

/**
 * Characters a derived ID cannot spell, each as a `_` escape, so the encoding is prefix-free and reversible. `/`
 * is not here: inside a path it separates folders and becomes `-`, which is why a literal `-` in a folder has to
 * be escaped. Anything else, including every non-ASCII character, becomes one `_x` escape per UTF-8 byte.
 */
const idEscapes: Record<string, string> = { '-': '_h', _: '_u', '.': '_d' }
const idBytes = (value: string) => [...new TextEncoder().encode(value)].map(byte => `_x${byte.toString(16).padStart(2, '0')}`).join('')
/** Upper case is kept: the component ID schema allows it, and folding it would make `App` and `app` the same project. */
const encodeIdCharacter = (character: string) => /^[a-zA-Z0-9]$/.test(character) ? character
  : idEscapes[character] ?? idBytes(character)
/**
 * The manifest name as one token. A literal `-` is kept, because hyphenated package names are the common case, but
 * never twice in a row: `--` separates the name from the folder, so an encoded name must not be able to spell it.
 */
function encodeManifestName(name: string) {
  // An npm scope names the publisher, not the project, and two manifests cannot share a folder, so dropping it
  // cannot make two components collide.
  let encoded = ''
  for (const character of name.trim().replace(/^@[^/]+\//, '')) {
    encoded += character !== '-' ? encodeIdCharacter(character) : encoded.endsWith('-') ? idEscapes['-'] : '-'
  }
  return encoded
}
/** The folder below the repository root: `/` becomes `-`, so `services/price` reads as `services-price`. */
const encodeSourcePath = (sourcePath: string) => sourcePath.replace(/^\.\//, '').replace(/\/+$/, '').split('/')
  .map(segment => [...segment].map(encodeIdCharacter).join('')).join('-')
/** Longer than this and a derived ID stops being a usable directory name, so it is truncated with its own digest. */
const MAX_DERIVED_ID = 120
const DERIVED_DIGEST = 16

/**
 * The ID a build project derives from its manifest name and its normalised folder, so a clean scan and an
 * incremental scan of the same commit agree. A project at the repository root uses its name alone. The folder is
 * always appended below the root, whether or not another project shares the name, so adding a same-named project
 * later cannot change an ID that was already derived.
 *
 * The encoding is injective, not a slug: `services/price` and `services-price` are different folders and must keep
 * different IDs, as must `price.v2` and `price-v2`, `foo_bar` and `foo-bar`, and names that differ only in case or
 * in non-ASCII characters. Lower-case ASCII names and folders read as themselves — `api` in `services/price` is
 * `api--services-price` — and everything else takes a `_` escape. A name or path too long to be a directory name
 * is truncated and closed with a digest of its own name and path, so it still depends on nothing else.
 */
export function derivedComponentId(name: string, sourcePath: string) {
  const base = encodeManifestName(name)
  const encoded = sourcePath === '.' || !sourcePath ? base : `${base}--${encodeSourcePath(sourcePath)}`
  // `_y` and `_z` are sequences the escapes never produce, so a repaired ID can never collide with an encoded one.
  const limited = encoded.length <= MAX_DERIVED_ID ? encoded
    : `${encoded.slice(0, MAX_DERIVED_ID - DERIVED_DIGEST - 2)}_y${digest(`${name}\n${sourcePath}`).slice(0, DERIVED_DIGEST)}`
  return idPattern.test(limited) ? limited : `c_z${limited}`
}

/** What a match needs to know about a detected boundary: where it is and what ID a scan of it derives. */
export interface DetectedBoundary { path: string; derivedId: string }
/** The latest reconciliation of a component, which is the only one that still describes where it came from. */
const latestIdentityChange = (component: Component) => component.identityChanges?.at(-1)
/**
 * Assigns each detected boundary the component that already describes it, so a renamed or moved build project is
 * not catalogued twice. A component claims the boundary at its own source path; a component whose own path this
 * scan no longer finds also claims the boundary its **latest** reconciliation moved away from. Earlier entries in
 * the history are never matched: after `old` → `previous` → `current`, a project created at `previous` since is a
 * new project, not the one that left. One component claims at most one boundary, and ties are broken by component
 * ID, so the result never depends on document order.
 */
export function matchComponents(existing: Component[], repository: string, detected: DetectedBoundary[]) {
  const inRepository = existing.filter(component => component.repo === repository)
    .sort((a, b) => a.id.localeCompare(b.id))
  const boundaries = [...detected].sort((a, b) => a.path.localeCompare(b.path))
  const paths = new Set(boundaries.map(boundary => boundary.path))
  const claimed = new Set<Component>()
  const matches = new Map<string, Component>()
  const claim = (boundary: DetectedBoundary, component: Component | undefined) => {
    if (!component) return
    claimed.add(component)
    matches.set(boundary.path, component)
  }
  for (const boundary of boundaries) {
    claim(boundary, inRepository.find(component => !claimed.has(component) && (component.sourcePath ?? '.') === boundary.path))
  }
  for (const boundary of boundaries) {
    if (matches.has(boundary.path)) continue
    claim(boundary, inRepository.find(component => {
      if (claimed.has(component) || paths.has(component.sourcePath ?? '.')) return false
      const change = latestIdentityChange(component)
      return !!change && change.previousSourcePath === boundary.path
    }))
  }
  return matches
}
/** The component one detected boundary belongs to, given every boundary the same scan found. */
export const matchComponent = (existing: Component[], repository: string, boundary: DetectedBoundary, detected: DetectedBoundary[] = [boundary]) =>
  matchComponents(existing, repository, detected).get(boundary.path)

/**
 * Finds the projects inside a snapshot. `snapshot` holds the committed bytes of `files`; `repository` and the
 * `repo` of each existing component must already be comparison keys (see repositoryKey).
 */
export async function detectProjects(snapshot: string, files: InventoryFile[], repository: string, existing: Component[]): Promise<DetectedProject[]> {
  const read = (file: string) => readFile(path.join(snapshot, ...file.split('/')), 'utf8')
  const catalog = files.find(file => file.path === 'catalog-info.yaml' || file.path === 'catalog-info.yml')
  const metadata = catalog ? catalogMetadata(await read(catalog.path)) : null
  if (catalog && metadata) {
    const displayName = metadata.title ?? metadata.name ?? repositoryName(repository)
    const derivedId = derivedComponentId(metadata.name ?? displayName, '.')
    const match = matchComponent(existing, repository, { path: '.', derivedId })
    return [{
      path: '.',
      name: displayName,
      derivedId,
      suggestedId: match?.id ?? derivedId,
      manifest: catalog.path,
      ...(match ? { existingComponentId: match.id } : {}),
    }]
  }
  // A catalogued repository-wide component is an established boundary. Its
  // library projects are implementation details, not newly discovered services.
  const registered = existing.filter(component => component.repo === repository)
  const rootBuildManifest = files.some(file => !file.path.includes('/')
    && (manifestNames.has(file.path.toLowerCase()) || file.path.toLowerCase().endsWith('.csproj')))
  if (registered.length === 1 && (registered[0].sourcePath ?? '.') === '.' && !rootBuildManifest) {
    const component = registered[0]
    const manifest = files.find(file => manifestNames.has(path.posix.basename(file.path).toLowerCase()) || file.path.endsWith('.sln'))
    return [{
      path: '.', name: component.name, derivedId: derivedComponentId(component.name, '.'),
      suggestedId: component.id, existingComponentId: component.id, manifest: manifest?.path ?? 'README.md',
    }]
  }
  const manifests = files.filter(file => {
    const name = path.posix.basename(file.path).toLowerCase()
    return (manifestNames.has(name) || name.endsWith('.csproj'))
      && !path.posix.dirname(file.path).split('/').some(isTestSegment)
  })
  const roots = new Map<string, InventoryFile>()
  for (const manifest of manifests) {
    const root = path.posix.dirname(manifest.path)
    if (!roots.has(root)) roots.set(root, manifest)
  }
  if (!roots.size) roots.set('.', { path: 'README.md', digest: '', bytes: 0 })
  const detected: (DetectedBoundary & { name: string; manifest: string })[] = []
  for (const [root, manifest] of roots) {
    let name = root === '.' ? repositoryName(repository) : path.posix.basename(root)
    if (path.posix.basename(manifest.path).toLowerCase() === 'package.json') {
      const value = JSON.parse(await read(manifest.path))
      if (typeof value?.name === 'string') name = value.name
    }
    const sourcePath = root === '.' ? '.' : root
    detected.push({ path: sourcePath, name, derivedId: derivedComponentId(name, sourcePath), manifest: manifest.path })
  }
  // Matching considers every boundary at once, so one component cannot claim two of them.
  const matches = matchComponents(existing, repository, detected)
  const projects: DetectedProject[] = detected.map(({ name, manifest, path: sourcePath, derivedId }) => {
    const match = matches.get(sourcePath)
    return {
      path: sourcePath,
      name,
      derivedId,
      suggestedId: match?.id ?? derivedId,
      manifest,
      ...(match ? { existingComponentId: match.id } : {}),
    }
  })
  return projects.sort((a, b) => a.path.localeCompare(b.path))
}

export function filesForProject(files: InventoryFile[], project: DetectedProject, projects: DetectedProject[]) {
  const prefix = project.path === '.' ? '' : `${project.path}/`
  const descendants = projects
    .filter(candidate => candidate.path !== project.path && (project.path === '.' || candidate.path.startsWith(prefix)))
    .map(candidate => `${candidate.path}/`)
  return files.filter(file => file.path.startsWith(prefix) && !descendants.some(child => file.path.startsWith(child)))
}

export function packetFiles(files: InventoryFile[], area: ScanArea, project: DetectedProject) {
  const identity = files.filter(file => {
    const name = path.posix.basename(file.path).toLowerCase()
    return identityNames.has(name) || file.path === project.manifest
  })
  const relevant = files.filter(file => laneTerms[area].test(file.path) && !path.posix.dirname(file.path).split('/').some(isTestSegment))
  return [...new Set([...identity, ...relevant].map(file => file.path))]
}
