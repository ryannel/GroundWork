import type { Ref } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Layers, AlertCircle } from 'lucide-react'
import type { Component, Feature } from '@shared/model'
import type { Delivery } from '@shared/delivery'
import type { FeatureSpec, SectionKind } from '@shared/spec'
import type { SpecIndex } from '@shared/spec-index'
import { useQuery, isActive } from '@/data/store'
import { changesOverlap } from '@shared/component-structure'
import { featureNextStep } from '@shared/view-models'
import { sectionMeta } from '@/components/spec'
import { ChangeMark } from '@/components/spec/change'
import { FeatureArchitecture } from '@/components/component-structure'
import { FeatureRow, FeatureRows } from '@/components/feature-row'
import { StageBadge } from '@/ui/badge'
import { Avatar } from '@/ui/avatar'
import { cn } from '@/lib/cn'

export type SectionHref = (section?: SectionKind | 'delivery') => string
export interface SectionGroup { label: string; sections: SectionKind[] }

function DeliveryCallout({ featureId, delivery }: { featureId: string; delivery?: Delivery }) {
  return <Link className="feature-delivery-callout" to={`/f/${featureId}/delivery`}>
    <div>
      <strong>Delivery plan</strong>
      <p>{delivery?.deliverables.length
        ? `${delivery.deliverables.length} ${delivery.deliverables.length === 1 ? 'deliverable' : 'deliverables'} · `
          + `${delivery.tasks.length} component ${delivery.tasks.length === 1 ? 'task' : 'tasks'} · `
          + `${delivery.validation.length} validation ${delivery.validation.length === 1 ? 'plan' : 'plans'}`
        : 'Divide the feature into user-visible deliverables and component tasks.'}</p>
    </div>
    <ArrowRight size={20} />
  </Link>
}

function FeatureIntent({ feature, spec, href }: { feature: Feature; spec: FeatureSpec; href: SectionHref }) {
  return <section className="feature-intent-panel" aria-labelledby="feature-intent-heading">
    <h2 id="feature-intent-heading">{spec.purpose?.outcome ? 'Intended outcome' : 'Feature intent'}</h2>
    <p>{spec.purpose?.outcome ?? feature.summary ?? 'Describe what should become better for the user and why it matters.'}</p>
    {spec.purpose && <Link to={href('purpose')}>Brief & success criteria<ArrowRight size={14} /></Link>}
  </section>
}

function NextStepPanel({ spec, ix, href }: { spec: FeatureSpec; ix: SpecIndex; href: SectionHref }) {
  const next = featureNextStep(spec, ix)
  return <section className={cn('feature-next-panel', next.gaps > 0 && 'has-review-gaps')} aria-labelledby="feature-next-heading">
    <div className="feature-next-label">
      {next.gaps ? <AlertCircle size={15} /> : <Layers size={15} />}
      <span>{next.gaps ? 'Needs evidence' : 'Next step'}</span>
    </div>
    <h2 id="feature-next-heading">{next.heading}</h2>
    <p>{next.body}</p>
    <Link to={href(next.section)}>{next.linkLabel}<ArrowRight size={14} /></Link>
    {next.cases > 0 && <div className="feature-test-evidence">
      <CheckCircle2 size={14} /><span><strong>{next.passing} / {next.cases}</strong> tests marked passing</span>
    </div>}
  </section>
}

function ApiChangeSummary({ api, href }: { api: NonNullable<FeatureSpec['api']>; href: SectionHref }) {
  const count = (change: string) => api.contracts.filter(c => c.change === change).length
  const shown = (['added', 'updated', 'removed', 'unspecified'] as const).filter(change => change !== 'unspecified' || count(change) > 0)
  return <section className="overview-change-summary">
    <h2>API contract changes</h2>
    {shown.map(change => <span key={change}><ChangeMark change={change} /> {count(change)}</span>)}
    <Link to={href('api')}>Inspect contracts & fields <ArrowRight size={14} /></Link>
  </section>
}

function PlanIndex({ spec, groups, href }: { spec: FeatureSpec; groups: SectionGroup[]; href: SectionHref }) {
  const drafted = groups.flatMap(g => g.sections).filter(k => spec[k]).length
  const total = groups.flatMap(g => g.sections).length
  return <section className="explore-section">
    <div className="section-line"><h2>Plan contents</h2><span>{drafted} / {total} sections drafted</span></div>
    <div className="plan-index">{groups.map((group, i) => <div className="plan-index-row" key={group.label}>
      <h3 className="plan-index-group"><span className="plan-number" aria-hidden="true">0{i + 1}</span>{group.label}</h3>
      <div className="plan-index-links">{group.sections.map((k, j) => {
        const Icon = sectionMeta[k].icon
        return <span className="plan-index-item" key={k}>
          {j > 0 && <ArrowRight size={13} aria-hidden="true" className="plan-index-arrow" />}
          <Link to={href(k)}>
            <Icon className="size-3.5" aria-hidden="true" />
            <span>{sectionMeta[k].label}</span>
            <small className={spec[k] ? 'is-drafted' : ''}>{spec[k] ? 'Drafted' : 'Not drafted'}</small>
          </Link>
        </span>
      })}</div>
    </div>)}</div>
  </section>
}

function ConnectedWork({ feature, allComponents }: { feature: Feature; allComponents: Component[] }) {
  const q = useQuery()
  const related = q.features().filter(o => o.id !== feature.id && isActive(o) && changesOverlap(feature, o, allComponents))
  return <section className="connected-work">
    <div className="section-line"><h2>Connected work</h2><span>{related.length} {related.length === 1 ? 'feature' : 'features'}</span></div>
    <p className="text-small text-fg-muted mb-4">Active plans with overlapping changes to components or their internals.</p>
    <div>
      {!!related.length && <FeatureRows
        rows={related}
        titleColumn="Feature / shared components"
        renderRow={other => <FeatureRow
          key={other.id}
          feature={other}
          context={other.touches.filter(t => changesOverlap({ touches: [t] }, feature, allComponents)).map(t => q.componentLabel(t)).join(', ')}
        />}
      />}
      {!related.length && <p className="text-small text-fg-muted">No active plans touch these components.</p>}
    </div>
  </section>
}

export function FeatureOverview({ feature, spec, ix, groups, href, componentHref, participants, allComponents, delivery }: {
  feature: Feature
  spec: FeatureSpec
  ix: SpecIndex
  groups: SectionGroup[]
  href: SectionHref
  componentHref: (componentId: string) => string
  participants: Component[]
  allComponents: Component[]
  delivery?: Delivery
}) {
  const q = useQuery()
  const touches = feature.touches.filter(id => q.component(id)).length
  return <div className="workbench-overview">
    <div className="feature-intent-grid">
      <FeatureIntent feature={feature} spec={spec} href={href} />
      <NextStepPanel spec={spec} ix={ix} href={href} />
    </div>
    <DeliveryCallout featureId={feature.id} delivery={delivery} />
    {spec.api && <ApiChangeSummary api={spec.api} href={href} />}
    <PlanIndex spec={spec} groups={groups} href={href} />
    <div className="overview-grid impact-grid">
      <section>
        <div className="section-line"><h2>Structure & changes</h2><span>{touches} {touches === 1 ? 'planned change' : 'planned changes'}</span></div>
        <p className="text-small text-fg-muted mb-4">
          Planned changes and the services or dependencies used by this plan. Selecting a service includes its internals.
        </p>
        <FeatureArchitecture feature={feature} components={participants} allComponents={allComponents} href={componentHref} />
      </section>
      <ConnectedWork feature={feature} allComponents={allComponents} />
    </div>
  </div>
}

/** Overview title block; the heading takes focus when the overview opens. */
export function OverviewHeader({ feature, headingRef, updated }: {
  feature: Feature
  headingRef: Ref<HTMLHeadingElement>
  updated: string
}) {
  return <header className="feature-overview-header">
    <div className="feature-overview-kicker">
      <span className="feature-id">{feature.id.toUpperCase()}</span><span>Feature plan</span><StageBadge stage={feature.stage} />
    </div>
    <h1 ref={headingRef} tabIndex={-1}>{feature.title}</h1>
    <div className="feature-overview-byline">
      <Avatar name={feature.owner} className="owner-avatar" /><span>{feature.owner}</span><span className="byline-divider" />
      <time dateTime={feature.updatedAt} title={new Date(feature.updatedAt).toLocaleString()}>Updated {updated}</time>
    </div>
  </header>
}
