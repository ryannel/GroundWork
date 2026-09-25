import { ChevronDown } from 'lucide-react'
import type { Component } from '@shared/model'
import { selectedFlow, type ExecutionFlows } from '@/data/inspector-model'
import { ExecutionFlowExplorer, type FlowCatalogTarget } from '../execution-flow'

type FlowsProps = {
  component: Component; flows: ExecutionFlows; dependencies: Component[]
  /** The `flow` URL parameter; choosing another path replaces it. */
  flowId?: string; onFlowChange: (id: string) => void
  onNavigate: (target: FlowCatalogTarget) => void; onSelectComponent?: (id: string) => void
}

function FlowPicker({ flows, value, onChange, className }: { flows: ExecutionFlows; value: string; onChange: (id: string) => void; className?: string }) {
  if (flows.length < 2) return null
  return <label className={className}>
    <span>Execution path</span>
    <select value={value} onChange={event => onChange(event.target.value)}>
      {flows.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
  </label>
}

/** The recorded paths behind one endpoint, shown in its "Data flow" payload tab. */
export function EndpointFlows({ component, flows, dependencies, flowId, onFlowChange, onNavigate, onSelectComponent }: FlowsProps) {
  const flow = selectedFlow(flows, flowId)
  return <>
    <FlowPicker className="catalog-filter" flows={flows} value={flow.id} onChange={onFlowChange} />
    <ExecutionFlowExplorer
      key={flow.id} component={component} flow={flow} dependencies={dependencies} onNavigate={onNavigate} onSelectComponent={onSelectComponent}
    />
  </>
}

/** Recorded paths related to a message or job, collapsed unless the URL points at one of them. */
export function ContextFlows({ component, flows, dependencies, flowId, onFlowChange, onNavigate, onSelectComponent }: FlowsProps) {
  const flow = selectedFlow(flows, flowId)
  if (!flow) return null
  return <details className="catalog-notes" open={flows.some(item => item.id === flowId) || undefined}>
    <summary>Data flow · {flows.length} recorded {flows.length === 1 ? 'path' : 'paths'}<ChevronDown size={14} /></summary>
    <div>
      <FlowPicker flows={flows} value={flow.id} onChange={onFlowChange} />
      <ExecutionFlowExplorer
      key={flow.id} component={component} flow={flow} dependencies={dependencies} onNavigate={onNavigate} onSelectComponent={onSelectComponent}
    />
    </div>
  </details>
}
