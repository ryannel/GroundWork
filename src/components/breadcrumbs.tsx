import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useRuntime } from '@/data/runtime'

interface BreadcrumbsProps {
  workspace?: { name: string; slug: string }
  product?: { name: string; slug: string }
  current?: { label: string; name: string }
  className?: string
}

export function Breadcrumbs({ workspace, product, current, className = '' }: BreadcrumbsProps) {
  const { mode } = useRuntime()
  const currentIsHierarchyItem = current?.label === 'Workspace' || current?.label === 'Product'
  return <nav aria-label="Breadcrumb" className={`breadcrumbs ${className}`.trim()}>
    {mode === 'central'
      ? <a href="/" className="breadcrumb-link">Workspaces</a>
      : <Link to="/" className="breadcrumb-link">Workspaces</Link>}
    {workspace && <>
      <ChevronRight aria-hidden="true" />
      {current?.label === 'Workspace'
        ? <span className="breadcrumb-entity" aria-current="page">{workspace.name}</span>
        : <Link to={`/w/${workspace.slug}`} className="breadcrumb-entity">{workspace.name}</Link>}
    </>}
    {product && workspace && <>
      <ChevronRight aria-hidden="true" />
      {current?.label === 'Product'
        ? <span className="breadcrumb-entity" aria-current="page">{product.name}</span>
        : <Link to={`/w/${workspace.slug}/${product.slug}`} className="breadcrumb-entity">{product.name}</Link>}
    </>}
    {current && !currentIsHierarchyItem && <>
      <ChevronRight aria-hidden="true" />
      <span className="breadcrumb-entity" aria-current="page"><small>{current.label}</small>{current.name}</span>
    </>}
  </nav>
}
