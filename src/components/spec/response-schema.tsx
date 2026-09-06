import type { ResponseSchema as Schema } from '@/data/spec'
import { diffResponseSchema } from '@/data/schema-diff'

const states = { added: { symbol: '+', label: 'Added' }, removed: { symbol: '−', label: 'Removed' }, updated: { symbol: '~', label: 'Updated' }, unchanged: { symbol: '=', label: 'Unchanged' } }

export function ResponseSchema({ schema }: { schema: Schema }) {
  const lines = diffResponseSchema(schema)
  const notes = lines.filter(line => line.note)
  return <section className="response-schema" aria-label="Response schema with field changes">
    <header><h4>Response schema</h4><span>Current <span aria-hidden="true">→</span> Proposed</span></header>
    <div className="schema-legend" aria-label="Field change legend">{Object.entries(states).map(([state, meta]) => <span key={state} className={`schema-state-${state}`}><b aria-hidden="true">{meta.symbol}</b> {meta.label}</span>)}</div>
    <div className="schema-scroll" tabIndex={0} role="region" aria-label="Complete response schema, scroll horizontally for long fields">
      <pre className="schema-code"><code>{lines.map((line, i) => {
        const prefix = line.name ? `${line.name}: ` : ''
        const sharedName = !!prefix && !!line.before?.startsWith(prefix) && line.after.startsWith(prefix)
        return <span key={line.key} className={`schema-line schema-state-${line.change}`} data-change={line.change}>
        <span className="schema-line-number" aria-hidden="true">{i + 1}</span>
        <span className="schema-line-sign" aria-hidden="true">{line.change === 'unchanged' ? ' ' : states[line.change].symbol}</span>
        <span className="schema-line-content" style={{ paddingInlineStart: `${line.depth * 2}ch` }}>
          {line.change !== 'unchanged' && <span className="sr-only">{states[line.change].label}: </span>}
          {sharedName && <span>{prefix}</span>}
          {line.before && line.before !== line.after && <><del>{sharedName ? line.before.slice(prefix.length) : line.before}</del><span aria-label=" becomes "> → </span></>}
          {line.change === 'removed' ? <del>{line.after}</del> : <span>{sharedName ? line.after.slice(prefix.length) : line.after}</span>}
        </span>{'\n'}
      </span>})}</code></pre>
    </div>
    {notes.length > 0 && <div className="schema-notes">{notes.map(line => <p key={line.key}><code>{line.name}</code> · {line.note}</p>)}</div>}
  </section>
}
