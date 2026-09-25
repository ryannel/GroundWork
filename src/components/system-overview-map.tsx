import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  edgeHandles, fallbackGridPositions, layoutSignature, messageEdgeLabel, nodeHeight, nodeWidth, portSide, relationshipId, systemMapLayout, type PortSide,
} from '@/lib/system-map-layout'
import { layoutGraph } from '@/lib/elk'
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
  type NodeMouseHandler,
  type NodeProps,
  type OnNodeDrag,
  type ReactFlowInstance,
} from '@xyflow/react'
import { LayoutDashboard, Maximize2, Minimize2, Pin, PinOff } from 'lucide-react'
import type { Component } from '@shared/model'
import { componentKind, componentKindLabel, componentKinds, type ArchitectureEdge } from '@shared/component-structure'

type ObservedStatus = 'observed' | 'unresolved'
/** Module constant: a fresh default Map on every render would change identity each time. */
const EMPTY_STATUS: ReadonlyMap<string, ObservedStatus> = new Map()

/** Fit after a (re)layout, never zooming in past a readable card size. */
const LAYOUT_FIT = { duration: 260, padding: .16, minZoom: .1, maxZoom: .9 }
/** Fit on container resize (including expand/collapse) without moving any card. */
const RESIZE_FIT = { padding: .1, maxZoom: 1 }
const MIN_ZOOM = .1
const MAX_ZOOM = 1.7
const ARROW = { type: MarkerType.ArrowClosed, width: 15, height: 15 }
const EDGE_LABEL_STYLE = { fill: 'var(--fg-muted)', fontSize: 10 }
const EDGE_LABEL_BG_STYLE = { fill: 'var(--bg-elevated)' }
const NODE_STYLE = { width: nodeWidth, height: nodeHeight }
const MINIMAP_STYLE = { width: 120, height: 80 }
const PRO_OPTIONS = { hideAttribution: true }
/** Kind colours live in the `.kind-*` CSS classes; cards and minimap rects carry the class and read the variable. */
const MINIMAP_NODE_COLOR = 'var(--kind-color)'
const FOCUSABLE = [
  'button:not(:disabled)', 'a[href]', 'input:not(:disabled)', 'select:not(:disabled)', 'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

interface SystemNodeData extends Record<string, unknown> {
  component: Component
  observedStatus?: ObservedStatus
  selectable: boolean
  isPinned: boolean
  onUnpin: (id: string) => void
}
type SystemNode = Node<SystemNodeData, 'system'>
/** Layout state holds geometry only; what a card shows is merged in `displayNodes`. */
type LayoutNode = Node<Record<string, unknown>, 'system'>
/** ELK positions, or a plain grid when the layout chunk fails to load (offline, runtime upgraded under an open tab). */
async function placeComponents(components: Component[], relationships: ArchitectureEdge[]) {
  try {
    const graph = await layoutGraph(systemMapLayout(components, relationships))
    return { positions: new Map(graph.children?.map(node => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }])), failed: false }
  } catch (error) {
    console.error('System map layout failed', error)
    return { positions: fallbackGridPositions(components.map(component => component.id)), failed: true }
  }
}
const kindClass = (component: Component) => `kind-${componentKind(component)}`
const minimapNodeClass = (node: SystemNode) => kindClass(node.data.component)

const handles = [
  [Position.Left, 'left'],
  [Position.Right, 'right'],
  [Position.Top, 'top'],
  [Position.Bottom, 'bottom'],
] as const

const SystemMapNode = memo(function SystemMapNode({ data }: NodeProps<SystemNode>) {
  const label = componentKindLabel(data.component)
  const status = data.observedStatus === 'unresolved' ? ' · unmatched' : data.observedStatus === 'observed' ? ' · observed' : ''
  return <div className="system-flow-node">
    {handles.flatMap(([position, side]) => [
      <Handle key={`target-${side}`} id={`target-${side}`} type="target" position={position} isConnectable={false} />,
      <Handle key={`source-${side}`} id={`source-${side}`} type="source" position={position} isConnectable={false} />,
    ])}
    <i aria-label={label} title={label} />
    <span><strong>{data.component.name}</strong><small>{label}{status}</small></span>
    {data.isPinned && <button
      type="button"
      className="system-node-unpin nodrag nopan"
      aria-label={`Unpin ${data.component.name}`}
      title={`Unpin ${data.component.name}`}
      onKeyDown={event => event.stopPropagation()}
      onClick={event => {
        event.stopPropagation()
        event.currentTarget.closest<HTMLElement>('.react-flow__node')?.focus()
        data.onUnpin(data.component.id)
      }}
    ><Pin size={14} aria-hidden="true" /></button>}
  </div>
})

const nodeTypes = { system: SystemMapNode }

export function SystemOverviewMap({ components, relationships, observedStatus = EMPTY_STATUS, selectableIds, focus, onFocus }: {
  components: Component[]
  relationships: ArchitectureEdge[]
  observedStatus?: ReadonlyMap<string, ObservedStatus>
  selectableIds?: ReadonlySet<string>
  focus?: string
  onFocus: (id: string) => void
}) {
  const instance = useRef<ReactFlowInstance<SystemNode, Edge> | null>(null)
  const mapElement = useRef<HTMLDivElement>(null)
  const expandButton = useRef<HTMLButtonElement>(null)
  const [expanded, setExpanded] = useState(false)
  const layoutPositions = useRef(new Map<string, { x: number; y: number }>())
  const fitWhenReady = useRef(false)
  const [nodes, setNodes, onNodesChange] = useNodesState<LayoutNode>([])
  // "Auto layout" asks for a new run of the same structure; pending and failure are derived from the last finished run.
  const [layoutRun, setLayoutRun] = useState(0)
  const [finishedLayout, setFinishedLayout] = useState<{ request: string; failed: boolean }>()
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => new Set())
  const [hiddenKinds, setHiddenKinds] = useState<Set<string>>(() => new Set())
  const availableKinds = useMemo(() => [...new Set(components.map(componentKind))], [components])
  const visibleComponents = useMemo(() => components.filter(component => !hiddenKinds.has(componentKind(component))), [components, hiddenKinds])
  const visibleIds = useMemo(() => new Set(visibleComponents.map(component => component.id)), [visibleComponents])
  const visibleRelationships = useMemo(
    () => relationships.filter(({ from, to }) => visibleIds.has(from) && visibleIds.has(to)),
    [relationships, visibleIds],
  )
  // Layout runs when the structure changes, not when a parent re-creates equal arrays or changes node styling.
  const layoutKey = useMemo(() => layoutSignature(visibleComponents, visibleRelationships), [visibleComponents, visibleRelationships])
  const layoutRequest = `${layoutRun}:${layoutKey}`
  const layoutPending = finishedLayout?.request !== layoutRequest
  const layoutFailed = !layoutPending && !!finishedLayout?.failed
  const layoutInput = useRef({ components: visibleComponents, relationships: visibleRelationships })
  useLayoutEffect(() => {
    layoutInput.current = { components: visibleComponents, relationships: visibleRelationships }
  }, [visibleComponents, visibleRelationships])

  useEffect(() => {
    if (!expanded) return
    const previousOverflow = document.body.style.overflow
    const trigger = expandButton.current
    document.body.style.overflow = 'hidden'
    trigger?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault();
        setExpanded(false) }
      if (event.key !== 'Tab') return
      const controls = [...(mapElement.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter(element => element.getClientRects().length)
      if (!controls.length) return
      const index = controls.indexOf(document.activeElement as HTMLElement)
      // Wrap at either end, and pull focus back in if it has escaped the dialog.
      if (event.shiftKey && index <= 0) { event.preventDefault();
        controls.at(-1)!.focus() }
      else if (!event.shiftKey && (index === -1 || index === controls.length - 1)) { event.preventDefault();
        controls[0].focus() }
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
    let frame: number
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => { void instance.current?.fitView(RESIZE_FIT) })
    })
    observer.observe(element)
    return () => { observer.disconnect();
      cancelAnimationFrame(frame) }
  }, [])

  const releaseNodes = useCallback((id?: string) => {
    setPinnedIds(current => id ? new Set([...current].filter(pinned => pinned !== id)) : new Set())
    setNodes(current => current.map(node => {
      if (id && node.id !== id) return node
      return { ...node, position: layoutPositions.current.get(node.id) ?? node.position }
    }))
    fitWhenReady.current = false
  }, [setNodes])

  useEffect(() => {
    let active = true
    const { components: layoutComponents, relationships: layoutRelationships } = layoutInput.current
    void placeComponents(layoutComponents, layoutRelationships).then(({ positions, failed }) => {
      if (!active) return
      layoutPositions.current = positions
      const nextNodes: LayoutNode[] = layoutComponents.map(component => ({
        id: component.id,
        type: 'system',
        position: positions.get(component.id) ?? { x: 0, y: 0 },
        data: {},
        style: NODE_STYLE,
      }))
      fitWhenReady.current = true
      setPinnedIds(new Set())
      setNodes(nextNodes)
      setFinishedLayout({ request: layoutRequest, failed })
    })
    return () => { active = false }
  }, [layoutRequest, setNodes])

  useEffect(() => {
    if (layoutPending || !fitWhenReady.current || !instance.current || !nodes.length || nodes.some(node => !node.measured?.width)) return
    const frame = requestAnimationFrame(() => {
      fitWhenReady.current = false
      void instance.current?.fitView(LAYOUT_FIT)
    })
    return () => cancelAnimationFrame(frame)
  }, [layoutPending, nodes])

  const componentById = useMemo(() => new Map(components.map(component => [component.id, component])), [components])
  // Card data is independent of position, so memo(SystemMapNode) holds for cards that do not move on a tick.
  const nodeData = useMemo(() => new Map(components.map(component => [component.id, {
    component,
    observedStatus: observedStatus.get(component.id),
    selectable: selectableIds?.has(component.id) ?? true,
    isPinned: pinnedIds.has(component.id),
    onUnpin: releaseNodes,
  } satisfies SystemNodeData])), [components, observedStatus, selectableIds, pinnedIds, releaseNodes])
  const displayNodes = useMemo(() => nodes.flatMap((node): SystemNode[] => {
    const data = nodeData.get(node.id)
    if (!data) return []
    return [{ ...node, data, className: `${kindClass(data.component)}${node.id === focus ? ' is-selected' : ''}` }]
  }), [nodes, nodeData, focus])

  // Edges are rebuilt only when a port pair or the focus changes, not on every simulation tick.
  const positionById = new Map(nodes.map(node => [node.id, node.position]))
  const sides = visibleRelationships.map(({ from, to }) => {
    const source = positionById.get(from)
    const target = positionById.get(to)
    return source && target ? portSide(source, target) : ''
  }).join(',')
  const edges = useMemo(() => {
    const portSides = sides.split(',') as (PortSide | '')[]
    return visibleRelationships.flatMap(({ from, to, messages }, index): Edge[] => {
      const side = portSides[index]
      if (!side) return []
      const label = messageEdgeLabel(messages)
      const names = `${componentById.get(from)?.name ?? from} and ${componentById.get(to)?.name ?? to}`
      return [{
        id: relationshipId(from, to),
        source: from,
        target: to,
        ...edgeHandles(side),
        type: 'default',
        label,
        labelStyle: EDGE_LABEL_STYLE,
        labelBgStyle: EDGE_LABEL_BG_STYLE,
        ariaLabel: messages ? `${label} message contracts between ${names}` : undefined,
        markerStart: messages?.inbound && messages.outbound ? ARROW : undefined,
        markerEnd: ARROW,
        className: focus && (from === focus || to === focus) ? 'is-highlighted' : '',
      }]
    })
  }, [sides, focus, visibleRelationships, componentById])

  const toggleKind = (kind: string) => setHiddenKinds(current => {
    const next = new Set(current)
    if (next.has(kind)) next.delete(kind)
    else next.add(kind)
    return next
  })
  const onInit = useCallback((flow: ReactFlowInstance<SystemNode, Edge>) => { instance.current = flow }, [])
  const onNodeClick = useCallback<NodeMouseHandler<SystemNode>>((_, node) => { if (node.data.selectable) onFocus(node.id) }, [onFocus])
  const onPaneClick = useCallback(() => onFocus(''), [onFocus])
  const onNodeDragStart = useCallback<OnNodeDrag<SystemNode>>((_, node) => {
    setPinnedIds(current => new Set(current).add(node.id))
    fitWhenReady.current = false
    if (node.data.selectable) onFocus(node.id)
  }, [onFocus])
  const onNodeContextMenu = useCallback<NodeMouseHandler<SystemNode>>((event, node) => {
    event.preventDefault()
    releaseNodes(node.id)
  }, [releaseNodes])

  return <>{expanded && <button type="button" className="system-overview-backdrop" aria-label="Collapse system map" onClick={() => setExpanded(false)} />}
  <div
    ref={mapElement}
    className={`system-overview-map${expanded ? ' is-expanded' : ''}`}
    role={expanded ? 'dialog' : undefined}
    aria-modal={expanded ? true : undefined}
    aria-label={expanded ? 'Full dependency map' : undefined}
  >
    {layoutPending && <div className="system-overview-loading">Arranging the system…</div>}
    <div className="system-overview-toolbar">
      <div className="system-overview-kind-legend" aria-label="Show component types">
        {availableKinds.map(kind => <button
          key={kind} type="button" className={`kind-${kind}`} aria-pressed={!hiddenKinds.has(kind)} onClick={() => toggleKind(kind)}
        >
          <i />{componentKinds[kind]}
        </button>)}
      </div>
      <div className="system-overview-layout-actions">
        {layoutFailed && <span role="status">Automatic layout unavailable · showing a grid</span>}
        <button className="system-auto-layout" disabled={layoutPending || !pinnedIds.size} onClick={() => releaseNodes()}>
          <PinOff size={13} />Release all{pinnedIds.size > 0 && ` (${pinnedIds.size})`}
        </button>
        <button className="system-auto-layout" disabled={layoutPending} onClick={() => setLayoutRun(run => run + 1)}>
          <LayoutDashboard size={13} />{layoutFailed ? 'Retry layout' : 'Auto layout'}
        </button>
        <button
          ref={expandButton}
          className="system-auto-layout"
          aria-label={expanded ? 'Collapse map' : 'Expand map'}
          title={expanded ? 'Collapse map (Esc)' : 'Expand map'}
          onClick={() => setExpanded(value => !value)}
        >{expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}<span>{expanded ? 'Collapse' : 'Expand'}</span></button>
      </div>
    </div>
    <ReactFlow<SystemNode, Edge>
      nodes={displayNodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onInit={onInit}
      onNodesChange={onNodesChange}
      nodesConnectable={false}
      elementsSelectable
      multiSelectionKeyCode={null}
      selectionOnDrag={false}
      autoPanOnNodeDrag={false}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      zoomOnScroll={false}
      panOnScroll={false}
      preventScrolling={false}
      zoomOnPinch
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      onNodeDragStart={onNodeDragStart}
      onNodeContextMenu={onNodeContextMenu}
      proOptions={PRO_OPTIONS}
    >
      <Background gap={24} size={1} />
      <MiniMap<SystemNode> pannable zoomable style={MINIMAP_STYLE} nodeColor={MINIMAP_NODE_COLOR} nodeClassName={minimapNodeClass} />
      <Controls showInteractive={false} />
    </ReactFlow>
  </div></>
}
