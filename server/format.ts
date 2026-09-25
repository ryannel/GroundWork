import { z } from 'zod'
import { ContentError, loadContent, type ContentSnapshot } from '../shared/content.ts'
import { purposeSchema } from '../shared/content-schema.ts'
import { deliverySchema, validateDelivery, type Delivery } from '../shared/delivery.ts'
import { identitySlug, repositoryName, type RepositoryIdentity } from '../shared/repository-identity.ts'
import { InvalidInput, NotFound } from './errors.ts'
import { LOGICAL_DOCUMENT_SOURCE, PLANS_DIR } from './paths.ts'

const id = z.string().regex(/^(?!(?:constructor|prototype|__proto__)$)[a-zA-Z0-9][a-zA-Z0-9_-]*$/)
const text = z.string().trim().min(1)
export const manifestSchema = z.strictObject({ id, name: text, domain: z.url().optional() })
export { deliverySchema } from '../shared/delivery.ts'
export type { Delivery } from '../shared/delivery.ts'
export type Files = Record<string, string>
export interface Plan {
  manifest: z.infer<typeof manifestSchema>
  snapshot: ContentSnapshot
  delivery: Record<string, Delivery>
  decisions: Record<string, string>
  source: PlanSource
}
export interface PlanSource { repository?: RepositoryIdentity }
export const PLAN_DIRECTORY = PLANS_DIR
export const assetPattern = /^assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp|gif|avif)$/
export const documentPattern = new RegExp(`^(?:${LOGICAL_DOCUMENT_SOURCE})$`)
export class NotInitialised extends NotFound {}

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
export function parsePlan(files: Files, source: PlanSource = {}): Plan {
  const documents: Record<string, unknown> = {}
  const delivery: Record<string, Delivery> = {}
  const decisions: Record<string, string> = {}
  for (const [file, raw] of Object.entries(files)) {
    if (!documentPattern.test(file)) throw new InvalidInput(`${file}: unsupported planning document`)
    try {
      if (file.endsWith('/brief.md')) {
        documents[file.replace('brief.md', 'purpose.json')] = parseBrief(raw)
        continue
      }
      if (file.endsWith('.md')) {
        if (!raw.trim()) throw new InvalidInput('Decision cannot be blank')
        decisions[file] = raw
        continue
      }
      const value = JSON.parse(raw)
      if (file.endsWith('/delivery.json')) delivery[file.split('/')[1]] = deliverySchema.parse(value)
      else documents[file] = value
    } catch (error) {
      throw new InvalidInput(`${file}: ${error instanceof Error ? error.message : error}`)
    }
  }
  if (!Object.keys(documents).some(file => file.startsWith('products/'))) {
    throw new NotInitialised('No product documents; initialise this repository with groundwork-v2 init')
  }
  const repository = source.repository?.id ?? 'local:project'
  const manifest = manifestSchema.parse({ id: identitySlug(repository), name: repositoryName(repository) })
  // The UI's content model still takes a project object; it is derived, never stored.
  documents['project.json'] = {}
  let snapshot: ContentSnapshot
  try { snapshot = loadContent(documents, repository) }
  catch (error) {
    if (error instanceof ContentError) throw error
    throw new InvalidInput(error instanceof Error ? error.message : String(error))
  }
  for (const feature of snapshot.features) for (const mock of feature.spec?.design?.mockups ?? []) {
    if (mock.ref.startsWith('/')) throw new InvalidInput(`features/${feature.id}/design.json: use a repository-relative assets/ reference`)
  }
  for (const [featureId, plan] of Object.entries(delivery)) {
    try { validateDelivery(featureId, plan, snapshot) }
    catch (error) { throw new InvalidInput(error instanceof Error ? error.message : String(error)) }
  }
  return { manifest, snapshot, delivery, decisions, source }
}
