import { useMemo } from 'react'
import type { Component } from '@shared/model'
import { recordEntries } from '@/data/inspector-model'
import { CatalogBrowser } from '../catalog-browser'
import { RecordFields } from './schema-explorer'
import { CatalogGaps, SourceEvidence } from './provenance'

/** A component's records. The full catalog keeps its state in the URL; a compact one embedded in a dependency does not. */
export function DataCatalog({ component, compact = false }: { component: Component; compact?: boolean }) {
  const data = component.data
  const entries = useMemo(() => recordEntries(data?.records ?? []), [data])
  if (!data) return <p className="component-data-gap">No data schema has been observed.</p>
  const renderDetail = (id: string) => {
    const record = data.records.find(item => item.id === id)!
    return <article className="catalog-record-detail">
      <header><span>{record.kind}</span><h4>{record.name}</h4></header>
      {record.description && <p>{record.description}</p>}
      <dl>
        <div><dt>Key / location</dt><dd><code>{record.keyPattern ?? 'Not documented'}</code></dd></div>
        <div><dt>Retention</dt><dd>{record.ttl ?? 'Not documented'}</dd></div>
      </dl>
      <RecordFields fields={record.fields} />
      <SourceEvidence repository={component.repo} evidence={record.evidence} />
    </article>
  }
  return <div className={`catalog-data${compact ? ' is-compact' : ''}`}>
    <div className="catalog-context">{data.technology && <span>{data.technology}</span>}{data.access?.map(mode => <span key={mode}>{mode}</span>)}</div>
    <CatalogBrowser urlKey={compact ? undefined : 'data'} label="Data records" groupLabel="Kinds" entries={entries} renderDetail={renderDetail} />
    <CatalogGaps gaps={data.gaps} />
  </div>
}
