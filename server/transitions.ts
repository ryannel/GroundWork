import { InvalidInput } from './errors.ts'
import { documentPattern, parsePlan, type Files, type Plan, type PlanSource } from './format.ts'
import { MAX_DOCUMENT_BYTES } from './paths.ts'

export type Changes = Record<string, string | null>

/** Validate a complete candidate before the repository transaction replaces any files. */
export function validateTransition(before: Files, changes: Changes, source: PlanSource = {}): { after: Files; plan: Plan } {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new InvalidInput('Writes require a changes object')
  const entries = Object.entries(changes)
  if (!entries.length) throw new InvalidInput('No changes supplied')
  const after = { ...before }
  for (const [name, value] of entries) {
    if (!documentPattern.test(name) || (value !== null && typeof value !== 'string')) throw new InvalidInput(`Invalid document change: ${name}`)
    if (value !== null && Buffer.byteLength(value) > MAX_DOCUMENT_BYTES) throw new InvalidInput(`${name}: document exceeds 2 MB`)
    if (value === null) delete after[name]
    else after[name] = value
  }
  return { after, plan: parsePlan(after, source) }
}
