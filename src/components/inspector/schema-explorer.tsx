import { useState, type ReactNode } from 'react'
import { ArrowRight, ChevronRight, ExternalLink } from 'lucide-react'
import { referencedSchemas, type ApiField, type ApiType, type SchemaIndex } from '@/data/inspector-model'

/** The field table shared by payload schemas, data records and message contracts. */
export function FieldTable({ fields, label, renderType = field => <code>{field.type}</code> }: {
  fields: readonly ApiField[]; label: string; renderType?: (field: ApiField) => ReactNode
}) {
  return <div className="schema-browser-fields" role="table" aria-label={label}>
    <div className="schema-browser-field-head" role="row">
      <span role="columnheader">Field</span><span role="columnheader">Type</span><span role="columnheader">Requirement</span>
    </div>
    {fields.map(field => <div className="schema-browser-field" role="row" key={field.name}>
      <span role="cell"><strong>{field.name}</strong>{field.description && <small>{field.description}</small>}</span>
      <span role="cell">{renderType(field)}</span>
      <span role="cell" className={field.required ? 'is-required' : ''}>{field.required ? 'Required' : 'Optional'}</span>
    </div>)}
  </div>
}

export function RecordFields({ fields }: { fields: readonly ApiField[] }) {
  return fields.length
    ? <FieldTable fields={fields} label="Record fields" />
    : <p className="component-data-gap">The contract is documented, but its field structure has not been extracted.</p>
}

/** A field type links to its schema; a name shared by several schemas lists every candidate instead of guessing. */
function FieldType({ field, index, onOpen }: { field: ApiField; index: SchemaIndex; onOpen: (schema: ApiType) => void }) {
  const references = referencedSchemas(field.type, index)
  if (!references.length) return <code>{field.type}</code>
  const candidates = references.filter(schema => schema.name === references[0].name)
  if (candidates.length === 1) {
    return <button className="schema-type-link" onClick={() => onOpen(references[0])}><code>{field.type}</code><ArrowRight size={11} /></button>
  }
  return <>
    <code>{field.type}</code>
    {candidates.map(schema => <button key={schema.id} className="schema-type-link" title={schema.source ?? schema.id} onClick={() => onOpen(schema)}>
      <code>{schema.source ?? schema.id}</code><ArrowRight size={11} />
    </button>)}
  </>
}

/**
 * Browses a payload's schemas. `rootId` opens one schema by id (deep links); otherwise every schema named in
 * `type` is a root. The drill-down trail is ephemeral UI state and resets when the caller changes the key.
 */
export function SchemaExplorer({ type, rootId, index }: { type?: string; rootId?: string; index: SchemaIndex }) {
  const root = rootId ? index.byId.get(rootId) : undefined
  const roots = root ? [root] : referencedSchemas(type, index)
  const [trail, setTrail] = useState<ApiType[]>(roots.slice(0, 1))
  const current = trail.at(-1)
  const openSchema = (schema: ApiType) => {
    const existing = trail.findIndex(item => item.id === schema.id)
    setTrail(existing >= 0 ? trail.slice(0, existing + 1) : [...trail, schema])
  }

  if (!type && !root) return <div className="schema-browser-empty">No payload is documented for this endpoint.</div>
  if (!current) return <div className="schema-browser-empty">{type}</div>

  return <div className="schema-browser">
    {(trail.length > 1 || roots.length > 1) && <header className="schema-browser-context">
      {trail.length > 1 && <nav aria-label="Schema path">{trail.map((schema, position) => <span key={schema.id}>
        {position > 0 && <ChevronRight size={11} />}
        <button onClick={() => setTrail(trail.slice(0, position + 1))} aria-current={position === trail.length - 1 ? 'page' : undefined}>{schema.name}</button>
      </span>)}</nav>}
      {roots.length > 1 && <div className="schema-root-switch" aria-label="Payload models">{roots.map(schema => <button
        key={schema.id} aria-pressed={current.id === schema.id} title={schema.source ?? schema.id} onClick={() => setTrail([schema])}
      >{schema.name}</button>)}</div>}
    </header>}
    <article className="schema-browser-model">
      <header>
        <div><strong>{current.name}</strong><span>{current.kind}{current.base ? ` · extends ${current.base}` : ''}</span></div>
        {current.sourceUrl && <a href={current.sourceUrl} target="_blank" rel="noreferrer" title={current.source ?? current.name}>
          View source<ExternalLink size={11} />
        </a>}
      </header>
      {current.description && <p>{current.description}</p>}
      {current.fields.length
        ? <FieldTable
          fields={current.fields}
          label={`${current.name} fields`}
          renderType={field => <FieldType field={field} index={index} onOpen={openSchema} />}
        />
        : <div className="schema-browser-no-fields">No fields were extracted for this {current.kind}.</div>}
    </article>
  </div>
}
