import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { Journey } from '@shared/spec'
import { ArrowRight, Split } from 'lucide-react'
import { LensNote, RefRow } from './refs'
import { useLens, useSpec } from './context'
import { MockupCard } from './design'

export function JourneySection({ data, focus }: { data: Journey; focus?: string }) {
  const { ix, featureId } = useSpec()
  const lens = useLens('journey')
  const [params, setParams] = useSearchParams()
  const steps = lens ? data.steps.filter(s => lens.has(s.id)) : data.steps
  const trace = params.get('trace')
  const selected = steps.find(s => s.id === (params.get('step') ?? focus ?? (trace?.startsWith('journey:') ? trace.slice(8) : undefined))) ?? steps[0]
  const selectedTrace = selected?.flow?.length ? `journey:${selected.id}` : undefined
  useEffect(() => {
    if (selectedTrace && trace !== selectedTrace) setParams(previous => {
      const next = new URLSearchParams(previous)
      next.set('trace', selectedTrace)
      return next
    }, { replace: true })
  }, [selectedTrace, trace, setParams])
  const mockup = selected?.design ? ix.mockup[selected.design] : undefined
  const component = params.get('component')
  const scopeQuery = lens && component ? `?${new URLSearchParams({ component })}` : ''
  return <div>
    <div className="flex flex-wrap gap-3 text-small text-fg-muted mb-5">
      <span>{steps.length} steps · {[...new Set(steps.map(s => s.actor))].join(' & ')}</span>
      <LensNote shown={steps.length} total={data.steps.length} kind="steps" />
    </div>
    {selected ? <div className="journey-explorer">
      <nav aria-label="Journey steps" className="journey-steps">{steps.map(s => <Link key={s.id} to={`/f/${featureId}/journey/${s.id}${scopeQuery}`}
        aria-current={selected.id === s.id ? 'step' : undefined} className="journey-step">
        <span className="step-number">{data.steps.indexOf(s) + 1}</span><span><small>{s.actor}</small><strong>{s.action}</strong></span>
      </Link>)}</nav>
      <article className="journey-detail" key={selected.id}>
        <div className="eyebrow">Step {data.steps.indexOf(selected) + 1} · {selected.actor}</div><h3>{selected.action}</h3><p>{selected.surface}</p>
        {selected.note && <p>{selected.note}</p>}
        {selected.branch && <div className="scope-banner"><Split size={16} /><span>{selected.branch}</span></div>}
        {mockup
          ? <div className="journey-preview"><MockupCard m={mockup} /></div>
          : <p className="rounded-md border border-dashed border-border p-4">No screen is linked to this step yet.</p>}
        <div className="eyebrow mb-3">Behind this experience</div>
        {selected.flow?.length
          ? <Link className="inline-flex items-center gap-2 text-small text-accent mb-4" to={`/f/${featureId}/flow?trace=journey:${selected.id}`}>
            Trace this step through the system <ArrowRight size={14} />
          </Link>
          : <p className="text-small text-fg-muted">No system flow linked yet.</p>}
        <RefRow groups={[
          { label: 'Contracts', refs: (ix.stepContracts[selected.id] ?? []).map(id => ({ kind: 'api', id })) },
          { label: 'Data', refs: (ix.stepTables[selected.id] ?? []).map(id => ({ kind: 'storage', id })) },
          { label: 'Tested by', refs: (ix.stepTests[selected.id] ?? []).map(id => ({ kind: 'tests', id })), warn: 'No test linked' },
        ]} />
        {params.has('step') && <button
          className="text-small mt-4"
          onClick={() => setParams(p => { const n = new URLSearchParams(p);
            n.delete('step');
            return n })}
        >Reset selection</button>}
      </article>
    </div> : <p className="text-fg-muted text-small">No journey steps touch this component. Choose All components to see the full journey.</p>}
  </div>
}
