import { ComponentOptions } from '@/components/component-structure'
import { componentAncestors, componentScopeIds, featureComponents } from '@/data/component-structure'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { Flow, FlowNode } from '@/data/spec'
import { actionFlow, resolveFlowAction, resolveFlowSelection } from '@/data/flow-context'
import { q } from '@/data/store'
import { hueStyle } from '@/lib/taxonomy'
import { cn } from '@/lib/cn'
import { ArrowRight, Maximize2, Workflow } from 'lucide-react'
import { useLens, useSpec } from './context'
import { FlowInspector } from './flow-inspector'

const laneHues = ['--hue-indigo', '--hue-teal', '--hue-amber', '--hue-magenta', '--hue-sky', '--hue-violet', '--hue-mint']
const W = 140, H = 56, GX = 100, GY = 100, PAD = 32

export function FlowSection({ data, focus }: { data: Flow; focus?: string }) {
  const { ix, spec, featureId } = useSpec()
  const [zoom, setZoom] = useState<'actual' | 'fit'>('actual')
  const canvas = useRef<HTMLDivElement>(null)
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const selectedNode = params.has('node') ? params.get('node') ?? '' : focus
  const action = resolveFlowAction(spec, params.get('trace'), selectedNode, params.get('contract') ?? undefined)
  const visible = actionFlow({ ...spec, flow: data }, action)
  const selection = resolveFlowSelection(spec, action, { node: selectedNode, edge: params.get('edge') ?? undefined, contract: params.get('contract') ?? undefined })
  const lens = useLens('flow')
  const steps = spec.journey?.steps.filter(step => step.flow?.length) ?? []
  const canonicalTrace = action ? `journey:${action.id}` : undefined
  // Deep links and old test traces resolve to a named action and retain it in browser history.
  useEffect(() => {
    if (canonicalTrace && params.get('trace') !== canonicalTrace) setParams(previous => {
      const next = new URLSearchParams(previous)
      next.set('trace', canonicalTrace)
      return next
    }, { replace: true })
  }, [canonicalTrace, params, setParams])
  const select = (kind?: 'node' | 'edge', id?: string) => {
    const next = new URLSearchParams(params)
    next.delete('node'); next.delete('edge'); next.delete('contract')
    if (kind && id) next.set(kind, id)
    if (canonicalTrace) next.set('trace', canonicalTrace)
    navigate(`/f/${featureId}/flow?${next}`)
  }
  const selectNode = (id: string) => select('node', id)
  const selectBoundary = (id: string) => select('edge', id)
  const selectAction = (id: string) => {
    const next = new URLSearchParams()
    next.set('trace', `journey:${id}`)
    const component = params.get('component')
    if (component && steps.find(step => step.id === id)?.flow?.some(nodeId => componentScopeIds(component, q.components()).has(ix.node[nodeId]?.component ?? ''))) next.set('component', component)
    navigate(`/f/${featureId}/flow?${next}`)
  }
  const columns = [...new Set(visible.nodes.map(node => node.col))].sort((a, b) => a - b)
  const rows = [...new Set(visible.nodes.map(node => node.row))].sort((a, b) => a - b)
  const pos = (node: FlowNode) => ({ x: PAD + columns.indexOf(node.col) * (W + GX), y: PAD + rows.indexOf(node.row) * (H + GY) })
  const width = PAD * 2 + Math.max(1, columns.length) * (W + GX) - GX
  const height = PAD * 2 + Math.max(1, rows.length) * (H + GY) - GY
  const byId = Object.fromEntries(visible.nodes.map(node => [node.id, node]))
  const lanes = [...new Set(visible.nodes.map(node => node.component).filter(Boolean))] as string[]
  const family = (id: string) => componentAncestors(id, q.components())[0]?.id ?? id
  const families = [...new Set(lanes.map(family))]
  const hueOf = (id?: string) => id ? `var(${laneHues[Math.max(0, families.indexOf(family(id))) % laneHues.length]})` : 'var(--hue-slate)'
  const dimN = (id: string) => !!lens && !lens.has(id)
  const dimE = (id: string) => !!lens && !(lens.has(ix.edge[id]?.from) || lens.has(ix.edge[id]?.to))

  if (!action) return <section className="flow-no-action"><Workflow size={28} /><h2>Start with a user action</h2><p>Link a journey action to its system steps to explore decisions, service boundaries and data.</p><Link to={`/f/${featureId}/journey`}>Open user journey <ArrowRight size={14} /></Link></section>

  return <div className="flow-workbench">
    <div className="flow-stage">
      <div className="flow-toolbar action-flow-toolbar">
        <h2>System flow</h2>
        <label>Action<select aria-label="User action" value={action.id} onChange={e => selectAction(e.target.value)}>{steps.map((step, index) => <option key={step.id} value={step.id}>{index + 1}. {step.action}</option>)}</select></label>
        <label className="flow-scope"><span className="sr-only">Component scope</span><select aria-label="Component scope" value={params.get('component') ?? ''} onChange={e => setParams(previous => { const next = new URLSearchParams(previous); if (e.target.value) next.set('component', e.target.value); else next.delete('component'); return next })}><option value="">All components</option><ComponentOptions components={featureComponents(q.features().find(f => f.id === featureId)!, q.components())} /></select></label>
        <div className="flow-zoom" role="group" aria-label="Diagram size"><button className="flow-fit" aria-pressed={zoom === 'fit'} onClick={() => setZoom('fit')}><Maximize2 size={14} />Fit</button><button className="flow-fit" aria-pressed={zoom === 'actual'} onClick={() => setZoom('actual')}>Actual size</button></div>
      </div>
      <section className="flow-action-banner" aria-label="Current action"><div><span>Action {steps.indexOf(action) + 1} of {steps.length}</span><span>{action.actor}</span>{action.surface && <span>{action.surface}</span>}</div><h3>{action.action}</h3>{action.note && <p>{action.note}</p>}{action.result && <p className="flow-action-result"><strong>Result</strong> {action.result}</p>}<Link to={`/f/${featureId}/journey/${action.id}`}>View in user journey <ArrowRight size={12} /></Link></section>
      <p className="flow-help" id="flow-help">Select a decision for logic, an API label for its contract, or a store for its data model.{zoom === 'actual' && <span>Scroll across the diagram, or choose Fit to see the whole action.</span>}</p>
      <div ref={canvas} className="flow-canvas" tabIndex={0} role="region" aria-describedby="flow-help" aria-label={`System flow for: ${action.action}`}>
        <svg role="group" aria-label="Interactive system flow" viewBox={`0 0 ${width} ${height}`} className="block" style={{ width: '100%', minWidth: zoom === 'fit' ? 0 : width, maxWidth: width, height: 'auto' }}>
          <defs>
            <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M0,0 L8,4 L0,8 z" fill="var(--fg-muted)" />
            </marker>
          </defs>
          {visible.edges.map(e => {
            const a = byId[e.from], b = byId[e.to]
            if (!a || !b) return null
            const pa = pos(a), pb = pos(b)
            const forward = b.col > a.col
            const sx = forward ? pa.x + W : pa.x + W / 2
            const sy = forward ? pa.y + H / 2 : (b.row > a.row ? pa.y + H : pa.y)
            const tx = forward ? pb.x : pb.x + W / 2
            const ty = forward ? pb.y + H / 2 : (b.row > a.row ? pb.y : pb.y + H)
            const mx = forward ? sx + GX / 2 : sx
            const d = forward ? `M${sx},${sy} H${mx} V${ty} H${tx}` : `M${sx},${sy} V${(sy + ty) / 2} H${tx} V${ty}`
            const lx = forward ? mx : (sx + tx) / 2, ly = (sy + ty) / 2
            const cs = (e.contracts ?? []).map(id => ix.contract[id]).filter(Boolean)
            const c = cs[0]
            const methodTag = cs.length > 2 ? `${cs.length} APIs` : cs.map(x => x.method ?? 'API').join(' · ')
            const tag = c ? [e.label, methodTag].filter(Boolean).join(' · ') : e.label
            const w = tag ? tag.length * 6.6 + 10 : 0
            return (
              <g key={e.id} className={cn('transition-opacity', dimE(e.id) && 'opacity-15', c && 'flow-boundary')} role={c ? 'button' : undefined} tabIndex={c ? 0 : undefined} aria-label={c ? `Inspect boundary: ${a.label} to ${b.label}` : undefined} aria-pressed={c ? selection.kind === 'boundary' && selection.edge.id === e.id : undefined} onClick={c ? () => selectBoundary(e.id) : undefined} onKeyDown={event => { if (c && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); selectBoundary(e.id) } }}>
                {c && <path d={d} fill="none" stroke="transparent" strokeWidth={16} className="flow-boundary-hit" />}
                <path d={d} fill="none" stroke={!dimE(e.id) ? 'var(--accent)' : 'var(--fg-muted)'} strokeWidth={c ? 1.5 : 1.25} strokeDasharray={e.async ? '4 3' : undefined} markerEnd="url(#arrow)" />
                {tag && (
                  <g transform={`translate(${lx},${ly})`}>
                    <title>{c ? cs.map(x => x.name).join(', ') + ' · inspect boundary' : e.label}</title>
                    <rect x={-w / 2} y={-9} width={w} height={18} rx={c ? 4 : 9} fill='var(--bg-elevated)' stroke='var(--border)' />
                    <text textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight={c ? 600 : 400} letterSpacing={c ? 0.4 : 0} stroke="none" fill={c ? 'var(--accent)' : 'var(--fg-muted)'} fontFamily={c ? 'var(--font-mono)' : undefined}>{tag}</text>
                  </g>
                )}
              </g>
            )
          })}
          {visible.nodes.map(n => {
            const { x, y } = pos(n)
            const hue = hueOf(n.component)
            const link = n.tables?.length ? { kind: 'storage' as const, id: n.tables[0] } : undefined
            const isFocus = selection.kind === 'node' && selection.node.id === n.id
            const shape = n.kind === 'decision'
              ? <path d={`M${x + W / 2},${y} L${x + W},${y + H / 2} L${x + W / 2},${y + H} L${x},${y + H / 2} z`} />
              : n.kind === 'store'
                ? <path d={`M${x},${y + 6} a${W / 2},6 0 0,1 ${W},0 v${H - 12} a${W / 2},6 0 0,1 -${W},0 z`} />
                : <rect x={x} y={y} width={W} height={H} rx={n.kind === 'queue' ? H / 2 : 8} />
            return (
              <g key={n.id} style={hueStyle(hue)} className={cn('flow-node cursor-pointer transition-opacity', dimN(n.id) && 'opacity-15')} role="button" tabIndex={0} aria-label={`Inspect ${n.label}`} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectNode(n.id) } }} onClick={() => selectNode(n.id)}
                fill={isFocus ? 'var(--accent-soft)' : 'var(--bg-elevated)'} stroke={isFocus ? 'var(--accent)' : 'var(--border-strong)'} strokeWidth={isFocus ? 2 : 1} aria-pressed={isFocus}>
                <title>{n.label}{link ? ' · has storage records' : ''}</title>
                {shape}
                <text x={x + W / 2} y={y + H / 2} textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight={500} fill="var(--fg)" stroke="none" fontFamily={n.kind === 'store' ? 'var(--font-mono)' : undefined}>{n.label}</text>
                {n.component && <text x={x + W / 2} y={y + H + 20} textAnchor="middle" fontSize={10} fill="var(--fg-muted)" stroke="none">{q.componentLabel(n.component)}</text>}
              </g>
            )
          })}
        </svg>
      </div>
      <div className="flow-lane-legend">{lanes.map(id => <span key={id} style={hueStyle(hueOf(id))}><span className="size-2 rounded-sm hue-dot" /><code>{q.componentLabel(id)}</code><small>{q.componentType(id)}</small></span>)}<span>{visible.nodes.length} steps · arrows show calls and data access; responses return to the caller · dashed = async</span></div>
      <nav className="flow-context" aria-label="Related feature sections"><span>In this action</span><Link to={`/f/${featureId}/journey/${action.id}`}><Workflow size={15} />User journey<ArrowRight size={12} /></Link><span>Select a decision for logic, a boundary for its API, or a store for its schema.</span></nav>
    </div>
    {selection.kind !== 'none' && <FlowInspector action={action} selection={selection} onNode={selectNode} onBoundary={selectBoundary} onClose={() => { select(); canvas.current?.focus({ preventScroll: true }); if (window.matchMedia('(max-width: 1200px)').matches) canvas.current?.scrollIntoView({ block: 'center' }) }} />}
  </div>
}
