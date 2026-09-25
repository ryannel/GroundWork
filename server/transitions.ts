import { Conflict, InvalidInput } from './errors.ts'
import { documentPattern, parsePlan, assertLegacyWriteForms, type Files, type Plan, type PlanSource } from './format.ts'
import { MAX_DOCUMENT_BYTES } from './paths.ts'

export type Changes = Record<string, string | null>
const retained = (name: string) => name.includes('/assessments/') || name.includes('/baselines/') || name.startsWith('scan-manifests/')

/**
 * Applies `changes` to the logical document set `before` and enforces the rules that span two plan versions:
 * retained baselines, assessments and scan manifests are immutable; retired observations and catalog rename
 * history are append-only; the project ID never changes. Pure: no filesystem or git access.
 */
export function validateTransition(before: Files, changes: Changes, source: PlanSource = {}): { after: Files; plan: Plan } {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new InvalidInput('Writes require a changes object')
  const entries = Object.entries(changes)
  if (!entries.length) throw new InvalidInput('No changes supplied')
  const after = { ...before }
  for (const [name, value] of entries) {
    if (!documentPattern.test(name) || (value !== null && typeof value !== 'string')) throw new InvalidInput(`Invalid document change: ${name}`)
    if (value !== null && Buffer.byteLength(value) > MAX_DOCUMENT_BYTES) throw new InvalidInput(`${name}: document exceeds 2 MB`)
    if (retained(name) && before[name] && before[name] !== value) {
      throw new Conflict('Retained discovery baselines and scan manifests are immutable; capture a new packet instead')
    }
    if (value === null) delete after[name]; else after[name] = value
  }
  // Only the changed documents are held to the legacy forms. Documents already on disk, such as those a branch
  // from the other side of the migration merged in, are read as they are rather than rewritten or refused.
  assertLegacyWriteForms(Object.fromEntries(entries.filter(([, value]) => value !== null) as [string, string][]), source)
  const plan = parsePlan(after, source)
  const previous = parsePlan(before, source)
  for (const component of previous.snapshot.components) {
    const next = plan.snapshot.components.find(item => item.id === component.id)
    for (const field of ['retiredObservations', 'catalogChanges'] as const) {
      const history = component[field] ?? []
      if (history.length && JSON.stringify(next?.[field]?.slice(0, history.length)) !== JSON.stringify(history)) {
        throw new Conflict('Retired observations and catalog rename history are append-only')
      }
    }
  }
  if (plan.manifest.id !== previous.manifest.id) throw new Conflict('A project ID is immutable after initialisation')
  return { after, plan }
}
