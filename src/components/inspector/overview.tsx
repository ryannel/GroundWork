import { useMemo } from 'react'
import type { Component } from '@/data/model'
import { mentalModel } from '@/data/inspector-model'

const SHOWN_FLOWS = 4

export function ComponentMentalModel({ component, dependencies }: { component: Component; dependencies: Component[] }) {
  const model = useMemo(() => mentalModel(component, dependencies), [component, dependencies])
  const flows = component.executionFlows ?? []
  const hidden = flows.length - SHOWN_FLOWS
  return <div className="component-mental-model">
    <header>
      <span>Mental model</span>
      <h4>How to reason about {component.name}</h4>
      <p>This is an orientation from source-backed catalog records, not an observation of live runtime behavior.</p>
    </header>
    <div className="component-mental-model-grid">
      <article><span>Work enters</span><p>{model.enters}</p></article>
      <article><span>Inside the boundary</span><p>{model.inside}</p></article>
      <article><span>Work leaves</span><p>{model.leaves}</p></article>
    </div>
    {!!flows.length && <section className="component-overview-flows">
      <header><div><span>Recorded runtime stories</span><h5>Concrete paths through the component</h5></div><strong>{flows.length}</strong></header>
      <div>{flows.slice(0, SHOWN_FLOWS).map(flow => <article key={flow.id}>
        <strong>{flow.name}</strong>
        <p>{flow.summary}</p>
        <small>{flow.transitions.some(transition => transition.mode === 'async') ? 'Includes asynchronous work' : 'Synchronous path'} · Source traced</small>
      </article>)}</div>
      {hidden > 0 && <p>{hidden} more recorded {hidden === 1 ? 'path is' : 'paths are'} available from the relevant contract.</p>}
    </section>}
    {model.blindSpots && <section className="component-overview-blind-spots">
      <span>Do not assume the map is complete</span>
      <p>{model.blindSpots}</p>
    </section>}
  </div>
}
