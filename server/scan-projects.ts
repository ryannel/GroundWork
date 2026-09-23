import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Component } from '../src/data/model.ts'
import { digest } from './git.ts'

export type ScanArea = 'dependencies' | 'api' | 'data' | 'messaging'
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

export function slug(value: string) {
  return value.toLowerCase().replace(/^@[^/]+\//, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'component'
}

export async function detectProjects(acquisition: string, files: InventoryFile[], repository: string, existing: Component[]): Promise<DetectedProject[]> {
  const catalog = files.find(file => file.path === 'catalog-info.yaml' || file.path === 'catalog-info.yml')
  if (catalog) {
    const source = await readFile(path.join(acquisition, catalog.path), 'utf8')
    if (/^kind:\s*Component\s*$/mi.test(source)) {
      const lines = source.split(/\r?\n/)
      const start = lines.findIndex(line => /^metadata:\s*$/i.test(line))
      const metadata: string[] = []
      if (start >= 0) for (let index = start + 1; index < lines.length && (!lines[index].trim() || /^\s/.test(lines[index])); index++) metadata.push(lines[index])
      const value = (key: string) => metadata.find(line => new RegExp(`^\\s+${key}:`, 'i').test(line))
        ?.replace(new RegExp(`^\\s+${key}:\\s*`, 'i'), '').trim().replace(/^(['"])(.*)\1$/, '$2')
      const title = value('title')
      const name = value('name')
      const displayName = title ?? name ?? repository.split('/').at(-1)!.replace(/\.git$/, '')
      const match = existing.find(component => component.repo === repository && (component.sourcePath ?? '.') === '.')
      return [{
        path: '.',
        name: displayName,
        suggestedId: match?.id ?? slug(name ?? displayName),
        manifest: catalog.path,
        ...(match ? { existingComponentId: match.id } : {}),
      }]
    }
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
      && !/(?:^|[./_-])tests?(?:[./_-]|$)/i.test(path.posix.dirname(file.path))
  })
  const roots = new Map<string, InventoryFile>()
  for (const manifest of manifests) {
    const root = path.posix.dirname(manifest.path)
    if (!roots.has(root)) roots.set(root, manifest)
  }
  if (!roots.size) roots.set('.', { path: 'README.md', digest: '', bytes: 0 })
  const projects: DetectedProject[] = []
  for (const [root, manifest] of roots) {
    let name = root === '.' ? repository.split('/').at(-1)!.replace(/\.git$/, '') : path.posix.basename(root)
    if (path.posix.basename(manifest.path).toLowerCase() === 'package.json') {
      const value = JSON.parse(await readFile(path.join(acquisition, ...manifest.path.split('/')), 'utf8'))
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
  const relevant = files.filter(file =>
    laneTerms[area].test(file.path)
    && !/(?:^|\/)(?:[^/]*(?:\.tests?|tests?)|assets|fixtures|approvedresults)(?:\/|$)/i.test(file.path),
  )
  return [...new Set([...identity, ...relevant].map(file => file.path))]
}
