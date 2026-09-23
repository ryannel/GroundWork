import { ChevronDown, ExternalLink } from 'lucide-react'
import type { Component } from '@/data/model'
import { sourceEvidenceUrl } from '@/data/execution-flow'
import { catalogKnowledgeState, componentCoverage, scanStatusLabel } from '@/data/catalog-coverage'
import { emptyCatalogText, type RetiredObservation } from '@/data/inspector-model'

const coverageAreas = ['dependencies', 'api', 'data', 'messaging'] as const
const RAW_OBSERVATION_STYLE = { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } as const

export function SourceEvidence({ evidence, repository }: { evidence?: Component['evidence']; repository?: string }) {
  if (!evidence?.length) return null
  return <details className="catalog-notes">
    <summary>Source evidence · {evidence.length}<ChevronDown size={14} /></summary>
    <div>{evidence.map((source, index) => {
      const url = sourceEvidenceUrl(repository, source)
      return <article key={index}>
        <strong>{url
          ? <a href={url} target="_blank" rel="noreferrer">{source.path}:{source.lines}<ExternalLink size={12} /></a>
          : `${source.path}:${source.lines}`}</strong>
        <p>{source.claim}</p>
        <code>Revision {source.revision}</code>
      </article>
    })}</div>
  </details>
}

export function CatalogGaps({ gaps }: { gaps?: string[] }) {
  if (!gaps?.length) return null
  return <details className="catalog-notes">
    <summary>Known limitations · {gaps.length}<ChevronDown size={14} /></summary>
    <div>{gaps.map((gap, index) => <p key={index}>{gap}</p>)}</div>
  </details>
}

export function EmptyCatalog({ component, area, label }: { component: Component; area: 'api' | 'data' | 'messaging'; label: string }) {
  const { title, body } = emptyCatalogText(component, area, label)
  return <div className="catalog-no-results"><h4>{title}</h4><p>{body}</p></div>
}

export function RetiredRecords({ component, selection, onBrowseActive }: {
  component: Component; selection?: RetiredObservation; onBrowseActive: () => void
}) {
  const retired = component.retiredObservations ?? []
  if (!retired.length) return null
  return <details className="catalog-notes" open={!!selection || undefined}>
    <summary>Retired catalog records · {retired.length}<ChevronDown size={14} /></summary>
    <div>
      {(selection ? [selection] : retired).map(item => <article key={`${item.kind}/${item.id}`}>
        <h4>{String(item.observation.name ?? item.id)} · Retired {item.kind}</h4>
        <p>{item.reason}</p>
        <p>Retired at {item.sourceRevision.slice(0, 8)}. Original facts and citations are preserved below.</p>
        <SourceEvidence repository={component.repo} evidence={item.evidence} />
        <details><summary>Original observation</summary><pre style={RAW_OBSERVATION_STYLE}>{JSON.stringify(item.observation, null, 2)}</pre></details>
      </article>)}
      {selection && <button onClick={onBrowseActive}>Browse active records</button>}
    </div>
  </details>
}

/** A `finding` deep link opens this list on that finding; an id this component does not have shows them all. */
export function Findings({ component, findingId }: { component: Component; findingId?: string }) {
  const findings = component.findings ?? []
  if (!findings.length) return null
  const linked = findings.filter(finding => finding.id === findingId)
  return <details className="catalog-notes" open={!!linked.length || undefined}>
    <summary>Investigated questions · {findings.length}<ChevronDown size={14} /></summary>
    <div>{(linked.length ? linked : findings).map(finding => <article key={finding.id}>
      <h4>{finding.name}</h4>
      <p>{finding.question}</p>
      <p>{finding.answer}</p>
      <p><strong>Boundary:</strong> {finding.boundary}</p>
      <p>Observed at {finding.sourceRevision.slice(0, 8)} · Freshness unchecked</p>
      {finding.assumptions.map((assumption, index) => <p key={index}>Unresolved: {assumption}</p>)}
      <SourceEvidence repository={finding.repository} evidence={finding.evidence} />
    </article>)}</div>
  </details>
}

export function CoverageReport({ component }: { component: Component }) {
  const coverage = componentCoverage(component)
  const knowledge = catalogKnowledgeState(component)
  const unresolved = component.unresolvedDependencies ?? []
  const gaps = component.gaps ?? []
  const limitationCount = unresolved.length + gaps.length
  return <details className="catalog-notes catalog-scan-notes">
    <summary>
      <span>Catalog coverage<small>
        {scanStatusLabel(coverage.status)}
        {limitationCount ? ` · ${limitationCount} known ${limitationCount === 1 ? 'limitation' : 'limitations'}` : ''}
      </small></span>
      <ChevronDown size={16} />
    </summary>
    <div className="catalog-health-detail">
      <section className="catalog-health-overview">
        <div className="component-scan-coverage" aria-label="Repository scan coverage">{coverageAreas.map(area => {
          const state = coverage.area(area)
          return <span key={area} className={`is-${state}`}>
            {area === 'api' ? 'API' : area}<i>{state === 'complete' ? 'complete' : state === 'partial' ? 'partial' : 'unknown'}</i>
          </span>
        })}</div>
        <p>{knowledge.investigation.tracedEndpoints} of {knowledge.investigation.knownEndpoints} endpoint paths investigated · Freshness unchecked</p>
      </section>
      {!!limitationCount && <div className="catalog-findings">
        {!!unresolved.length && <section>
          <h4>Dependencies awaiting a catalog match</h4>
          <p>These references are recorded in source but are not linked to components in the map.</p>
          {unresolved.map((dependency, index) => <article key={index}>
            <strong>{dependency.name}</strong>
            <p>{[dependency.kind, dependency.transport].filter(Boolean).join(' · ')}</p>
            <SourceEvidence repository={component.repo} evidence={dependency.evidence} />
          </article>)}
        </section>}
        {!!gaps.length && <section>
          <h4>Known scan gaps</h4>
          {gaps.map((gap, index) => <article key={index}><strong>{gap.area}</strong><p>{gap.reason}</p></article>)}
        </section>}
      </div>}
    </div>
  </details>
}
