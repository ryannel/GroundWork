import { useMemo } from 'react'
import { followFlowLink, jobEntries, triggeredFlows } from '@/data/inspector-model'
import { CatalogBrowser } from '../catalog-browser'
import { ContextFlows } from './flows'
import { SourceEvidence } from './catalog-content'
import type { CatalogPanelProps } from './use-catalog-location'

export function JobsPanel({ component, dependencies, location, navigate, onSelectComponent }: CatalogPanelProps) {
  const jobs = component.jobs
  const entries = useMemo(() => jobEntries(jobs ?? []), [jobs])
  if (!jobs?.length) return null
  const renderDetail = (id: string) => {
    const job = jobs.find(item => item.id === id)!
    return <article className="catalog-record-detail">
      <header><h4>{job.name}</h4><p>{job.description}</p><p>{job.schedule ?? 'Schedule not documented'}</p></header>
      <SourceEvidence repository={component.repo} evidence={job.evidence} />
      <ContextFlows
        component={component}
        flows={triggeredFlows(component, 'job', job.id)}
        dependencies={dependencies}
        flowId={location.flow}
        onFlowChange={flow => navigate({ flow }, 'replace')}
        onNavigate={target => navigate(followFlowLink(target, { tab: 'jobs', id: job.id }))}
        onSelectComponent={onSelectComponent}
      />
    </article>
  }
  return <>
    <h4>Background jobs</h4>
    <CatalogBrowser urlKey="jobs" label="Jobs" groupLabel="Schedule" entries={entries} renderDetail={renderDetail} />
  </>
}
