import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useRuntime } from '@/data/runtime'
import { productRoute } from '@shared/view-models'

interface BreadcrumbsProps {
  workspace?: { name: string; slug: string }
  product?: { name: string; slug: string }
  current?: { label: string; name: string }
  className?: string
}

export function Breadcrumbs({ workspace, product, current, className = '' }: BreadcrumbsProps) {
  const { mode, plan, projects } = useRuntime()
  // Repository-local workspaces are not the Hub's workspace grouping.
  const hubWorkspace = mode === 'central' && product
    ? projects.find(project => project.checkoutId === plan?.context.checkoutId)?.workspace
    : undefined
  const currentIsHierarchyItem = current?.label === 'Workspace' || current?.label === 'Product'
  return <nav aria-label="Breadcrumb" className={`breadcrumbs ${className}`.trim()}>
    {mode === 'central'
      ? <a href="/" className="breadcrumb-link">Workspaces</a>
      : <Link to="/" className="breadcrumb-link">Workspaces</Link>}
    {workspace && <>
      <ChevronRight aria-hidden="true" />
      {hubWorkspace
        ? <a href={`/?${new URLSearchParams({ workspace: hubWorkspace })}`} className="breadcrumb-entity">{hubWorkspace}</a>
        : current?.label === 'Workspace'
        ? <span className="breadcrumb-entity" aria-current="page">{workspace.name}</span>
        : <Link to={`/w/${workspace.slug}`} className="breadcrumb-entity">{workspace.name}</Link>}
    </>}
    {product && <>
      <ChevronRight aria-hidden="true" />
      {current?.label === 'Product'
        ? <span className="breadcrumb-entity" aria-current="page">{product.name}</span>
        : <Link to={workspace ? `/w/${workspace.slug}/${product.slug}`
          : plan?.identity.repository?.id ? productRoute(plan.identity.repository.id, product.slug) : '/'}
          className="breadcrumb-entity">{product.name}</Link>}
    </>}
    {current && !currentIsHierarchyItem && <>
      <ChevronRight aria-hidden="true" />
      <span className="breadcrumb-entity" aria-current="page"><small>{current.label}</small>{current.name}</span>
    </>}
  </nav>
}
