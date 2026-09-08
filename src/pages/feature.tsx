import { useEffect, type ComponentType } from 'react'
import { Link, Navigate, useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowLeft, LayoutDashboard, Circle, CheckCircle2, Layers, AlertCircle } from 'lucide-react'
import { q, relTime, isActive } from '@/data/store'
import { sectionKinds, type SectionKind } from '@/data/spec'
import { buildIndex, lensFor } from '@/data/spec-index'
import { sectionMeta, sectionRenderers, sectionCount, SpecContext } from '@/components/spec'
import { ComponentOptions, FeatureArchitecture } from '@/components/component-structure'
import { componentScopeIds, featureComponents, changesOverlap } from '@/data/component-structure'
import { StageBadge } from '@/ui/badge'
import { ChangeMark } from '@/components/spec/change'
import { useRuntime } from '@/data/runtime'
import { DeliveryPage } from './delivery'
import { cn } from '@/lib/cn'

const groups: { label: string; sections: SectionKind[] }[] = [
  { label: '01 · Define', sections: ['purpose'] },
  { label: '02 · Experience', sections: ['journey', 'design'] },
  { label: '03 · Build', sections: ['flow', 'api', 'storage'] },
  { label: '04 · Validate', sections: ['tests'] },
]
const questions: Record<SectionKind, string> = {
  purpose: 'What problem are we solving, and what does success look like?',
  journey: 'Follow the experience, from the first action to the final outcome.',
  design: 'Explore the screens and try the interactions behind the journey.',
  flow: 'Trace a user action through the components that make it happen.',
  api: 'Explore each component’s API and the changes needed to support this feature.',
  storage: 'Understand what we store, who owns it, and how the schema changes.',
  tests: 'Separate what is covered from what has actually passed.',
}

export function FeaturePage() {
  const { id = '', section, item } = useParams()
  const navigate = useNavigate()
  const { plan } = useRuntime()
  const delivery = id ? plan?.delivery[id] : undefined
  const [params, setParams] = useSearchParams()
  const f = q.features().find(x => x.id === id)
  const spec = f?.spec ?? {}
  const ix = buildIndex(spec)
  const isDelivery = section === 'delivery'
  const target = sectionKinds.includes(section as SectionKind) ? section as SectionKind : undefined
  const allComponents = q.components()
  const participants = f ? featureComponents(f, allComponents) : []
  const lensComponent = participants.find(c => c.id === params.get('component'))
  const lens = lensComponent ? lensFor(spec, ix, componentScopeIds(lensComponent.id, allComponents)) : undefined
  useEffect(() => { if (!item) window.scrollTo({ top: 0 }) }, [id, section, item])
  if (!f) return <Navigate to="/" replace />
  if (section && !target && !isDelivery) return <Navigate to={`/f/${id}`} replace />
  const product = q.product(f.productId)!
  const workspace = q.workspace(product.workspaceId)!
  const touches = f.touches.map(cid => q.component(cid)!).filter(Boolean)
  const related = q.features().filter(o => o.id !== id && isActive(o) && changesOverlap(f, o, allComponents))
  const populatedExample = q.features().find(other => other.id !== id && (!target || other.spec?.[target]))
  const cases = spec.tests?.cases ?? []
  const passing = cases.filter(c => c.status === 'passing').length
  const currentAction = params.get('trace')?.startsWith('journey:') ? ix.step[params.get('trace')!.slice(8)] : undefined
  const firstGap = ix.unprovenCriteria.length ? ix.criterion[ix.unprovenCriteria[0]]?.text : undefined
  const componentHref = (componentId: string) => {
    const includesComponent = (step: typeof currentAction) => step?.flow?.some(id => componentScopeIds(componentId, allComponents).has(ix.node[id]?.component ?? ''))
    const action = includesComponent(currentAction) ? currentAction : spec.journey?.steps.find(includesComponent)
    if (!action) {
      const component = q.component(componentId)
      const owner = component && q.product(component.productId)
      const parent = owner && q.workspace(owner.workspaceId)
      return owner && parent ? `/w/${parent.slug}/${owner.slug}?component=${encodeURIComponent(componentId)}` : href('flow')
    }
    const query = new URLSearchParams({ component: componentId })
    if (action) query.set('trace', `journey:${action.id}`)
    return `/f/${id}/flow?${query}`
  }
  const tableGaps = (spec.storage?.tables ?? []).filter(t => t.change !== 'removed' && !ix.tableTests[t.id]?.length)
  const gaps = ix.untestedSteps.length + ix.untestedContracts.length + ix.unprovenCriteria.length + tableGaps.length
  const present = sectionKinds.filter(k => spec[k])
  const href = (k?: SectionKind | 'delivery') => {
    const query = new URLSearchParams()
    if (lens) query.set('component', lensComponent!.id)
    const trace = params.get('trace')
    if (trace?.startsWith('journey:') && ix.step[trace.slice(8)]) query.set('trace', trace)
    return `/f/${id}${k ? `/${k}` : ''}${query.size ? `?${query}` : ''}`
  }
  const Render = target ? sectionRenderers[target] as ComponentType<{ data: unknown; focus?: string }> : undefined
  const currentIndex = target ? sectionKinds.indexOf(target) : -1
  const next = sectionKinds[currentIndex + 1]
  return <SpecContext.Provider value={{ featureId: id, spec, ix, lens, lensName: lens ? q.componentLabel(lensComponent!.id) : undefined }}>
    <div className={cn("feature-workspace", !target && !isDelivery && "is-overview", (target || isDelivery) && "is-focused", target === "flow" && "is-flow")}>
      <label className="mobile-section-picker">Explore this feature<select value={isDelivery ? 'delivery' : target ?? ''} onChange={e => navigate(href(e.target.value ? e.target.value as SectionKind | 'delivery' : undefined))}><option value="">Overview</option>{groups.map(g => <optgroup key={g.label} label={g.label}>{g.sections.map(k => <option key={k} value={k}>{sectionMeta[k].label}{!spec[k] ? ' · Not drafted' : ''}</option>)}</optgroup>)}<option value="delivery">Deliverables & tasks</option></select></label>
      <aside className="feature-nav">
        <Link to={`/w/${workspace.slug}/${product.slug}`} className="back-product"><ArrowLeft size={14} />{product.name}</Link>
        <div className="eyebrow mb-3 mt-7">Feature plan</div>
        <Link to={href()} aria-current={!target && !isDelivery ? 'page' : undefined} className={cn('plan-nav-link', !target && !isDelivery && 'is-active')}><LayoutDashboard size={16} />Overview</Link>
        {groups.map(g => <div className="nav-group" key={g.label}><div className="eyebrow">{g.label}</div>{g.sections.map(k => {
          const m = sectionMeta[k]
          return <Link key={k} to={href(k)} aria-current={target === k ? 'page' : undefined} className={cn('plan-nav-link', target === k && 'is-active')}><m.icon className="size-4" /><span>{m.label}</span><span className="nav-count">{spec[k] ? sectionCount(spec, k) ?? <CheckCircle2 size={12} /> : <Circle size={10} />}</span></Link>
        })}</div>)}
        <div className="nav-group"><div className="eyebrow">05 · Deliver</div><Link className={cn("plan-nav-link", isDelivery && "is-active")} aria-current={isDelivery ? "page" : undefined} to={href("delivery")}><Layers size={16} />Deliverables & tasks</Link></div>
        <div className="nav-foot"><Layers size={15} /><span>{present.length} of 7 sections drafted<br /><small>Drafted does not mean validated</small></span></div>
      </aside>
      <div className="feature-main">
        {target || isDelivery ? <><header className="feature-heading">
          <Link to={`/w/${workspace.slug}/${product.slug}`} aria-label={`Back to ${product.name}`}><ArrowLeft size={16} /></Link>
          <span className="feature-id">{id.toUpperCase()}</span><h1>{f.title}</h1><StageBadge stage={f.stage} />
          <div className="feature-meta"><span className="meta-owner-label">Owner</span><span className="owner-avatar">{f.owner.split(' ').map(x => x[0]).join('')}</span><span>{f.owner}</span></div>
        </header>
        <nav className="feature-tabs" aria-label="Feature sections">{([undefined, 'flow', 'api', 'storage', 'tests', 'delivery'] as const).map((k, i) => <Link key={k ?? 'overview'} to={href(k)} aria-current={(isDelivery ? 'delivery' : target) === k ? 'page' : undefined}>{['Overview', 'System flow', 'API contracts', 'Data model', 'Tests & coverage', 'Delivery'][i]}</Link>)}</nav></> : <header className="feature-overview-header">
          <div className="feature-overview-kicker"><span className="feature-id">{id.toUpperCase()}</span><span>Feature plan</span><StageBadge stage={f.stage} /></div>
          <h1>{f.title}</h1>
          <div className="feature-overview-byline"><span className="owner-avatar" aria-hidden="true">{f.owner.split(' ').map(x => x[0]).join('')}</span><span>{f.owner}</span><span className="byline-divider" /><time dateTime={f.updatedAt} title={new Date(f.updatedAt).toLocaleString()}>Updated {relTime(f.updatedAt)}</time>{spec.journey && <Link className="primary-link" to={href(currentAction ? 'flow' : 'journey')}>{currentAction ? 'Continue system flow' : 'Explore the journey'}<ArrowRight size={15} /></Link>}</div>
        </header>}
        {isDelivery ? <DeliveryPage embedded /> : !target ? <div className="workbench-overview">
          <Link className="feature-delivery-callout" to={`/f/${id}/delivery`}><div><strong>Delivery plan</strong><p>{delivery?.deliverables.length ? `${delivery.deliverables.length} deliverables · ${delivery.tasks.length} component tasks · ${delivery.validation.length} validation plans` : "Divide the feature into user-visible deliverables and component tasks."}</p></div><ArrowRight size={20} /></Link>
          <div className="feature-intent-grid">
            <section className="feature-intent-panel" aria-labelledby="feature-intent-heading"><h2 id="feature-intent-heading">{spec.purpose?.outcome ? 'Intended outcome' : 'Feature intent'}</h2><p>{spec.purpose?.outcome ?? f.summary ?? 'Describe what should become better for the user and why it matters.'}</p>{spec.purpose && <Link to={href('purpose')}>Brief & success criteria<ArrowRight size={14} /></Link>}</section>
            <section className={cn('feature-next-panel', gaps > 0 && 'has-review-gaps')} aria-labelledby="feature-next-heading"><div className="feature-next-label">{gaps ? <AlertCircle size={15} /> : <Layers size={15} />}<span>{gaps ? 'Needs evidence' : 'Next step'}</span></div><h2 id="feature-next-heading">{!spec.purpose ? 'Shape the brief' : gaps ? 'Close the validation gaps' : !cases.length ? 'Plan the validation' : passing < cases.length ? 'Review test evidence' : 'Review the plan'}</h2><p>{!spec.purpose ? 'Turn the intent into a clear outcome, scope, and success criteria.' : gaps ? `${gaps} ${gaps === 1 ? 'item has' : 'items have'} no linked test${firstGap ? `${gaps === 1 ? ': ' : '. One gap: '}${firstGap.replace(/[.!?]$/, '')}.` : '.'}` : !cases.length ? 'Connect tests to the outcomes and changes this feature promises.' : passing < cases.length ? `${cases.length - passing} of ${cases.length} tests are not marked passing yet.` : 'All listed tests are marked passing. Review the results alongside the intended outcome.'}</p><Link to={href(!spec.purpose ? 'purpose' : 'tests')}>{!spec.purpose ? 'Start with the brief' : 'Review tests & coverage'}<ArrowRight size={14} /></Link>{cases.length > 0 && <div className="feature-test-evidence"><CheckCircle2 size={14} /><span><strong>{passing} / {cases.length}</strong> tests marked passing</span></div>}</section>
          </div>
          {spec.api && <section className="overview-change-summary"><h2>API contract changes</h2>{(['added', 'updated', 'removed', 'unspecified'] as const).filter(change => change !== 'unspecified' || spec.api!.contracts.some(c => c.change === change)).map(change => <span key={change}><ChangeMark change={change} /> {spec.api!.contracts.filter(c => c.change === change).length}</span>)}<Link to={href('api')}>Inspect contracts & fields <ArrowRight size={14} /></Link></section>}
          <section className="explore-section">
            <div className="section-line"><h2>Plan contents</h2><span>{present.length} / 7 sections drafted</span></div>
            <div className="plan-index">{groups.map((g, i) => <div className="plan-index-row" key={g.label}>
              <h3 className="plan-index-group"><span className="plan-number" aria-hidden="true">0{i + 1}</span>{['Define', 'Experience', 'Build', 'Validate'][i]}</h3>
              <div className="plan-index-links">{g.sections.map((k, i) => {
                const Icon = sectionMeta[k].icon
                return <span className="plan-index-item" key={k}>{i > 0 && <ArrowRight size={13} aria-hidden="true" className="plan-index-arrow" />}<Link to={href(k)}><Icon className="size-3.5" aria-hidden="true" /><span>{sectionMeta[k].label}</span><small className={spec[k] ? 'is-drafted' : ''}>{spec[k] ? 'Drafted' : 'Not drafted'}</small></Link></span>
              })}</div>
            </div>)}</div>
          </section>
          <div className="overview-grid impact-grid"><section><div className="section-line"><h2>Structure & changes</h2><span>{touches.length} {touches.length === 1 ? 'planned change' : 'planned changes'}</span></div><p className="text-small text-fg-muted mb-4">Planned changes and the services or dependencies used by this plan. Selecting a service includes its internals.</p><FeatureArchitecture feature={f} components={participants} allComponents={allComponents} href={componentHref} /></section><section><div className="section-line"><h2>Connected work</h2><span>{related.length} {related.length === 1 ? 'feature' : 'features'}</span></div><p className="text-small text-fg-muted mb-4">Active plans with overlapping changes to components or their internals.</p><div className="related-list">{related.map(o => <Link key={o.id} to={`/f/${o.id}`}><span>{o.title}<small>{o.touches.filter(t => changesOverlap({ touches: [t] }, f, allComponents)).map(t => q.componentLabel(t)).join(', ')}</small></span><StageBadge stage={o.stage} /></Link>)}{!related.length && <p className="text-small text-fg-muted">No active plans touch these components.</p>}</div></section></div>
        </div> : <section className="focused-section" key={`${id}-${target}`}>
          <div className="section-intro"><div><div className="eyebrow">{groups.find(g => g.sections.includes(target))?.label}</div><h2>{sectionMeta[target].label}</h2><p>{questions[target]}</p></div>{!['purpose', 'design', 'api', 'storage'].includes(target) && <label className="component-filter">{target === 'api' ? 'API component' : 'Component scope'}<select value={lens ? lensComponent!.id : ''} onChange={e => setParams(p => { const n = new URLSearchParams(p); if (e.target.value) n.set('component', e.target.value); else n.delete('component'); return n })}><option value="">All components</option><ComponentOptions components={participants} /></select></label>}</div>
          {lens && !['api', 'storage'].includes(target) && <div className="scope-banner"><Layers size={15} /><span>{['purpose', 'design'].includes(target) ? `Showing full ${sectionMeta[target].label.toLowerCase()}. Component scope applies to journey, system, and tests.` : `Showing ${q.componentLabel(lensComponent!.id)} and its internals. Dependencies remain separate scopes.`}</span><button onClick={() => setParams(p => { const n = new URLSearchParams(p); n.delete('component'); return n })}>Clear scope</button></div>}
          {spec[target] && Render ? <Render data={spec[target]} focus={item} /> : <div className="section-empty"><AlertCircle size={28} /><h3>{sectionMeta[target].label} has not been drafted</h3><p>{sectionMeta[target].blurb}</p><p className="text-small">Your AI assistant can populate this section from the feature intent and supporting context.</p>{populatedExample && <Link to={`/f/${populatedExample.id}/${target}`}>See {sectionMeta[target].label.toLowerCase()} in {populatedExample.title}<ArrowRight size={14} /></Link>}</div>}
          <footer className="section-footer"><Link to={currentIndex > 0 ? href(sectionKinds[currentIndex - 1]) : href()}><ArrowLeft size={14} />{currentIndex > 0 ? sectionMeta[sectionKinds[currentIndex - 1]].label : 'Overview'}</Link><Link to={next ? href(next) : href()}>{next ? sectionMeta[next].label : 'Back to overview'}<ArrowRight size={14} /></Link></footer>
        </section>}
      </div>
    </div>
  </SpecContext.Provider>
}
