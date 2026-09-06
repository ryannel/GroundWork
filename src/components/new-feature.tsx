import { useState } from 'react'
import { useRuntime, mutate } from '@/data/runtime'
import { q } from '@/data/store'
export function NewFeature() {
  const { plan, error: runtimeError, connected } = useRuntime()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (!plan?.context.editable || runtimeError || !connected) return null
  return <section className="new-feature"><button className="runtime-button" onClick={() => setOpen(!open)}>{open ? 'Close' : '+ Plan a feature'}</button>{open && <form onSubmit={async event => {
    event.preventDefault(); setError(''); setBusy(true)
    const fields = Object.fromEntries(new FormData(event.currentTarget))
    try { await mutate('create_feature', fields); setOpen(false) } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }}><h2>Start with the problem</h2><div className="feature-form-grid"><label>Feature title<input name="title" required placeholder="What are we planning?" /></label><label>Stable ID<input name="id" required pattern="[a-zA-Z0-9][a-zA-Z0-9_-]*" placeholder="first-feature" /></label><label>Product<select name="productId">{q.products().map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label><label>Owner<select name="ownerId">{plan.snapshot.members.map(m => <option value={m.id} key={m.id}>{m.name}</option>)}</select></label></div><label>Problem<textarea name="problem" required placeholder="Who needs this, and what is difficult today?" /></label><label>Intended outcome<textarea name="outcome" required placeholder="What should become better?" /></label>{error && <p role="alert">{error}</p>}<button className="runtime-button" disabled={busy || !q.products().length || !plan.snapshot.members.length}>{busy ? 'Saving…' : 'Create feature plan'}</button></form>}</section>
}
