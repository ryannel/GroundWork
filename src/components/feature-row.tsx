import { Link } from 'react-router-dom'
import type { Feature } from '@/data/model'
import { q, relTime } from '@/data/store'
import { StageBadge } from '@/ui/badge'
import { CircleDashed, Diamond, FileCheck2, Hammer, Lightbulb, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/cn'

export function FeatureRow({ feature, showProduct = true, showWorkspace = false, context: contextOverride, className }: { feature: Feature; showProduct?: boolean; showWorkspace?: boolean; context?: string; className?: string }) {
  const product = q.product(feature.productId)
  const workspace = product && q.workspace(product.workspaceId)
  const context = contextOverride ?? (showWorkspace ? [workspace?.name, product?.name].filter(Boolean).join(' / ') : showProduct ? product?.name : feature.summary)
  const Icon = { idea: Lightbulb, exploring: CircleDashed, designing: Diamond, specced: FileCheck2, building: Hammer, shipped: CheckCheck }[feature.stage]
  return <Link to={`/f/${feature.id}`} className={cn('feature-work-row', className)}>
    <span className="feature-work-title"><span className={`feature-stage-icon feature-stage-${feature.stage}`} aria-hidden="true"><Icon size={16} strokeWidth={1.7} /></span><span><strong>{feature.title}</strong>{context && <small>{context}</small>}</span></span>
    <StageBadge stage={feature.stage} />
    <span className="feature-work-owner"><span className="person-initials" aria-hidden="true">{feature.owner.split(' ').map(word => word[0]).join('')}</span>{feature.owner}</span>
    <time className="feature-work-updated" dateTime={feature.updatedAt} title={new Date(feature.updatedAt).toLocaleString()}>{relTime(feature.updatedAt)}</time>
  </Link>
}
