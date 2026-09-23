import path from 'node:path'
import type { ScanArea } from '../src/data/scan-schema.ts'
import { digest } from './git.ts'
import { filesForProject, packetFiles, slug, type DetectedProject, type InventoryFile } from './scan-projects.ts'

export type IncrementalMode = 'unchanged' | 'focused' | 'broader-review'

/** The parts of a freshness report that decide how much an incremental scan must re-examine. */
export interface FreshnessSummary {
  status: string
  assessments: {
    unmappedChanges: number
    broaderReviewChanges: { count: number }
    invalidCitations: { count: number }
    ancestry: string
  }[]
  changes?: { files: string[]; omittedFiles: number }[]
}

/**
 * `unchanged`: nothing to re-examine. `focused`: every change is a known citation on a descendant commit, so only
 * changed files need review. Anything else (unmapped, dependency-level or omitted changes, invalid citations,
 * divergent history or an unknown status) widens to `broader-review` of every project file.
 */
export function incrementalMode(report: FreshnessSummary): IncrementalMode {
  if (report.status === 'unchanged-source-tree') return 'unchanged'
  if (report.status !== 'review-required' || !report.changes) return 'broader-review'
  if (report.changes.some(change => change.omittedFiles > 0)) return 'broader-review'
  const contained = report.assessments.every(item =>
    item.unmappedChanges === 0
    && item.broaderReviewChanges.count === 0
    && item.invalidCitations.count === 0
    && item.ancestry === 'same-or-descendant')
  return contained ? 'focused' : 'broader-review'
}

export interface PacketPlanInput {
  projects: DetectedProject[]
  files: InventoryFile[]
  areas: ScanArea[]
  budgets: { maxFilesPerPacket: number; maxPackets: number }
  /** Directory the worker writes packet results to. */
  outputDirectory: string
  incremental?: { mode: IncrementalMode; changedPaths: Set<string> }
}

/**
 * Splits each project's lane into packets of at most `maxFilesPerPacket` files. Packets beyond `maxPackets`
 * are not created; `skipped` counts them so the scan reports its limits.
 */
export function planPackets(input: PacketPlanInput) {
  const { budgets, incremental } = input
  const packets: { id: string; projectPath: string; componentId: string; area: ScanArea; files: string[]; availableFiles: number; outputPath: string }[] = []
  let skipped = 0
  for (const project of input.projects) {
    const projectFiles = filesForProject(input.files, project, input.projects)
    for (const area of input.areas) {
      let candidates: string[]
      if (!incremental) candidates = packetFiles(projectFiles, area, project)
      else if (incremental.mode === 'unchanged') candidates = []
      else if (incremental.mode === 'focused') candidates = projectFiles.filter(file => incremental.changedPaths.has(file.path)).map(file => file.path)
      else candidates = projectFiles.map(file => file.path)
      if (incremental && candidates.length === 0) continue
      const parts = Math.max(1, Math.ceil(candidates.length / budgets.maxFilesPerPacket))
      for (let part = 0; part < parts; part++) {
        if (packets.length >= budgets.maxPackets) { skipped += parts - part; break }
        const suffix = parts > 1 ? `-part-${part + 1}` : ''
        const id = `${slug(project.suggestedId)}-${digest(project.path).slice(0, 8)}-${area}${suffix}`
        packets.push({
          id,
          projectPath: project.path,
          componentId: project.suggestedId,
          area,
          files: candidates.slice(part * budgets.maxFilesPerPacket, (part + 1) * budgets.maxFilesPerPacket),
          availableFiles: candidates.length,
          outputPath: path.join(input.outputDirectory, `${id}.json`),
        })
      }
    }
  }
  return { packets, skipped }
}
