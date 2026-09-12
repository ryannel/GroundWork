import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type Simulation, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force'
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react'
import { LayoutDashboard } from 'lucide-react'
import type { Component } from '@/data/model'
import { componentKind, componentKindLabel } from '@/data/component-structure'

const nodeWidth = 220
const nodeHeight = 62
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
}

interface ForceNode extends SimulationNodeDatum {
  id: string
  seedX: number
  seedY: number
}

interface ForceLink extends SimulationLinkDatum<ForceNode> {
  source: string | ForceNode
  target: string | ForceNode
}

type SystemNode = Node<SystemNodeData, 'system'>

function SystemMapNode({ data }: NodeProps<SystemNode>) {
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
    <strong>{data.component.name}</strong>
  </div>
}

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

export function SystemOverviewMap({ components, relationships, focus, onFocus }: {
  components: Component[]
  relationships: { from: string; to: string }[]
  focus?: string
  onFocus: (id: string) => void
}) {
  const instance = useRef<ReactFlowInstance<SystemNode, Edge> | null>(null)
  const simulation = useRef<Simulation<ForceNode, ForceLink> | null>(null)
  const forceNodes = useRef(new Map<string, ForceNode>())
  const frame = useRef<number | undefined>(undefined)
  const fitWhenReady = useRef(false)
  const [nodes, setNodes, onNodesChange] = useNodesState<SystemNode>([])
  const [layoutPending, setLayoutPending] = useState(true)

  const syncNodes = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      setNodes(current => current.map(node => {
        const forceNode = forceNodes.current.get(node.id)
        if (!forceNode || forceNode.x === undefined || forceNode.y === undefined) return node
        return { ...node, position: { x: forceNode.x - nodeWidth / 2, y: forceNode.y - nodeHeight / 2 } }
      }))
    })
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
    const links: ForceLink[] = relationships.map(edge => ({ source: edge.from, target: edge.to }))
    const nextSimulation = forceSimulation<ForceNode>(physicsNodes)
      .force('links', forceLink<ForceNode, ForceLink>(links).id(node => node.id).distance(190).strength(.88))
      .force('charge', forceManyBody<ForceNode>().strength(-430).distanceMax(620))
      .force('collision', forceCollide<ForceNode>(nodeWidth * .62).strength(1).iterations(4))
      .force('horizontal-shape', forceX<ForceNode>(node => node.seedX).strength(.035))
      .force('vertical-shape', forceY<ForceNode>(node => node.seedY).strength(.025))
      .alphaDecay(.07)
      .velocityDecay(.46)

    nextSimulation.stop()
    for (let tick = 0; tick < 140; tick++) nextSimulation.tick()
    simulation.current = nextSimulation
    nextSimulation.on('tick', syncNodes)
    setNodes(nextNodes.map(node => {
      const forceNode = forceNodes.current.get(node.id)
      return !forceNode || forceNode.x === undefined || forceNode.y === undefined
        ? node
        : { ...node, position: { x: forceNode.x - nodeWidth / 2, y: forceNode.y - nodeHeight / 2 } }
    }))
  }, [relationships, setNodes, syncNodes])

  const runLayout = useCallback(async () => {
    const { default: ELK } = await import('elkjs/lib/elk.bundled.js')
    const graph = await new ELK().layout({
      id: 'system',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.layered.spacing.nodeNodeBetweenLayers': '110',
        'elk.spacing.nodeNode': '48',
        'elk.separateConnectedComponents': 'true',
        'elk.spacing.componentComponent': '70',
        'elk.padding': '[top=30,left=30,bottom=30,right=30]',
      },
      children: components.map(component => ({ id: component.id, width: nodeWidth, height: nodeHeight })),
      edges: relationships.map(edge => ({ id: `${edge.from}-${edge.to}`, sources: [edge.from], targets: [edge.to] })),
    })
    const positions = new Map(graph.children?.map(node => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }]))
    const nextNodes: SystemNode[] = components.map(component => ({
      id: component.id,
      type: 'system',
      position: positions.get(component.id) ?? { x: 0, y: 0 },
      data: { component, color: kindColors[componentKind(component)] },
      style: { width: nodeWidth, height: nodeHeight },
    }))
    setLayoutPending(false)
    fitWhenReady.current = true
    startSimulation(nextNodes)
  }, [components, relationships, startSimulation])

  useEffect(() => {
    void runLayout()
    return () => {
      simulation.current?.stop()
      if (frame.current) cancelAnimationFrame(frame.current)
    }
  }, [runLayout])

  useEffect(() => {
    if (layoutPending || !fitWhenReady.current || !instance.current || !nodes.length) return
    fitWhenReady.current = false
    requestAnimationFrame(() => instance.current?.fitView({ duration: 260, padding: .12, minZoom: .1, maxZoom: .9 }))
  }, [layoutPending, nodes])

  const nodeById = new Map(nodes.map(node => [node.id, node]))
  const related = focus ? new Set([
    focus,
    ...relationships.filter(edge => edge.from === focus || edge.to === focus).flatMap(edge => [edge.from, edge.to]),
  ]) : undefined
  const displayNodes = nodes.map(node => ({
    ...node,
    className: `${node.id === focus ? 'is-selected' : ''}${related && !related.has(node.id) ? ' is-muted' : ''}`.trim(),
  }))
  const edges: Edge[] = relationships.flatMap(({ from, to }) => {
    const source = nodeById.get(from)
    const target = nodeById.get(to)
    if (!source || !target) return []
    const highlighted = !focus || from === focus || to === focus
    return [{
      id: `${from}-${to}`,
      source: from,
      target: to,
      ...edgePorts(source, target),
      type: 'bezier',
      markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15 },
      className: `${focus ? highlighted ? 'is-highlighted' : 'is-muted' : ''}`,
    }]
  })
  const visibleKinds = [...new Set(components.map(componentKind))]
  const releaseAnchors = (except?: string) => {
    for (const forceNode of forceNodes.current.values()) {
      if (forceNode.id === except) continue
      forceNode.fx = null
      forceNode.fy = null
    }
  }

  return <div className="system-overview-map" aria-label="Full dependency map">
    {layoutPending && <div className="system-overview-loading">Arranging the system…</div>}
    <ReactFlow<SystemNode, Edge>
      nodes={displayNodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onInit={flow => { instance.current = flow }}
      onNodesChange={onNodesChange}
      nodesConnectable={false}
      elementsSelectable
      minZoom={.1}
      maxZoom={1.7}
      zoomOnScroll={false}
      panOnScroll={false}
      preventScrolling={false}
      zoomOnPinch
      onNodeClick={(_, node) => onFocus(node.id)}
      onPaneClick={() => onFocus('')}
      onNodeDragStart={(_, node) => {
        releaseAnchors(node.id)
        const forceNode = forceNodes.current.get(node.id)
        if (forceNode) {
          forceNode.fx = node.position.x + nodeWidth / 2
          forceNode.fy = node.position.y + nodeHeight / 2
        }
        fitWhenReady.current = false
        simulation.current?.alphaTarget(.3).restart()
        onFocus(node.id)
      }}
      onNodeDrag={(_, node) => {
        const forceNode = forceNodes.current.get(node.id)
        if (!forceNode) return
        forceNode.fx = node.position.x + nodeWidth / 2
        forceNode.fy = node.position.y + nodeHeight / 2
      }}
      onNodeDragStop={(_, node) => {
        const forceNode = forceNodes.current.get(node.id)
        if (forceNode) {
          forceNode.fx = node.position.x + nodeWidth / 2
          forceNode.fy = node.position.y + nodeHeight / 2
        }
        fitWhenReady.current = false
        simulation.current?.alphaTarget(0).alpha(.55).restart()
      }}
      onNodeContextMenu={(event, node) => {
        event.preventDefault()
        const forceNode = forceNodes.current.get(node.id)
        if (forceNode) {
          forceNode.fx = null
          forceNode.fy = null
        }
        fitWhenReady.current = false
        simulation.current?.alphaTarget(0).alpha(.55).restart()
      }}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={24} size={1} />
      <MiniMap pannable zoomable nodeColor={node => (node.data as SystemNodeData).color} />
      <Controls showInteractive={false} />
      <Panel position="top-right"><button className="system-auto-layout" onClick={() => void runLayout()}><LayoutDashboard size={13} />Auto layout</button></Panel>
    </ReactFlow>
    <div className="system-overview-kind-legend" aria-label="Component type colors">
      {visibleKinds.map(kind => {
        const component = components.find(item => componentKind(item) === kind)!
        return <span key={kind} className={`kind-${kind}`}><i />{componentKindLabel(component)}</span>
      })}
    </div>
    <div className="system-overview-legend"><span>Drag a node to pull the graph</span><span>Dropped node stays pinned</span><span>Right-click to release</span><span>Auto layout restores the tree</span></div>
  </div>
}
