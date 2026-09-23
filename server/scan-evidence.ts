import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { scanEvidenceSchema, type RepositoryDiscovery, type ScanEvidence } from '../src/data/scan-schema.ts'
import type { Component } from '../src/data/model.ts'
import { lineCount, repositoryKey } from './catalog-freshness.ts'
import { filesForProject } from './scan-projects.ts'
import type { LoadedScan } from './scan-workspace.ts'

/**
 * Every citation in a record: `evidence[]` entries, plus `source` paths and `sourceRevision` values, which
 * freshness checks also treat as citations.
 */
export function citationFields(value: unknown, result = { evidence: [] as ScanEvidence[], sources: [] as string[], revisions: [] as string[] }) {
  if (Array.isArray(value)) for (const item of value) citationFields(item, result)
  else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.source === 'string') result.sources.push(record.source)
    if (typeof record.sourceRevision === 'string') result.revisions.push(record.sourceRevision)
    for (const [key, item] of Object.entries(record)) {
      if (key === 'evidence' && Array.isArray(item)) result.evidence.push(...scanEvidenceSchema.array().parse(item))
      else citationFields(item, result)
    }
  }
  return result
}

/** A citation as recorded; `validateCitations` enforces the scan evidence format. */
export interface Citation { path: string; lines: string; revision: string; repository?: string }

function blobDigest(content: Buffer, algorithm: 'sha1' | 'sha256') {
  return createHash(algorithm).update(`blob ${content.length}\0`).update(content).digest('hex')
}

/**
 * Checks citations against a prepared snapshot: same repository, the pinned revision, a file inside the project
 * `boundary`, unmodified committed bytes, and a line range inside the file. `sources` are bare file pointers
 * that must name a file inside the boundary.
 */
export async function validateCitations(scan: LoadedScan, boundary: string, citations: Citation[], sources: string[] = []) {
  const { directory, metadata } = scan
  const project = metadata.projects.find(project => project.path === boundary)
  if (!project) throw new Error(`${boundary}: project boundary was not detected by this scan`)
  const known = new Set(filesForProject(metadata.files, project, metadata.projects).map(file => file.path))
  for (const source of sources) if (!known.has(source)) throw new Error(`${source}: source is not a file in the scan snapshot`)
  const scanned = await repositoryKey(metadata.repository)
  const lineCounts = new Map<string, number>()
  for (const evidence of scanEvidenceSchema.array().parse(citations)) {
    if (evidence.repository && await repositoryKey(evidence.repository) !== scanned) {
      throw new Error('Evidence repository differs from the validated source snapshot')
    }
    if (evidence.revision !== metadata.revision) throw new Error(`${evidence.path}: evidence revision does not match the pinned scan revision`)
    if (!known.has(evidence.path)) throw new Error(`${evidence.path}: evidence path is not part of the scan snapshot`)
    let lines = lineCounts.get(evidence.path)
    if (lines === undefined) {
      const raw = await readFile(path.join(directory, 'source', ...evidence.path.split('/')))
      const expected = metadata.files.find(file => file.path === evidence.path)!.digest
      if (blobDigest(raw, expected.length === 64 ? 'sha256' : 'sha1') !== expected) throw new Error(`${evidence.path}: prepared source was modified`)
      lines = lineCount(raw.toString('utf8'))
      lineCounts.set(evidence.path, lines)
    }
    const [start, end = start] = evidence.lines.split('-').map(Number)
    if (start < 1 || end < start || end > lines) throw new Error(`${evidence.path}:${evidence.lines}: evidence line range is outside the scanned file`)
  }
}

/** Validates every citation a discovery carries, including `source` pointers and `sourceRevision` values. */
export async function validateDiscoveryCitations(scan: LoadedScan, discovery: RepositoryDiscovery) {
  const { evidence, sources, revisions } = citationFields(discovery)
  for (const revision of revisions) {
    if (revision !== scan.metadata.revision) throw new Error(`${discovery.id}: sourceRevision ${revision} does not match the pinned scan revision`)
  }
  await validateCitations(scan, discovery.sourcePath, evidence, sources)
}

export function requireClaimEvidence(discovery: RepositoryDiscovery) {
  const missing = (records: { id: string; evidence?: unknown[] }[] | undefined) => records?.find(record => !record.evidence?.length)
  if (discovery.dependsOn?.length && !discovery.evidence?.length) throw new Error(`${discovery.id}: resolved dependencies require evidence`)
  const endpoint = missing(discovery.api?.endpoints)
  if (endpoint) throw new Error(`${discovery.id}: API endpoint ${endpoint.id} requires evidence`)
  const schema = missing(discovery.api?.schemas)
  if (schema) throw new Error(`${discovery.id}: API schema ${schema.id} requires evidence`)
  const record = missing(discovery.data?.records)
  if (record) throw new Error(`${discovery.id}: data record ${record.id} requires evidence`)
  const message = missing(discovery.messaging?.messages)
  if (message) throw new Error(`${discovery.id}: message ${message.id} requires evidence`)
  for (const dependency of discovery.unresolvedDependencies ?? []) {
    if (!dependency.evidence.length) throw new Error(`${discovery.id}: unresolved dependency ${dependency.name} requires evidence`)
  }
}

/** A scan that covers an area must restate every active record in it; retirement goes through reconcile_catalog. */
export function requireRetainedInventory(previous: Component | undefined, discovery: RepositoryDiscovery) {
  const requireRetained = (kind: string, before: { id: string }[] | undefined, after: { id: string }[] | undefined) => {
    if (before?.some(item => !after?.some(next => next.id === item.id))) {
      throw new Error(`Scan omitted active ${kind} records; use reconcile_catalog for evidenced retirement before replacing this inventory`)
    }
  }
  if (discovery.coverage.api) {
    requireRetained('endpoint', previous?.api?.endpoints, discovery.api?.endpoints)
    requireRetained('schema', previous?.api?.schemas, discovery.api?.schemas)
  }
  if (discovery.coverage.data) requireRetained('data', previous?.data?.records, discovery.data?.records)
  if (discovery.coverage.messaging) requireRetained('message', previous?.messaging?.messages, discovery.messaging?.messages)
  if (discovery.executionFlows !== undefined) requireRetained('flow', previous?.executionFlows, discovery.executionFlows)
  if (discovery.jobs !== undefined) requireRetained('job', previous?.jobs, discovery.jobs)
}
