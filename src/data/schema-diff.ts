import type { Change, ResponseSchema, SchemaField } from './spec'

export interface SchemaLine {
  key: string
  depth: number
  change: Exclude<Change, 'unspecified'>
  name?: string
  before?: string
  after: string
  note?: string
}

const declaration = (f: SchemaField) => `${f.name}${f.optional ? '?' : ''}: ${f.type}`
const shape = (f: SchemaField) => f.fields ? f.type.startsWith('array') ? 'array' : 'object' : 'leaf'
const opening = (f: SchemaField) => f.fields ? `${f.name}${f.optional ? '?' : ''}: ${shape(f) === 'array' ? '[{' : '{'}` : declaration(f)
const closing = (f: SchemaField) => `${shape(f) === 'array' ? '}]' : '}'}${f.type.includes('| null') ? ' | null' : ''}`

/** Stable field identity is its parent path + name, never its position or example value. */
export function diffResponseSchema(schema: ResponseSchema): SchemaLine[] {
  const lines: SchemaLine[] = [{ key: '$:open', depth: 0, change: 'unchanged', after: '{' }]
  function visit(before: SchemaField[], after: SchemaField[], parent: string, depth: number) {
    const oldByName = new Map(before.map(f => [f.name, f]))
    const newByName = new Map(after.map(f => [f.name, f]))
    // Keep deleted fields next to their original neighbors in the proposed schema.
    const order = after.map(f => f.name)
    before.forEach((f, i) => {
      if (newByName.has(f.name)) return
      const next = before.slice(i + 1).find(n => newByName.has(n.name))
      const at = next ? order.indexOf(next.name) : order.length
      order.splice(at, 0, f.name)
    })
    for (const name of order) {
      const old = oldByName.get(name), current = newByName.get(name)
      const field = current ?? old!
      const key = `${parent}.${name}`
      const change: Exclude<Change, 'unspecified'> = !old ? 'added' : !current ? 'removed' : old.type !== current.type || !!old.optional !== !!current.optional ? 'updated' : 'unchanged'
      const structural = old && current && shape(old) !== shape(current)
      lines.push({ key, name, depth, change, before: change === 'updated' ? (structural ? declaration(old!) : opening(old!)) : undefined, after: structural ? declaration(current!) : opening(field), note: field.note })
      if (structural) {
        // Retain both old and proposed child definitions when a field changes container kind.
        if (old.fields) {
          lines.push({ key: `${key}:old-open`, depth: depth + 1, change: 'removed', after: opening(old) })
          visit(old.fields, [], `${key}:old`, depth + 2)
          lines.push({ key: `${key}:old-close`, depth: depth + 1, change: 'removed', after: closing(old) })
        }
        if (current.fields) {
          lines.push({ key: `${key}:new-open`, depth: depth + 1, change: 'added', after: opening(current) })
          visit([], current.fields, `${key}:new`, depth + 2)
          lines.push({ key: `${key}:new-close`, depth: depth + 1, change: 'added', after: closing(current) })
        }
      } else if (field.fields) {
        visit(old?.fields ?? [], current?.fields ?? [], key, depth + 1)
        const suffixChanged = old && current && closing(old) !== closing(current)
        lines.push({ key: `${key}:close`, depth, change: change === 'updated' && !suffixChanged ? 'unchanged' : change, before: suffixChanged ? closing(old) : undefined, after: closing(field) })
      }
    }
  }
  visit(schema.before ?? [], schema.after ?? [], '$', 1)
  lines.push({ key: '$:close', depth: 0, change: 'unchanged', after: '}' })
  return lines
}
