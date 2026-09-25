import { parseScanManifest, recordScanManifestScopes, type ScanManifest } from '../src/data/scan-manifest.ts'
import {
  emptyLegacyIdMap, parseCatalogId, parseLegacyIdMap, recordLegacyScope, type LegacyIdMap,
} from '../src/data/catalog-identity.ts'
import { knowledgeBaselineSchema, discoveryAssessmentSchema } from '../src/data/knowledge.ts'
import { digest } from './git.ts'
import { z } from 'zod'
import { ContentError, loadContent, type ContentSnapshot } from '../src/data/content.ts'
import { productReadSchema, productSchema, purposeSchema, type productRepositorySchema } from '../src/data/content-schema.ts'
import { identitySlug, repositoryIdentity, repositoryName, type RepositoryIdentity } from '../src/data/repository-identity.ts'
import { InvalidInput, NotFound } from './errors.ts'
import type { Layout } from './catalog-storage.ts'
import { LOGICAL_DOCUMENT_SOURCE, PLANS_DIR, PROJECT_FILE } from './paths.ts'

const id = z.string().regex(/^(?!(?:constructor|prototype|__proto__)$)[a-zA-Z0-9][a-zA-Z0-9_-]*$/)
const text = z.string().trim().min(1)
export const manifestSchema = z.strictObject({ schemaVersion: z.literal(2), id, name: text, domain: z.url().optional() })
export const portableProductSchema = productSchema.omit({ workspaceId: true })
/** What readers accept for a product: the legacy form and the migrated one. Writes keep using `portableProductSchema`. */
export const portableProductReadSchema = productReadSchema.omit({ workspaceId: true })
export { deliverySchema } from '../src/data/delivery.ts'
export type { Delivery } from '../src/data/delivery.ts'
import { validateDelivery, type Delivery } from '../src/data/delivery.ts'
import { parseDelivery } from '../src/data/delivery-legacy.ts'
export type Files = Record<string, string>
export interface Plan {
  manifest: z.infer<typeof manifestSchema>; snapshot: ContentSnapshot; delivery: Record<string, Delivery>; decisions: Record<string, string>
  /** Which repository each legacy catalog ID belonged to, so a stored ID still resolves after the migration. */
  legacyIds: LegacyIdMap
  /** What the documents were read with, so a derived plan can be re-parsed the same way rather than as a bare home. */
  source: PlanSource
}
/**
 * What a home's documents alone cannot say: which repository they live in, which layout they were read from, and
 * the raw `legacy-ids.json` a migrated home stores. An unmigrated home has no such file; its map is derived.
 */
export interface PlanSource { repository?: RepositoryIdentity; layout?: Layout; legacyIds?: string }
export const PLAN_DIRECTORY = PLANS_DIR
export const assetPattern = /^assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp|gif|avif)$/
export const documentPattern = new RegExp(`^(?:${LOGICAL_DOCUMENT_SOURCE})$`)
/** The folder has no project manifest yet; `groundwork-v2 init` creates one. */
export class NotInitialised extends NotFound {}

/** Brief prose has one authoritative location; the viewer is a projection. */
export function parseBrief(markdown: string) {
  const sections: Record<string, string> = {}
  let heading = ''
  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith('## ')) {
      heading = line.slice(3).trim()
      if (!['Problem', 'Outcome', 'Non-goals', 'Success criteria'].includes(heading) || heading in sections) {
        throw new InvalidInput(`Unknown or duplicate brief heading: ${heading}`)
      }
      sections[heading] = ''
    } else if (heading) sections[heading] += line + '\n'
    else if (line.trim() && !line.startsWith('# ')) throw new InvalidInput('Brief prose must appear under a section heading')
  }
  const bullets = (key: string) => (sections[key] ?? '').split('\n').filter(line => line.trim()).map(line => {
    if (!line.startsWith('- ')) throw new InvalidInput(`${key}: use one bullet per item`)
    return line.slice(2)
  })
  return purposeSchema.parse({ problem: sections.Problem?.trim(), outcome: sections.Outcome?.trim(),
    nonGoals: bullets('Non-goals'), success: bullets('Success criteria').map(line => {
      const match = /^\[([a-zA-Z0-9_-]+)\] (.+?)(?: \{tests: ([a-zA-Z0-9_, -]+)\})?$/.exec(line)
      if (!match) throw new InvalidInput('Success criteria: use - [stable-id] Criterion text {tests: test-id, another-id}')
      return { id: match[1], text: match[2], ...(match[3] ? { tests: match[3].split(',').map(id => id.trim()) } : {}) }
    }) })
}
type Purpose = z.infer<typeof purposeSchema>
const headingLine = /^## /m
const testsSuffix = / \{tests: [a-zA-Z0-9_, -]+\}$/
/** Returns why `purpose` cannot be written as a brief that parses back to the same value, or null. */
export function briefProblem(purpose: Purpose): string | null {
  for (const [label, value] of [['Problem', purpose.problem], ['Outcome', purpose.outcome]] as const) {
    if (headingLine.test(value)) return `${label}: a line cannot start with "## "; that marks a brief section`
  }
  for (const item of purpose.nonGoals ?? []) if (/[\r\n]/.test(item)) return 'Non-goals: each item must be a single line'
  for (const item of purpose.success ?? []) {
    if (/[\r\n]/.test(item.text)) return `Success criteria: ${item.id} must be a single line`
    if (testsSuffix.test(item.text)) return `Success criteria: ${item.id} cannot end with "{tests: ...}"; list tests in the tests field`
  }
  return null
}
/** Inverse of `parseBrief` for any purpose `briefProblem` accepts. */
export function renderBrief(purpose: Purpose) {
  const problem = briefProblem(purpose)
  if (problem) throw new InvalidInput(problem)
  const nonGoals = (purpose.nonGoals ?? []).map(item => `- ${item}`).join('\n')
  const success = (purpose.success ?? [])
    .map(item => `- [${item.id}] ${item.text}${item.tests?.length ? ` {tests: ${item.tests.join(', ')}}` : ''}`)
    .join('\n')
  return `# Feature brief\n\n## Problem\n\n${purpose.problem}\n\n## Outcome\n\n${purpose.outcome}\n\n`
    + `## Non-goals\n\n${nonGoals}\n\n## Success criteria\n\n${success}\n`
}
type ProductRepository = z.infer<typeof productRepositorySchema>
/** Whether an owned-path declaration covers a component's source path. `*` matches within one path segment. */
function covers(pattern: string, sourcePath: string): boolean {
  const clean = (value: string) => value.replace(/^\.?\//, '').replace(/\/+$/, '')
  const expression = new RegExp(`^${clean(pattern).replaceAll(/[.*+?^${}()|[\]\\]/g, match => match === '*' ? '[^/]*' : `\\${match}`)}(?:/|$)`)
  return expression.test(clean(sourcePath))
}
/**
 * A migrated home records membership on the product, not the component. Until Phase 3 gives that its own model, the
 * reader derives the `productId` every downstream consumer still expects, from the product that owns the component's
 * repository and path; a home with exactly one product needs no declaration for what the home itself owns.
 */
function derivedProductId(component: Record<string, unknown>, ownership: Map<string, ProductRepository[]>, productIds: string[], home?: string) {
  const repo = typeof component.repo === 'string' ? repositoryIdentity(component.repo) : undefined
  const sourcePath = typeof component.sourcePath === 'string' ? component.sourcePath : ''
  let owned = false
  for (const [productId, repositories] of ownership) {
    for (const entry of repositories) {
      if (entry.role !== 'owned' || repo === undefined || repositoryIdentity(entry.repository) !== repo) continue
      if (!entry.paths?.length || entry.paths.some(path => covers(path, sourcePath))) return productId
      owned = true
    }
  }
  // The single-product fallback only covers what this home is responsible for: a declared component with no
  // repository, its own repository, or one an owned declaration already claims. A component of a *used*
  // repository belongs to whichever product declares it, and guessing would attribute it to the wrong one.
  if (productIds.length !== 1) return undefined
  return repo === undefined || repo === home || owned ? productIds[0] : undefined
}
/**
 * Refuses a migrated-only document form on the write path. Readers accept both forms, so a home that merged a
 * branch from either side of the migration still loads, but until the migration phase every write must stay a
 * document an older release can read: a product with no `schemaVersion`, `domain` or `repositories`, and a
 * component that still carries its own `productId`, names no repository in a dependency and records no
 * `identityChanges`.
 */
export function assertLegacyWriteForm(file: string, raw: string) {
  let value: unknown
  try { value = JSON.parse(raw) } catch { return } // parsePlan reports the syntax error itself, with its own message.
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  const document = value as Record<string, unknown>
  const reject = (detail: string) => {
    throw new InvalidInput(`${file}: ${detail}; this release writes only the legacy forms, so teammates on an older release can still read them`)
  }
  if (file.startsWith('products/')) {
    const result = portableProductSchema.safeParse(document)
    if (!result.success) reject(result.error.issues.map(issue => issue.message).join('; '))
  } else if (file.startsWith('components/')) {
    if ('schemaVersion' in document) reject('a component cannot declare schemaVersion yet')
    if (document.productId === undefined) reject('a component must name its productId')
    if (document.identityChanges !== undefined) reject('a component cannot record identityChanges yet')
    if (qualifiedReferences(document.dependsOn)) reject('a component cannot name the repository of a dependency yet')
    const flows = Array.isArray(document.executionFlows) ? document.executionFlows : []
    for (const flow of flows as Record<string, unknown>[]) {
      const steps = Array.isArray(flow?.steps) ? flow.steps as Record<string, unknown>[] : []
      if (steps.some(step => qualifiedReferences(step?.dependencyIds))) reject('a flow step cannot name the repository of a dependency yet')
    }
  }
}
/** The migrated `{repository, component}` reference form, which only a migrated home may store. */
const qualifiedReferences = (value: unknown) => Array.isArray(value) && value.some(item => !!item && typeof item === 'object')
/**
 * The write-path form check for a whole document set. `validateTransition` applies it to the documents a write
 * changes, and `initialise` to the documents it stages, so neither path can create a migrated-only form.
 */
export function assertLegacyWriteForms(files: Files, source: PlanSource = {}) {
  if (source.layout === 'catalog-v3') return
  for (const [name, raw] of Object.entries(files)) assertLegacyWriteForm(name, raw)
}
/**
 * Why a component's product could not be derived. Membership is the product's declaration in Phase 3; until then
 * every consumer of the snapshot needs a `productId`, so an unowned component is reported by name rather than
 * failing later as a missing field.
 */
function unownedComponent(file: string, component: Record<string, unknown>, productIds: string[]): string {
  const repo = typeof component.repo === 'string' ? component.repo : undefined
  const sourcePath = typeof component.sourcePath === 'string' && component.sourcePath ? ` path "${component.sourcePath}"` : ''
  const where = repo ? `${repo}${sourcePath}` : 'this component'
  const products = productIds.length ? `The products in this home are ${productIds.join(', ')}.` : 'This home declares no product.'
  return `${file}: no product in this home owns ${where}, so its productId cannot be derived. ${products} `
    + 'List the repository under a product\'s repositories, or keep the component in the catalog of the home whose product owns it.'
}
/** The document names a set of unresolved references points at, so a home read as v3 can say what it is missing. */
const referenceDirectory: Record<string, string> = { productId: 'products', ownerId: 'members', viewerId: 'members', parentId: 'components' }
/**
 * Explains that a home with no project manifest is being read as the migrated layout, and names the documents its
 * content refers to but does not contain. Without it, a v3 home that is simply incomplete reports only reference
 * errors, where an unmigrated one would have said the repository was never initialised.
 */
function version3Reading(documents: Record<string, unknown>, issues: string[]): string {
  const missing = new Set<string>()
  for (const issue of issues) {
    const match = /:([a-zA-Z]+)(?:\.\d+)?: unknown reference "([^"]+)"$/.exec(issue)
    const directory = match && referenceDirectory[match[1]]
    if (directory && !(`${directory}/${match[2]}.json` in documents)) missing.add(`${directory}/${match[2]}.json`)
  }
  return `This home has no ${PROJECT_FILE}, so Groundwork reads it as the migrated (v3) layout and takes its identity from the repository`
    + (missing.size ? `. It is missing ${[...missing].sort().join(', ')}` : '')
    + `. Add the missing documents, or run groundwork-v2 init if this checkout was never a Groundwork home.`
}
export function parsePlan(files: Files, source: PlanSource = {}): Plan {
  const documents: Record<string, unknown> = {}
  const delivery: Record<string, Delivery> = {}
  const decisions: Record<string, string> = {}
  const ownership = new Map<string, ProductRepository[]>()
  const componentFiles: string[] = []
  const manifests: ScanManifest[] = []
  const retained: { id: string; repository: string | null }[] = []
  let manifest: Plan['manifest'] | undefined
  for (const [file, raw] of Object.entries(files)) {
    if (!documentPattern.test(file)) throw new InvalidInput(`${file}: unsupported planning document`)
    try {
      if (file.endsWith('/brief.md')) { documents[file.replace('brief.md', 'purpose.json')] = parseBrief(raw); continue }
      if (file.endsWith('.md')) { if (!raw.trim()) throw new InvalidInput('Decision cannot be blank'); decisions[file] = raw; continue }
      const value = JSON.parse(raw)
      if (file.startsWith('scan-manifests/')) {
        manifests.push(parseScanManifest(raw))
        if (digest(raw) !== file.split('/')[1].replace('.json', '')) throw new InvalidInput('Scan manifest content hash mismatch')
        continue
      }
      if (file.includes('/assessments/')) {
        const assessment = discoveryAssessmentSchema.parse(value)
        if (assessment.featureId !== file.split('/')[1] || digest(raw) !== file.split('/')[3].replace('.json', '')
          || !files[`features/${assessment.featureId}/baselines/${assessment.baselineId}.json`]) {
          throw new InvalidInput('Assessment identity, hash or baseline mismatch')
        }
        if (Buffer.byteLength(raw) > 256 * 1024) throw new InvalidInput('Assessment exceeds 256 KiB')
        continue
      }
      if (file.includes('/baselines/')) {
        const packet = knowledgeBaselineSchema.parse(value)
        if (packet.featureId !== file.split('/')[1] || digest(raw) !== file.split('/')[3].replace('.json', '')) {
          throw new InvalidInput('Baseline identity/content hash mismatch')
        }
        if (!files[`features/${packet.featureId}/feature.json`]) throw new InvalidInput('Baseline requires an existing feature')
        if (Buffer.byteLength(raw) > 64 * 1024) throw new InvalidInput('Baseline exceeds 64 KiB')
        retained.push(...packet.observations)
        continue
      }
      if (file === 'project.json') manifest = manifestSchema.parse(value)
      else if (file.startsWith('products/')) {
        // The migrated fields are accepted and then set aside: later phases give them meaning, this one only loads them.
        const { schemaVersion: _version, domain: _domain, repositories, ...product } = portableProductReadSchema.parse(value)
        if (repositories) ownership.set(product.id, repositories)
        documents[file] = { ...product, workspaceId: 'project' }
      } else if (file.endsWith('/delivery.json')) delivery[file.split('/')[1]] = parseDelivery(value)
      else {
        if (file.startsWith('components/')) componentFiles.push(file)
        documents[file] = value
      }
    } catch (error) { throw new InvalidInput(`${file}: ${error instanceof Error ? error.message : error}`) }
  }
  const derived = !manifest
  if (!manifest) {
    if (source.layout !== 'catalog-v3') throw new NotInitialised('project.json: initialise this repository with groundwork-v2 init')
    // A migrated home has no manifest: its identity is the repository's, and its name is the repository's name.
    if (!source.repository) throw new NotInitialised('This home has no project.json; read it through a checkout so its repository identity is available')
    manifest = manifestSchema.parse({ schemaVersion: 2, id: identitySlug(source.repository.id), name: repositoryName(source.repository.id) })
  }
  const productIds = Object.keys(documents).filter(name => name.startsWith('products/')).map(name => name.slice('products/'.length, -5))
  for (const file of componentFiles) {
    const component = documents[file]
    if (!component || typeof component !== 'object' || Array.isArray(component)) continue
    // `schemaVersion` marks the migrated form; the legacy documents beside it in a merged branch simply lack it.
    const { schemaVersion: _version, ...rest } = component as Record<string, unknown>
    if (rest.productId === undefined) {
      const productId = derivedProductId(rest, ownership, productIds, source.repository?.id)
      if (productId === undefined) throw new InvalidInput(unownedComponent(file, rest, productIds))
      rest.productId = productId
    }
    documents[file] = rest
  }
  documents['project.json'] = { schemaVersion: 1 }
  documents['workspaces/project.json'] = { id: 'project', slug: 'project', name: manifest.name, hue: 'var(--hue-teal)', createdAt: '2026-01-01T00:00:00Z' }
  // Asset references stay relative on disk. The HTTP adapter adds checkout context.
  let snapshot: ContentSnapshot
  try { snapshot = loadContent(documents, source.repository?.id) } catch (error) {
    // A home read as v3 has no manifest to name the documents it expects, so say so before the reference errors.
    if (derived && error instanceof ContentError) throw new ContentError([version3Reading(documents, error.issues), ...error.issues])
    throw error
  }
  for (const feature of snapshot.features) for (const mock of feature.spec?.design?.mockups ?? []) {
    if (mock.ref.startsWith('/')) throw new InvalidInput(`features/${feature.id}/design.json: use a repository-relative assets/ reference`)
  }
  for (const [featureId, plan] of Object.entries(delivery)) {
    try { validateDelivery(featureId, plan, snapshot) } catch (error) { throw new InvalidInput(error instanceof Error ? error.message : String(error)) }
  }
  return {
    manifest, snapshot, delivery, decisions, source,
    legacyIds: legacyIdMap(source, manifest.id, snapshot.components, manifests, retained),
  }
}

/**
 * Which repository each legacy catalog ID belonged to. A migrated home stores the answer; an unmigrated one has it
 * only implicitly, so it is derived in memory from what the home already records — each component's `repo`, each
 * scan manifest's repository, and the repository each retained baseline observation was taken from. It is read
 * here and written only by the migration.
 */
function legacyIdMap(
  source: PlanSource, scope: string, components: ContentSnapshot['components'],
  manifests: ScanManifest[], retained: { id: string; repository: string | null }[],
): LegacyIdMap {
  if (source.legacyIds !== undefined) return parseLegacyIdMap(source.legacyIds)
  const map = emptyLegacyIdMap()
  for (const component of components) recordLegacyScope(map, scope, component.id,
    component.repo ? repositoryIdentity(component.repo) : source.repository?.id)
  for (const manifest of manifests) recordScanManifestScopes(map, manifest, scope)
  for (const observation of retained) {
    try {
      const parsed = parseCatalogId(observation.id)
      recordLegacyScope(map, parsed.scope, parsed.component, observation.repository)
    } catch { /* Not a catalog ID; the map has nothing to say about it. */ }
  }
  return map
}
