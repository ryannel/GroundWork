import { ChevronDown, ExternalLink } from 'lucide-react'
import type { Component } from '@shared/model'
import { sourceEvidenceUrl } from '@shared/execution-flow'
import { emptyCatalogText } from '@/data/inspector-model'

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
