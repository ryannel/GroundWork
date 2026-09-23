import type { ID } from './model.ts'
import type { FeatureSpec, JourneyStep, Mockup, FlowNode, FlowEdge, ApiContract, Table, TestCase, Criterion, SectionKind } from './spec.ts'

/** A pointer to one item in one section. The unit of cross-referencing. */
export interface Ref { kind: SectionKind; id: string }

/**
 * Every record below has a null prototype, so user IDs such as `toString` or `hasOwnProperty` never hit
 * `Object.prototype` members. Build new ones with `table()`, never `{}`.
 */
export interface SpecIndex {
  step: Record<string, JourneyStep>
  /** 1-based position of each journey step, in document order. */
  stepOrder: ReadonlyMap<string, number>
  mockup: Record<string, Mockup>
  node: Record<string, FlowNode>
  edge: Record<string, FlowEdge>
  contract: Record<string, ApiContract>
  table: Record<string, Table>
  test: Record<string, TestCase>
  criterion: Record<string, Criterion>

  /** Derived, per item. Everything below is a backlink or a transitive link. */
  stepContracts: Record<string, string[]>   // contracts crossed by a step's flow path
  stepTables: Record<string, string[]>      // tables touched by a step's flow path
  stepTests: Record<string, string[]>
  mockupSteps: Record<string, string[]>
  nodeSteps: Record<string, string[]>
  nodeContracts: Record<string, string[]>   // contracts on in/out edges
  contractEdge: Record<string, string | undefined>
  contractSteps: Record<string, string[]>
  contractTests: Record<string, string[]>
  tableNode: Record<string, string | undefined>
  tableSteps: Record<string, string[]>
  tableTests: Record<string, string[]>
  testSpans: Record<string, ID[]>           // components exercised, derived
  testCriteria: Record<string, string[]>
  /** Subgraph a test lights up in the flow diagram. */
  testNodes: Record<string, string[]>
  testEdges: Record<string, string[]>

  /** Gaps worth surfacing. */
  untestedSteps: string[]
  untestedContracts: string[]
  unprovenCriteria: string[]
}

const table = <T>(): Record<string, T> => Object.create(null) as Record<string, T>
const byId = <T extends { id: string }>(xs: T[] | undefined) => { const m = table<T>(); for (const x of xs ?? []) m[x.id] = x; return m }
const push = (m: Record<string, string[]>, k: string, v: string) => {
  const list = Object.hasOwn(m, k) ? m[k] : (m[k] = [])
  if (!list.includes(v)) list.push(v)
}

export function buildIndex(spec: FeatureSpec): SpecIndex {
  const steps = spec.journey?.steps ?? []
  const edges = spec.flow?.edges ?? []
  const nodes = spec.flow?.nodes ?? []
  const contracts = spec.api?.contracts ?? []
  const tables = spec.storage?.tables ?? []
  const tests = spec.tests?.cases ?? []
  const criteria = spec.purpose?.success ?? []

  const ix: SpecIndex = {
    step: byId(steps), stepOrder: new Map(steps.map((s, i) => [s.id, i + 1])),
    mockup: byId(spec.design?.mockups), node: byId(nodes), edge: byId(edges),
    contract: byId(contracts), table: byId(tables), test: byId(tests), criterion: byId(criteria),
    stepContracts: table(), stepTables: table(), stepTests: table(), mockupSteps: table(), nodeSteps: table(), nodeContracts: table(),
    contractEdge: table(), contractSteps: table(), contractTests: table(), tableNode: table(), tableSteps: table(), tableTests: table(),
    testSpans: table(), testCriteria: table(), testNodes: table(), testEdges: table(),
    untestedSteps: [], untestedContracts: [], unprovenCriteria: [],
  }

  // Flow → api/storage
  for (const e of edges) for (const c of e.contracts ?? []) {
    ix.contractEdge[c] = e.id; push(ix.nodeContracts, e.from, c); push(ix.nodeContracts, e.to, c)
  }
  for (const n of nodes) for (const t of n.tables ?? []) ix.tableNode[t] = n.id

  // Journey → design/flow, then transitively → api/storage
  for (const s of steps) {
    if (s.design) push(ix.mockupSteps, s.design, s.id)
    const path = s.flow ?? []
    for (const nid of path) {
      push(ix.nodeSteps, nid, s.id)
      for (const t of ix.node[nid]?.tables ?? []) {
        if (ix.table[t]?.change !== 'removed') { push(ix.stepTables, s.id, t); push(ix.tableSteps, t, s.id) }
      }
    }
    const crossed = s.contracts ?? edges
      .filter(e => path.includes(e.from) && path.includes(e.to) && (!s.flowEdges || s.flowEdges.includes(e.id)))
      .flatMap(e => e.contracts ?? [])
    for (const c of crossed) { push(ix.stepContracts, s.id, c); push(ix.contractSteps, c, s.id) }
  }

  // Tests → everything
  for (const t of tests) {
    const spans = new Set<ID>()
    const tn = new Set<string>(), te = new Set<string>()
    for (const sid of t.steps ?? []) {
      push(ix.stepTests, sid, t.id)
      for (const nid of ix.step[sid]?.flow ?? []) { tn.add(nid); const c = ix.node[nid]?.component; if (c) spans.add(c) }
      for (const cid of ix.stepContracts[sid] ?? []) { const eid = ix.contractEdge[cid]; if (eid) te.add(eid) }
    }
    for (const cid of t.contracts ?? []) {
      push(ix.contractTests, cid, t.id)
      const c = ix.contract[cid]; if (c) { spans.add(c.from); spans.add(c.to) }
      const eid = ix.contractEdge[cid]; const edge = eid ? ix.edge[eid] : undefined
      if (eid && edge) { te.add(eid); tn.add(edge.from); tn.add(edge.to) }
    }
    for (const tid of t.tables ?? []) {
      push(ix.tableTests, tid, t.id)
      const tb = ix.table[tid]; if (tb) spans.add(tb.component)
      const nid = ix.tableNode[tid]; if (nid) tn.add(nid)
    }
    // Edges fully inside the lit nodes light up too.
    for (const e of edges) if (tn.has(e.from) && tn.has(e.to)) te.add(e.id)
    ix.testSpans[t.id] = [...spans]
    ix.testNodes[t.id] = [...tn]
    ix.testEdges[t.id] = [...te]
  }
  for (const c of criteria) for (const tid of c.tests ?? []) push(ix.testCriteria, tid, c.id)

  ix.untestedSteps = steps.filter(s => !ix.stepTests[s.id]?.length).map(s => s.id)
  ix.untestedContracts = contracts.filter(c => c.change !== 'removed' && !ix.contractTests[c.id]?.length).map(c => c.id)
  ix.unprovenCriteria = criteria.filter(c => !c.tests?.length).map(c => c.id)
  return ix
}

/** Human label for a ref, used by chips and tooltips. */
export function refLabel(ix: SpecIndex, r: Ref): { title: string; sub?: string } | undefined {
  switch (r.kind) {
    case 'journey': { const s = ix.step[r.id]; return s && { title: `Step ${ix.stepOrder.get(r.id)}`, sub: `${s.actor}: ${s.action}` } }
    case 'design': { const m = ix.mockup[r.id]; return m && { title: m.title, sub: m.kind } }
    case 'flow': { const n = ix.node[r.id]; return n && { title: n.label, sub: n.kind } }
    case 'api': { const c = ix.contract[r.id]; return c && { title: c.method ? `${c.method} ${c.path}` : c.path, sub: c.name } }
    case 'storage': { const t = ix.table[r.id]; return t && { title: t.name, sub: t.change } }
    case 'tests': { const t = ix.test[r.id]; return t && { title: t.id, sub: t.title } }
    case 'purpose': { const c = ix.criterion[r.id]; return c && { title: c.text } }
  }
}

/**
 * Component lens: the item ids in each section that touch one component. A step touches it when its
 * flow path enters the component; a contract when the component is either side of the boundary; a
 * table when the component owns it; a test when its derived span includes it. Purpose and design
 * are not filtered.
 */
export type Lens = Partial<Record<SectionKind, Set<string>>>
export function lensFor(spec: FeatureSpec, ix: SpecIndex, component: ID | ReadonlySet<ID>): Lens {
  const components = typeof component === 'string' ? new Set([component]) : component
  const inC = (nid: string) => components.has(ix.node[nid]?.component ?? '')
  return {
    journey: new Set((spec.journey?.steps ?? []).filter(s => (s.flow ?? []).some(inC)).map(s => s.id)),
    flow: new Set((spec.flow?.nodes ?? []).filter(n => components.has(n.component ?? '')).map(n => n.id)),
    api: new Set((spec.api?.contracts ?? []).filter(c => components.has(c.from) || components.has(c.to)).map(c => c.id)),
    storage: new Set((spec.storage?.tables ?? []).filter(t => components.has(t.component)).map(t => t.id)),
    tests: new Set((spec.tests?.cases ?? []).filter(t => (ix.testSpans[t.id] ?? []).some(id => components.has(id))).map(t => t.id)),
  }
}
