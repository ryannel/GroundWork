import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CircleDashed, Diamond, FileCheck2, Hammer, Lightbulb, CheckCheck, GitFork, type LucideIcon } from 'lucide-react'
import { connectedProductIds } from '@/data/workspace-view'
import type { Feature } from '@shared/model'
import { relTime, useQuery } from '@/data/store'
import { StageBadge } from '@/ui/badge'
import { Avatar } from '@/ui/avatar'
import { cn } from '@/lib/cn'

const stageIcons = { idea: Lightbulb, exploring: CircleDashed, designing: Diamond, specced: FileCheck2, building: Hammer, shipped: CheckCheck }

export function FeatureRow({ feature, showProduct = true, showWorkspace = false, context: contextOverride, detail, className }: {
  feature: Feature
  showProduct?: boolean
  showWorkspace?: boolean
  context?: string
  detail?: ReactNode
  className?: string
}) {
  const q = useQuery()
  const product = q.product(feature.productId)
  const workspace = product && q.workspace(product.workspaceId)
  const context = contextOverride
    ?? (showWorkspace ? [workspace?.name, product?.name].filter(Boolean).join(' / ') : showProduct ? product?.name : feature.summary)
  const Icon = stageIcons[feature.stage]
  return <Link to={`/f/${feature.id}`} className={cn('feature-work-row', className)}>
    <span className="feature-work-title">
      <span className={`feature-stage-icon feature-stage-${feature.stage}`} aria-hidden="true"><Icon size={16} strokeWidth={1.7} /></span>
      <span><strong>{feature.title}</strong>{context && <small>{context}</small>}{detail}</span>
    </span>
    <StageBadge stage={feature.stage} />
    <span className="feature-work-owner"><Avatar name={feature.owner} className="person-initials" />{feature.owner}</span>
    <time className="feature-work-updated" dateTime={feature.updatedAt} title={new Date(feature.updatedAt).toLocaleString()}>{relTime(feature.updatedAt)}</time>
  </Link>
}

export interface WorkView<Id extends string = string> { id: Id; label: string; count: number; icon: LucideIcon }

/** Product relationships belong to the feature row, alongside its normal metadata. */
export function FeatureImpact({ feature, productId }: { feature: Feature; productId?: string }) {
  const q = useQuery()
  const otherProducts = connectedProductIds(feature, q.components(), q.products()).map(id => q.product(id)?.name).filter(Boolean)
  const incoming = productId && feature.productId !== productId
  if (!incoming && !otherProducts.length) return null
  return <span className="feature-impact"><GitFork size={12} aria-hidden="true" />
    {incoming ? `Owned by ${q.product(feature.productId)?.name ?? 'another product'}` : `Also affects ${otherProducts.join(', ')}`}
  </span>
}

export function FeatureRows({ rows, titleColumn, renderRow }: {
  rows: Feature[]
  titleColumn: string
  renderRow?: (feature: Feature) => ReactNode
}) {
  return <div className="board-feature-list">
    <div className="feature-list-labels" aria-hidden="true"><span>{titleColumn}</span><span>Stage</span><span>Owner</span><span>Updated</span></div>
    {rows.map(feature => renderRow ? renderRow(feature) : <FeatureRow key={feature.id} feature={feature} />)}
  </div>
}

/**
 * The feature list shared by the directory pages: view toggles, a context line with the result count,
 * then the rows or an empty state.
 */
export function FeatureWorkList<Id extends string>({ label, views, view, onView, summary, controls, titleColumn, rows, renderRow, empty }: {
  /** Accessible name of the view toggle group. */
  label: string
  views: WorkView<Id>[]
  view: Id
  onView: (id: Id) => void
  summary: ReactNode
  controls?: ReactNode
  titleColumn: string
  rows: Feature[]
  renderRow?: (feature: Feature) => ReactNode
  empty: ReactNode
}) {
  return <>
    <div className="work-list-toolbar">
    <div className="board-work-tabs" role="group" aria-label={label}>
      {views.map(item => <button key={item.id} aria-pressed={view === item.id} onClick={() => onView(item.id)}>
        <item.icon size={14} aria-hidden="true" />{item.label}<span>{item.count}</span>
      </button>)}
    </div>
    {controls}
    </div>
    <div className="board-list-context">
      {summary}
      <span aria-live="polite">{rows.length} {rows.length === 1 ? 'feature' : 'features'} · Latest updates first</span>
    </div>
    {rows.length ? <FeatureRows rows={rows} titleColumn={titleColumn} renderRow={renderRow} /> : empty}
  </>
}
