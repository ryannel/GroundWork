import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Clock3 } from 'lucide-react'
import type { Feature } from '@/data/model'
import type { FeatureStage } from '@/lib/taxonomy'
import { q, relTime, STALE_DAYS } from '@/data/store'
import { stages, hueStyle } from '@/lib/taxonomy'
import { FeatureRow } from './feature-row'
import { Glass } from '@/ui/glass'
import { EmptyState } from '@/ui/empty-state'

export function SectionHead({ title, meta, actions }: { title: string; meta?: string; actions?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-2">
      <h2 className="text-h2 font-medium tracking-[var(--text-h2--letter-spacing)] whitespace-nowrap">{title}</h2>
      {meta && <span className="text-small text-fg-subtle whitespace-nowrap">{meta}</span>}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  )
}

/** In-flight features grouped by stage, with the cold legend. */
export function StageGroups({ groups, cold, showProduct = true }: { groups: { stage: FeatureStage; features: Feature[] }[]; cold: number; showProduct?: boolean }) {
  if (!groups.length) return <EmptyState title="Nothing in flight" description="Promote an idea to Exploring to see it here." />
  return (
    <>
      <div className="flex flex-col gap-6">
        {groups.map(g => (
          <div key={g.stage}>
            <div className="mb-2 flex items-center gap-2 text-small" style={hueStyle(stages[g.stage].hueVar)}>
              <span className="size-1.5 rounded-full hue-dot" />
              <span className="font-medium">{stages[g.stage].label}</span>
              <span className="text-fg-subtle">{g.features.length}</span>
            </div>
            <div className="grid gap-2">{g.features.map(f => <FeatureRow key={f.id} feature={f} showProduct={showProduct} />)}</div>
          </div>
        ))}
      </div>
      {cold > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-small text-fg-subtle">
          <Clock3 className="size-3.5" /> {cold} active {cold === 1 ? 'feature has' : 'features have'} not been updated in {STALE_DAYS}+ days.
        </p>
      )}
    </>
  )
}

export function IdeaList({ ideas, showProduct = true }: { ideas: Feature[]; showProduct?: boolean }) {
  if (!ideas.length) return <p className="text-small text-fg-subtle">No ideas parked.</p>
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {ideas.map(f => (
        <Glass key={f.id} interactive radius="md" className="flex items-center gap-3 px-4 py-3">
          <Link to={`/f/${f.id}`} className="min-w-0 flex-1">
            <div className="truncate font-medium">{f.title}</div>
            <div className="truncate text-small text-fg-muted">{showProduct && <>{q.product(f.productId)?.name} · </>}{relTime(f.updatedAt)}</div>
          </Link>
          <Link to={`/f/${f.id}`} aria-label={`Open ${f.title}`} className="flex items-center gap-1 text-small text-accent">Open <ArrowUpRight size={14} /></Link>
        </Glass>
      ))}
    </div>
  )
}

export function ShippedList({ shipped, showProduct = true }: { shipped: Feature[]; showProduct?: boolean }) {
  return (
    <Glass radius="md" className="divide-y divide-border">
      {shipped.map(f => (
        <Link key={f.id} to={`/f/${f.id}`} className="flex items-center gap-3 px-4 py-2.5 text-small transition-colors hover:bg-(--glass-fill-2)">
          <span className="min-w-0 flex-1 truncate">{f.title}</span>
          {showProduct && <span className="text-fg-subtle">{q.product(f.productId)?.name}</span>}
          <span className="w-14 text-right text-fg-subtle">{relTime(f.updatedAt)}</span>
        </Link>
      ))}
    </Glass>
  )
}
