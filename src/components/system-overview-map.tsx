import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createMapSimulation, nodeWidth, nodeHeight, pinNode, type ForceNode } from '@/lib/system-map-physics'
import { systemMapLayout } from '@/lib/system-map-layout'
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react'
import { LayoutDashboard, Maximize2, Minimize2, Pin, PinOff } from 'lucide-react'
import type { Component } from '@/data/model'
import { componentKind, componentKindLabel, type ArchitectureEdge } from '@/data/component-structure'

const kindColors = {
  service: '#a78bfa',
  module: '#94a3b8',
  database: '#60a5fa',
  'object-storage': '#38bdf8',
  'local-storage': '#22d3ee',
  queue: '#2dd4bf',
  cache: '#f59e0b',
  'external-service': '#f472b6',
}

interface SystemNodeData extends Record<string, unknown> {
  component: Component
  color: string
  observedStatus?: 'observed' | 'unresolved'
  selectable: boolean
  isPinned?: boolean
  onUnpin?: (id: string) => void
}

type SystemNode = Node<SystemNodeData, 'system'>

const SystemMapNode = memo(function SystemMapNode({ data }: NodeProps<SystemNode>) {
  const handles = [
    [Position.Left, 'left'],
    [Position.Right, 'right'],
    [Position.Top, 'top'],
    [Position.Bottom, 'bottom'],
  ] as const
  return <div className="system-flow-node" style={{ '--kind-color': data.color } as CSSProperties}>
    {handles.flatMap(([position, side]) => [
      <Handle key={`target-${side}`} id={`target-${side}`} type="target" position={position} isConnectable={false} />,
      <Handle key={`source-${side}`} id={`source-${side}`} type="source" position={position} isConnectable={false} />,
    ])}
    <i aria-label={componentKindLabel(data.component)} title={componentKindLabel(data.component)} />
    <span><strong>{data.component.name}</strong><small>{componentKindLabel(data.component)}{data.observedStatus === 'unresolved' ? ' · unmatched' : data.observedStatus === 'observed' ? ' · observed' : ''}</small></span>
    {data.isPinned && <button
      type="button"
      className="system-node-unpin nodrag nopan"
      aria-label={`Unpin ${data.component.name}`}
      title={`Unpin ${data.component.name}`}
      onKeyDown={event => event.stopPropagation()}
      onClick={event => {
        event.stopPropagation()
        event.currentTarget.closest<HTMLElement>('.react-flow__node')?.focus()
        data.onUnpin?.(data.component.id)
      }}
    ><Pin size={14} aria-hidden="true" /></button>}
  </div>
})

const nodeTypes = { system: SystemMapNode }

function edgePorts(source: SystemNode, target: SystemNode) {
  const sourceX = source.position.x + nodeWidth / 2
  const sourceY = source.position.y + nodeHeight / 2
  const targetX = target.position.x + nodeWidth / 2
  const targetY = target.position.y + nodeHeight / 2
  const dx = targetX - sourceX
  const dy = targetY - sourceY
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: 'source-right', targetHandle: 'target-left' }
      : { sourceHandle: 'source-left', targetHandle: 'target-right' }
  }
  return dy >= 0
    ? { sourceHandle: 'source-bottom', targetHandle: 'target-top' }
    : { sourceHandle: 'source-top', targetHandle: 'target-bottom' }
}

export function SystemOverviewMap({ components, relationships, observedStatus = new Map(), selectableIds, focus, onFocus }: {
  components: Component[]
  relationships: ArchitectureEdge[]
  observedStatus?: Map<string, 'observed' | 'unresolved'>
  selectableIds?: Set<string>
  focus?: string
  onFocus: (id: string) => void
}) {
  const instance = useRef<ReactFlowInstance<SystemNode, Edge> | null>(null)
  const mapElement = useRef<HTMLDivElement>(null)
  const expandButton = useRef<HTMLButtonElement>(null)
  const [expanded, setExpanded] = useState(false)
  const simulation = useRef<ReturnType<typeof createMapSimulation> | null>(null)
  const forceNodes = useRef(new Map<string, ForceNode>())
  const layoutVersion = useRef(0)
  const dragging = useRef<string | null>(null)
  const fitWhenReady = useRef(false)
  const [nodes, setNodes, onNodesChange] = useNodesState<SystemNode>([])
  const [layoutPending, setLayoutPending] = useState(true)
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => new Set())
  const [hiddenKinds, setHiddenKinds] = useState<Set<string>>(() => new Set())
  const availableKinds = useMemo(() => [...new Set(components.map(componentKind))], [components])
  const visibleComponents = useMemo(() => components.filter(component => !hiddenKinds.has(componentKind(component))), [components, hiddenKinds])
  const visibleIds = useMemo(() => new Set(visibleComponents.map(component => component.id)), [visibleComponents])
  const visibleRelationships = useMemo(() => relationships.filter(({ from, to }) => visibleIds.has(from) && visibleIds.has(to)), [relationships, visibleIds])

  useEffect(() => {
    if (!expanded) return
    const previousOverflow = document.body.style.overflow
    const trigger = expandButton.current
    document.body.style.overflow = 'hidden'
    trigger?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setExpanded(false) }
      if (event.key !== 'Tab') return
      const controls = [...(mapElement.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], select, [tabindex="0"]') ?? [])].filter(element => element.getClientRects().length)
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      trigger?.focus()
    }
  }, [expanded])

  useEffect(() => {
    const element = mapElement.current
    if (!element) return
    // Fit on container resize, including expand/collapse, without moving any nodes.
    let frame: number
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => { void instance.current?.fitView({ padding: .1, maxZoom: 1 }) })
    })
    observer.observe(element)
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [])

  const releaseNodes = useCallback((id?: string) => {
    for (const node of forceNodes.current.values()) {
      if (id && node.id !== id) continue
      node.fx = null
      node.fy = null
    }
    setPinnedIds(current => {
      if (!id) return new Set()
      const next = new Set(current)
      next.delete(id)
      return next
    })
    fitWhenReady.current = false
    simulation.current?.alphaTarget(0).alpha(.55).restart()
  }, [])

  const syncNodes = useCallback(() => {
    // D3 already ticks on animation frames. React Flow owns the pointer-driven node.
    setNodes(current => current.map(node => {
      if (node.id === dragging.current) return node
      const forceNode = forceNodes.current.get(node.id)
      if (!forceNode || forceNode.x === undefined || forceNode.y === undefined) return node
      const position = { x: forceNode.x - nodeWidth / 2, y: forceNode.y - nodeHeight / 2 }
      if (position.x === node.position.x && position.y === node.position.y) return node
      return { ...node, position }
    }))
  }, [setNodes])

  const startSimulation = useCallback((nextNodes: SystemNode[]) => {
    simulation.current?.stop()
    const physicsNodes: ForceNode[] = nextNodes.map(node => ({
      id: node.id,
      x: node.position.x + nodeWidth / 2,
      y: node.position.y + nodeHeight / 2,
      seedX: node.position.x + nodeWidth / 2,
      seedY: node.position.y + nodeHeight / 2,
    }))
    forceNodes.current = new Map(physicsNodes.map(node => [node.id, node]))
    const nextSimulation = createMapSimulation(physicsNodes, visibleRelationships)
    simulation.current = nextSimulation
    nextSimulation.on('tick', syncNodes)
    setPinnedIds(new Set())
    setNodes(nextNodes)
  }, [visibleRelationships, setNodes, syncNodes])

  const runLayout = useCallback(async () => {
    const version = ++layoutVersion.current
    simulation.current?.stop()
    dragging.current = null
    const { default: ELK } = await import('elkjs/lib/elk.bundled.js')
    if (version !== layoutVersion.current) return
    setLayoutPending(true)
    const graph = await new ELK().layout(systemMapLayout(visibleComponents, visibleRelationships))
    if (version !== layoutVersion.current) return
    const positions = new Map(graph.children?.map(node => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }]))
    const nextNodes: SystemNode[] = visibleComponents.map(component => ({
      id: component.id,
      type: 'system',
      position: positions.get(component.id) ?? { x: 0, y: 0 },
      data: { component, color: kindColors[componentKind(component)], observedStatus: observedStatus.get(component.id), selectable: selectableIds?.has(component.id) ?? true },
      style: { width: nodeWidth, height: nodeHeight },
    }))
    setLayoutPending(false)
    fitWhenReady.current = true
    startSimulation(nextNodes)
  }, [observedStatus, selectableIds, startSimulation, visibleComponents, visibleRelationships])

  const cancelLayout = useCallback(() => {
    simulation.current?.stop()
    layoutVersion.current++
  }, [])

  useEffect(() => {
    void runLayout()
    return cancelLayout
  }, [runLayout, cancelLayout])

  useEffect(() => {
    if (layoutPending || !fitWhenReady.current || !instance.current || !nodes.length || nodes.some(node => !node.measured?.width)) return
    const frame = requestAnimationFrame(() => {
      fitWhenReady.current = false
      void instance.current?.fitView({ duration: 260, padding: .16, minZoom: .1, maxZoom: .9 })
    })
    return () => cancelAnimationFrame(frame)
  }, [layoutPending, nodes])

  const nodeById = new Map(nodes.map(node => [node.id, node]))
  const displayNodes = useMemo(() => nodes.map(node => ({
    ...node,
    data: { ...node.data, isPinned: pinnedIds.has(node.id), onUnpin: releaseNodes },
    className: node.id === focus ? 'is-selected' : '',
  })), [nodes, focus, pinnedIds, releaseNodes])
  const edges: Edge[] = visibleRelationships.flatMap(({ from, to, messages }) => {
    const source = nodeById.get(from)
    const target = nodeById.get(to)
    if (!source || !target) return []
    const highlighted = !!focus && (from === focus || to === focus)
    const label = messages
      ? [messages.inbound && `${messages.inbound} in`, messages.outbound && `${messages.outbound} out`].filter(Boolean).join(' · ')
      : undefined
    return [{
      id: `${from}-${to}`,
      source: from,
      target: to,
      ...edgePorts(source, target),
      type: 'default',
      label,
      labelStyle: { fill: 'var(--fg-muted)', fontSize: 10 },
      labelBgStyle: { fill: 'var(--bg-elevated)' },
      ariaLabel: messages ? `${label} message contracts between ${source.data.component.name} and ${target.data.component.name}` : undefined,
      markerStart: messages?.inbound && messages.outbound ? { type: MarkerType.ArrowClosed, width: 15, height: 15 } : undefined,
      markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15 },
      className: highlighted ? 'is-highlighted' : '',
    }]
  })
  const toggleKind = (kind: string) => setHiddenKinds(current => {
    const next = new Set(current)
    if (next.has(kind)) next.delete(kind)
    else next.add(kind)
    return next
  })

  return <>{expanded && <button type="button" className="system-overview-backdrop" aria-label="Collapse system map" onClick={() => setExpanded(false)} />}
  <div ref={mapElement} className={`system-overview-map${expanded ? ' is-expanded' : ''}`} role={expanded ? 'dialog' : undefined} aria-modal={expanded ? true : undefined} aria-label="Full dependency map">
    {layoutPending && <div className="system-overview-loading">Arranging the system…</div>}
    <div className="system-overview-toolbar">
      <div className="system-overview-kind-legend" aria-label="Show component types">
        {availableKinds.map(kind => {
          const component = components.find(item => componentKind(item) === kind)!
          const visible = !hiddenKinds.has(kind)
          return <button key={kind} type="button" className={`kind-${kind}`} aria-pressed={visible} onClick={() => toggleKind(kind)}><i />{componentKindLabel(component)}</button>
        })}
      </div>
      <div className="system-overview-layout-actions">
        <button className="system-auto-layout" disabled={layoutPending || !pinnedIds.size} onClick={() => releaseNodes()}><PinOff size={13} />Release all{pinnedIds.size > 0 && ` (${pinnedIds.size})`}</button>
        <button className="system-auto-layout" disabled={layoutPending} onClick={() => void runLayout()}><LayoutDashboard size={13} />Auto layout</button>
        <button ref={expandButton} className="system-auto-layout" aria-label={expanded ? 'Collapse map' : 'Expand map'} title={expanded ? 'Collapse map (Esc)' : 'Expand map'} onClick={() => setExpanded(value => !value)}>{expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}<span>{expanded ? 'Collapse' : 'Expand'}</span></button>
      </div>
    </div>
    <ReactFlow<SystemNode, Edge>
      nodes={displayNodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onInit={flow => { instance.current = flow }}
      onNodesChange={onNodesChange}
      nodesConnectable={false}
      elementsSelectable
      multiSelectionKeyCode={null}
      selectionOnDrag={false}
      autoPanOnNodeDrag={false}
      minZoom={.1}
      maxZoom={1.7}
      zoomOnScroll={false}
      panOnScroll={false}
      preventScrolling={false}
      zoomOnPinch
      onNodeClick={(_, node) => { if (node.data.selectable) onFocus(node.id) }}
      onPaneClick={() => onFocus('')}
      onNodeDragStart={(_, node) => {
        dragging.current = node.id
        const forceNode = forceNodes.current.get(node.id)
        if (forceNode) {
          pinNode(forceNode, node.position)
          setPinnedIds(current => new Set(current).add(node.id))
        }
        fitWhenReady.current = false
        simulation.current?.alpha(.35).alphaTarget(.25).restart()
        if (node.data.selectable) onFocus(node.id)
      }}
      onNodeDrag={(_, node) => {
        const forceNode = forceNodes.current.get(node.id)
        if (!forceNode) return
        pinNode(forceNode, node.position)
      }}
      onNodeDragStop={(_, node) => {
        dragging.current = null
        const forceNode = forceNodes.current.get(node.id)
        if (forceNode) {
          pinNode(forceNode, node.position)
        }
        fitWhenReady.current = false
        simulation.current?.alphaTarget(0).restart()
      }}
      onNodeContextMenu={(event, node) => {
        event.preventDefault()
        releaseNodes(node.id)
      }}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={24} size={1} />
      <MiniMap pannable zoomable style={{ width: 120, height: 80 }} nodeColor={node => (node.data as SystemNodeData).color} />
      <Controls showInteractive={false} />
    </ReactFlow>
  </div></>
}
