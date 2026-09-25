import { useEffect, useId, useMemo, useState } from 'react'
import type { ElkNode } from 'elkjs/lib/elk-api'
import { ArrowRight, ChevronDown, ExternalLink, GitBranch } from 'lucide-react'
import {
  Background, BaseEdge, Controls, EdgeLabelRenderer, Handle, MarkerType, Position, ReactFlow,
  type Edge, type EdgeProps, type Node, type NodeProps,
} from '@xyflow/react'
import type { Component } from '@shared/model'
import { sourceEvidenceUrl, type ExecutionFlow, type ExecutionStep } from '@shared/execution-flow'
import { referenceComponent, referenceLabel } from '@shared/component-reference'
import { edgeRoutes, layoutGraph, type EdgeRoute } from '@/lib/elk'

/** Step card size, shared by the ELK input and the rendered node. */
const STEP_WIDTH = 260
const STEP_HEIGHT = 84
/** Vertical pitch of the single-column fallback used until (or instead of) the ELK layout. */
const FALLBACK_SPACING = 170
/** Approximate rendered width of an edge label: ~6.5px per character plus padding. */
const labelWidth = (text: string) => text.length * 6.5 + 12
const LABEL_HEIGHT = 22
const STEP_STYLE = { width: STEP_WIDTH, height: STEP_HEIGHT }
const ARROW = { type: MarkerType.ArrowClosed }
const LABEL_STYLE = { fill: 'var(--fg)' }
const LABEL_BG_STYLE = { fill: 'var(--bg-elevated)' }
const fallbackPosition = (index: number) => ({ x: 0, y: index * FALLBACK_SPACING })

type FlowNode = Node<{ step: ExecutionStep; number: number }, 'execution'>
function StepNode({ data }: NodeProps<FlowNode>) {
  return <div className={`execution-node is-${data.step.kind}`}>
    <Handle type="target" position={Position.Top} />
    <span>{data.number} · {data.step.kind}</span>
    <strong>{data.step.title}</strong>
    <Handle type="source" position={Position.Bottom} />
  </div>
}
const nodeTypes = { execution: StepNode }
type FlowEdge = Edge<EdgeRoute & { label: string }, 'execution'>
function TransitionEdge({ id, data, markerEnd, style }: EdgeProps<FlowEdge>) {
  if (!data) return null
  return <>
    <BaseEdge id={id} path={data.path} markerEnd={markerEnd} style={style} />
    <EdgeLabelRenderer>
      <span className="execution-map-label" style={{ transform: `translate(-50%, -50%) translate(${data.labelX}px, ${data.labelY}px)` }}>{data.label}</span>
    </EdgeLabelRenderer>
  </>
}
const edgeTypes = { execution: TransitionEdge }
export type FlowCatalogTarget = { tab: 'data' | 'messages'; id: string }

function executionGraph(flow: ExecutionFlow): ElkNode {
  return {
    id: 'execution',
    layoutOptions: {
      'elk.algorithm': 'layered', 'elk.direction': 'DOWN', 'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.spacing.nodeNodeBetweenLayers': '40', 'elk.spacing.nodeNode': '65',
    },
    children: flow.steps.map(step => ({ id: step.id, ...STEP_STYLE })),
    edges: flow.transitions.map(edge => ({
      id: edge.id, sources: [edge.from], targets: [edge.to],
      labels: [{ text: edge.label, width: labelWidth(edge.label), height: LABEL_HEIGHT }],
    })),
  }
}

function EvidenceLink({ component, source }: { component: Component; source: ExecutionStep['evidence'][number] }) {
  const url = sourceEvidenceUrl(component.repo, source)
  return url
    ? <a href={url} target="_blank" rel="noreferrer">{source.path}:{source.lines}<ExternalLink size={12} /></a>
    : <strong>{source.path}:{source.lines}</strong>
}

export function ExecutionFlowExplorer({ component, flow, dependencies, onNavigate, onSelectComponent }: {
  component: Component; flow: ExecutionFlow; dependencies: Component[]
  onNavigate: (target: FlowCatalogTarget) => void; onSelectComponent?: (id: string) => void
}) {
  const [selectedId, setSelectedId] = useState(flow.entryStepId)
  const [view, setView] = useState<'steps' | 'map'>('steps')
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [routes, setRoutes] = useState<Record<string, EdgeRoute>>({})
  const detailId = useId()
  const selected = flow.steps.find(step => step.id === selectedId) ?? flow.steps[0]
  const selectedIndex = flow.steps.indexOf(selected)
  const outgoing = flow.transitions.filter(edge => edge.from === selected.id)
  const incoming = flow.transitions.filter(edge => edge.to === selected.id)
  const stepTitle = (id: string) => flow.steps.find(step => step.id === id)?.title
  useEffect(() => {
    if (view !== 'map') return
    let active = true
    layoutGraph(executionGraph(flow)).then(layout => {
      if (!active) return
      setRoutes(edgeRoutes(layout))
      setPositions(Object.fromEntries((layout.children ?? []).map(node => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }])))
    }).catch(() => {
      if (active) setPositions(Object.fromEntries(flow.steps.map((step, index) => [step.id, fallbackPosition(index)])))
    })
    return () => { active = false }
  }, [flow, view])
  const nodes: FlowNode[] = useMemo(() => flow.steps.map((step, index) => ({
    id: step.id,
    type: 'execution',
    data: { step, number: index + 1 },
    position: positions[step.id] ?? fallbackPosition(index),
    selected: selected.id === step.id,
    ariaLabel: `Inspect step ${index + 1}: ${step.title}`,
    style: STEP_STYLE,
  })), [flow, positions, selected.id])
  const edges = useMemo(() => flow.transitions.map(edge => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    label: edge.label,
    type: routes[edge.id] ? 'execution' : 'smoothstep',
    data: routes[edge.id] ? { ...routes[edge.id], label: edge.label } : undefined,
    animated: false,
    markerEnd: ARROW,
    style: { stroke: 'var(--fg-muted)', strokeDasharray: edge.mode === 'async' ? '6 4' : undefined },
    labelStyle: LABEL_STYLE,
    labelBgStyle: LABEL_BG_STYLE,
  })), [flow, routes])
  const trigger = flow.trigger?.kind === 'message' ? 'What happens when this message is consumed'
    : flow.trigger?.kind === 'job' ? 'What happens when this job runs' : 'What happens when this endpoint is called'
  const hasAsync = flow.transitions.some(edge => edge.mode === 'async')
  const hasLinks = !!(selected.dataRecordIds?.length || selected.messageIds?.length || selected.dependencyIds?.length
    || selected.unresolvedDependencyNames?.length)
  return <div className="execution-explorer">
    <header className="execution-heading"><div><span>{trigger}</span><h4>Execution path</h4><p>{flow.summary}</p></div></header>
    <div className="execution-provenance">
      <span><GitBranch size={13} />{flow.sourceRevision.slice(0, 8)}</span>
      <span>Code trace · not a runtime recording</span>
      {component.sourceRevision && component.sourceRevision !== flow.sourceRevision && <strong>Traced from an older catalog revision</strong>}
    </div>
    <div className="execution-view-controls">
      <div role="group" aria-label="Execution flow view">
        <button aria-pressed={view === 'steps'} onClick={() => setView('steps')}>Step through</button>
        <button aria-pressed={view === 'map'} onClick={() => setView('map')}>Branch map</button>
      </div>
      <p>
        {view === 'map' ? 'Drag to pan; use the controls or pinch to zoom. Select a step for details below.' : 'Follow a branch to inspect the next step.'}
        {hasAsync && ' Dashed map arrows indicate asynchronous handoffs.'}
      </p>
    </div>
    {view === 'map' && <div className="execution-map" role="region" aria-label={`${flow.name} branch map`}>
      {Object.keys(positions).length
        ? <ReactFlow
          key={flow.id} nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView minZoom={.15} maxZoom={1.6}
          nodesDraggable={false} nodesConnectable={false} zoomOnScroll={false} panOnScroll={false} preventScrolling={false} zoomOnPinch
          onNodeClick={(_, node) => setSelectedId(node.id)}
        ><Background /><Controls showInteractive={false} /></ReactFlow>
        : <p role="status">Laying out the execution path…</p>}
    </div>}
    <div className="execution-workspace">
      <nav className="execution-step-picker" aria-label="Execution steps">
        <label>
          <span>Step {selectedIndex + 1} of {flow.steps.length}</span>
          <select aria-label="Execution step" value={selected.id} aria-controls={detailId} onChange={event => setSelectedId(event.target.value)}>
            {flow.steps.map((step, index) => <option key={step.id} value={step.id}>{index + 1}. {step.title}</option>)}
          </select>
        </label>
      </nav>
      <article className="execution-step-detail" id={detailId} key={selected.id} tabIndex={0}>
        <header><span>Step {selectedIndex + 1} · {selected.kind}</span><h5>{selected.title}</h5></header><p>{selected.description}</p>
        {!!incoming.length && <div className="execution-branches">
          <h6>Reached from</h6>
          {incoming.map(edge => <button key={edge.id} onClick={() => setSelectedId(edge.from)}>
            <span>{stepTitle(edge.from)}</span><small>{edge.label}{edge.mode === 'async' ? ' · asynchronous' : ''}</small>
          </button>)}
        </div>}
        {hasLinks ? <div className="execution-links">
          <h6>In the catalog</h6>
          {selected.dataRecordIds?.map(id => <button key={id} onClick={() => onNavigate({ tab: 'data', id })}>
            Data · {component.data?.records.find(record => record.id === id)?.name}<ArrowRight size={13} />
          </button>)}
          {selected.messageIds?.map(id => <button key={id} onClick={() => onNavigate({ tab: 'messages', id })}>
            Message · {component.messaging?.messages.find(message => message.id === id)?.name}<ArrowRight size={13} />
          </button>)}
          {selected.dependencyIds?.map(reference => {
            const id = referenceComponent(reference), label = referenceLabel(reference)
            return <button key={label} onClick={() => onSelectComponent?.(id)} disabled={!onSelectComponent}>
              Dependency · {dependencies.find(item => item.id === id)?.name ?? label}<ArrowRight size={13} />
            </button>
          })}
          {selected.unresolvedDependencyNames?.map(name => <div className="execution-unresolved" key={name}>
            <strong>{name}</strong><span>External dependency · awaiting a component match</span>
          </div>)}
        </div> : null}
        <div className="execution-branches">
          <h6>{outgoing.length ? 'Continue along a branch' : 'End of this path'}</h6>
          {outgoing.map(edge => <button key={edge.id} onClick={() => setSelectedId(edge.to)}>
            <span>{edge.label}<ArrowRight size={14} /></span>
            <small>{stepTitle(edge.to)} · {edge.mode === 'async' ? 'asynchronous handoff' : 'same invocation'}</small>
          </button>)}
        </div>
        <details className="catalog-notes">
          <summary>Source evidence · {selected.evidence.length}<ChevronDown size={14} /></summary>
          <div>{selected.evidence.map((source, index) => <article key={index}>
            <EvidenceLink component={component} source={source} /><p>{source.claim}</p><code>{source.revision}</code>
          </article>)}</div>
        </details>
        {!!outgoing.length && <details className="catalog-notes">
          <summary>Branch evidence<ChevronDown size={14} /></summary>
          <div>{outgoing.map(edge => <article key={edge.id}>
            <strong>{edge.label}</strong>
            {edge.evidence.map((source, index) => {
              const url = sourceEvidenceUrl(component.repo, source)
              const location = `${source.path}:${source.lines}`
              return <p key={index}>{url ? <a href={url} target="_blank" rel="noreferrer">{location}</a> : location} · {source.claim}</p>
            })}
          </article>)}</div>
        </details>}
      </article>
    </div>
    <details className="catalog-notes execution-limitations" open>
      <summary>Scope & limitations · {flow.gaps.length}<ChevronDown size={14} /></summary>
      <div>{flow.gaps.map((gap, index) => <p key={index}>{gap}</p>)}</div>
    </details>
  </div>
}
