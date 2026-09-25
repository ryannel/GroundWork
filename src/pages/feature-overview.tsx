import type { Ref } from 'react'
import type { z } from 'zod'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Layers, AlertCircle } from 'lucide-react'
import type { Component, Feature } from '@/data/model'
import type { Delivery } from '@/data/delivery'
import type { RuntimePlan } from '@/data/runtime'
import type { FeatureSpec, SectionKind } from '@/data/spec'
import type { SpecIndex } from '@/data/spec-index'
import { useQuery, isActive } from '@/data/store'
import { changesOverlap } from '@/data/component-structure'
import { baselineAssessments, type discoveryAssessmentSchema, type knowledgeBaselineSchema } from '@/data/knowledge'
import { featureNextStep } from '@/data/view-models'
import { sectionMeta } from '@/components/spec'
import { ChangeMark } from '@/components/spec/change'
import { FeatureArchitecture } from '@/components/component-structure'
import { StageBadge } from '@/ui/badge'
import { Avatar } from '@/ui/avatar'
import { cn } from '@/lib/cn'

export type SectionHref = (section?: SectionKind | 'delivery') => string
export interface SectionGroup { label: string; sections: SectionKind[] }
export type Baseline = { file: string; packet: z.infer<typeof knowledgeBaselineSchema> }
export type Assessment = z.infer<typeof discoveryAssessmentSchema>

function DeliveryCallout({ featureId, delivery }: { featureId: string; delivery?: Delivery }) {
  return <Link className="feature-delivery-callout" to={`/f/${featureId}/delivery`}>
    <div>
      <strong>Delivery plan</strong>
      <p>{delivery?.deliverables.length
        ? `${delivery.deliverables.length} deliverables · ${delivery.tasks.length} component tasks · ${delivery.validation.length} validation plans`
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

function DiscoveryChecks({ assessments }: { assessments: Assessment[] }) {
  return <section className="explore-section">
    <h2>Discovery checks</h2>
    <p>Checks preserve the baseline; they do not declare the feature ready to build. Recheck when the intended source target changes.</p>
    {assessments.map(check => <details className="catalog-notes" key={check.checkedAt}>
      <summary>{check.reassessmentRequired ? 'Reassessment needed' : 'No change requiring review detected'} · {check.checkedAt}</summary>
      <div>
        {check.observations.map(observation => <p key={observation.id}>
          {observation.id}: catalog {observation.catalogState}; source {observation.sourceFreshness}
        </p>)}
        <p>{check.note}</p>
        {check.checks.map((source, index) => <p key={index}>
          {String(source.repository)} · target {String(source.targetRevision ?? 'unavailable')} · {String(source.requestedTarget)}
        </p>)}
      </div>
    </details>)}
  </section>
}

function DiscoveryBaselines({ baselines, plan }: { baselines: Baseline[]; plan: RuntimePlan }) {
  const changed = (packet: Baseline['packet']) =>
    baselineAssessments(packet, plan.snapshot.components, plan.identity).some(item => item.catalogState !== 'unchanged')
  return <section className="explore-section">
    <h2>Discovery baselines</h2>
    <p>Facts retained when this plan was prepared. Catalog changes are compared below; source checks apply only to their recorded target and time.</p>
    {baselines.map(({ file, packet }) => <details className="catalog-notes" key={file}>
      <summary>{packet.question} · {packet.observations.length} observations</summary>
      <div>
        <p>{changed(packet)
          ? 'Reassessment needed: retained catalog facts have changed or been removed.'
          : 'No catalog changes detected for these retained facts. Source behavior is not verified.'}</p>
        <p>Captured {packet.capturedAt} · Catalog {packet.catalogRevision.slice(0, 8)}</p>
        {packet.assumptions.map((assumption, index) => <p key={index}>Assumption: {assumption}</p>)}
        {packet.observations.map(observation => <article key={observation.id}>
          <h4>{observation.name}</h4>
          <p>{observation.repository} · {observation.sourceRevision?.slice(0, 8)}</p>
          <details>
            <summary>Retained facts and evidence</summary>
            <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(observation.observation, null, 2)}</pre>
          </details>
        </article>)}
      </div>
    </details>)}
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
  return <section>
    <div className="section-line"><h2>Connected work</h2><span>{related.length} {related.length === 1 ? 'feature' : 'features'}</span></div>
    <p className="text-small text-fg-muted mb-4">Active plans with overlapping changes to components or their internals.</p>
    <div className="related-list">
      {related.map(o => <Link key={o.id} to={`/f/${o.id}`}>
        <span>{o.title}<small>
          {o.touches.filter(t => changesOverlap({ touches: [t] }, feature, allComponents)).map(t => q.componentLabel(t)).join(', ')}
        </small></span>
        <StageBadge stage={o.stage} />
      </Link>)}
      {!related.length && <p className="text-small text-fg-muted">No active plans touch these components.</p>}
    </div>
  </section>
}

export function FeatureOverview({ feature, spec, ix, groups, href, componentHref, participants, allComponents, delivery, plan, baselines, assessments }: {
  feature: Feature
  spec: FeatureSpec
  ix: SpecIndex
  groups: SectionGroup[]
  href: SectionHref
  componentHref: (componentId: string) => string
  participants: Component[]
  allComponents: Component[]
  delivery?: Delivery
  plan: RuntimePlan | null
  baselines: Baseline[]
  assessments: Assessment[]
}) {
  const q = useQuery()
  const touches = feature.touches.filter(id => q.component(id)).length
  return <div className="workbench-overview">
    <DeliveryCallout featureId={feature.id} delivery={delivery} />
    <div className="feature-intent-grid">
      <FeatureIntent feature={feature} spec={spec} href={href} />
      <NextStepPanel spec={spec} ix={ix} href={href} />
    </div>
    {spec.api && <ApiChangeSummary api={spec.api} href={href} />}
    {!!assessments.length && <DiscoveryChecks assessments={assessments} />}
    {!!baselines.length && plan && <DiscoveryBaselines baselines={baselines} plan={plan} />}
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
export function OverviewHeader({ feature, headingRef, updated, journeyLink }: {
  feature: Feature
  headingRef: Ref<HTMLHeadingElement>
  updated: string
  journeyLink?: { to: string; label: string }
}) {
  return <header className="feature-overview-header">
    <div className="feature-overview-kicker">
      <span className="feature-id">{feature.id.toUpperCase()}</span><span>Feature plan</span><StageBadge stage={feature.stage} />
    </div>
    <h1 ref={headingRef} tabIndex={-1}>{feature.title}</h1>
    <div className="feature-overview-byline">
      <Avatar name={feature.owner} className="owner-avatar" /><span>{feature.owner}</span><span className="byline-divider" />
      <time dateTime={feature.updatedAt} title={new Date(feature.updatedAt).toLocaleString()}>Updated {updated}</time>
      {journeyLink && <Link className="primary-link" to={journeyLink.to}>{journeyLink.label}<ArrowRight size={15} /></Link>}
    </div>
  </header>
}
