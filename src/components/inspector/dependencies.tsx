import { ArrowRight, ChevronDown } from 'lucide-react'
import type { Component } from '@/data/model'
import { componentKind } from '@/data/component-structure'
import { dependencyContextLabel } from '@/data/inspector-model'
import { ComponentKindIcon } from '../component-kind-icon'
import { DataCatalog } from './data-catalog'

function DependencyEntry({ dependency, showData = false, onSelect }: { dependency: Component; showData?: boolean; onSelect?: (id: string) => void }) {
  const content = <>
    <span className="component-repository-icon"><ComponentKindIcon kind={componentKind(dependency)} size={15} /></span>
    <span><small>{dependencyContextLabel(dependency)}</small><strong>{dependency.name}</strong></span>
    {showData && <ChevronDown size={13} />}
  </>
  return showData
    ? <details className="component-infrastructure-entry"><summary>{content}</summary><DataCatalog component={dependency} compact /></details>
    : <button className="component-dependency-entry" onClick={() => onSelect?.(dependency.id)}>{content}<ArrowRight size={13} /></button>
}

export function DependencyGroup({ title, description, dependencies, showData = false, onSelect }: {
  title: string; description: string; dependencies: Component[]; showData?: boolean; onSelect?: (id: string) => void
}) {
  if (!dependencies.length) return null
  return <section className="component-dependency-group">
    <header><div><h5>{title}</h5><p>{description}</p></div><span>{dependencies.length}</span></header>
    <div>{dependencies.map(dependency => <DependencyEntry key={dependency.id} dependency={dependency} showData={showData} onSelect={onSelect} />)}</div>
  </section>
}

/** Linked infrastructure below a catalog panel, each with its own compact catalog. */
export function LinkedInfrastructure({ summary, title, description, dependencies }: {
  summary: string; title: string; description: string; dependencies: Component[]
}) {
  if (!dependencies.length) return null
  return <details className="catalog-notes">
    <summary>{summary} · {dependencies.length}<ChevronDown size={14} /></summary>
    <DependencyGroup title={title} description={description} dependencies={dependencies} showData />
  </details>
}
