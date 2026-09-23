import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Component } from '../src/data/model.ts'
import type { ScanArea } from '../src/data/scan-schema.ts'
import { digest } from './git.ts'

export type { ScanArea }
export interface InventoryFile { path: string; digest: string; bytes: number }
export interface DetectedProject { path: string; name: string; suggestedId: string; manifest: string; existingComponentId?: string }

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
 * Finds the projects inside a snapshot. `snapshot` holds the committed bytes of `files`; `repository` and the
 * `repo` of each existing component must already be comparison keys (see repositoryKey).
 */
export async function detectProjects(snapshot: string, files: InventoryFile[], repository: string, existing: Component[]): Promise<DetectedProject[]> {
  const read = (file: string) => readFile(path.join(snapshot, ...file.split('/')), 'utf8')
  const catalog = files.find(file => file.path === 'catalog-info.yaml' || file.path === 'catalog-info.yml')
  const metadata = catalog ? catalogMetadata(await read(catalog.path)) : null
  if (catalog && metadata) {
    const displayName = metadata.title ?? metadata.name ?? repositoryName(repository)
    const match = existing.find(component => component.repo === repository && (component.sourcePath ?? '.') === '.')
    return [{
      path: '.',
      name: displayName,
      suggestedId: match?.id ?? slug(metadata.name ?? displayName),
      manifest: catalog.path,
      ...(match ? { existingComponentId: match.id } : {}),
    }]
  }
  // A catalogued repository-wide component is an established boundary. Its
  // library projects are implementation details, not newly discovered services.
  const registered = existing.filter(component => component.repo === repository)
  if (registered.length === 1 && (registered[0].sourcePath ?? '.') === '.') {
    const component = registered[0]
    const manifest = files.find(file => manifestNames.has(path.posix.basename(file.path).toLowerCase()) || file.path.endsWith('.sln'))
    return [{ path: '.', name: component.name, suggestedId: component.id, existingComponentId: component.id, manifest: manifest?.path ?? 'README.md' }]
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
  const projects: DetectedProject[] = []
  for (const [root, manifest] of roots) {
    let name = root === '.' ? repositoryName(repository) : path.posix.basename(root)
    if (path.posix.basename(manifest.path).toLowerCase() === 'package.json') {
      const value = JSON.parse(await read(manifest.path))
      if (typeof value?.name === 'string') name = value.name
    }
    const sourcePath = root === '.' ? '.' : root
    const match = existing.find(component => component.repo === repository && (component.sourcePath ?? '.') === sourcePath)
    projects.push({
      path: sourcePath,
      name,
      suggestedId: match?.id ?? slug(name),
      manifest: manifest.path,
      ...(match ? { existingComponentId: match.id } : {}),
    })
  }
  const counts = new Map<string, number>()
  for (const project of projects) counts.set(project.suggestedId, (counts.get(project.suggestedId) ?? 0) + 1)
  for (const project of projects) {
    if (!project.existingComponentId && counts.get(project.suggestedId)! > 1) project.suggestedId = `${project.suggestedId}-${digest(project.path).slice(0, 6)}`
  }
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
