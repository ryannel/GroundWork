import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Stat({ label, value, delta, hint, icon, className }: { label: ReactNode; value: ReactNode; delta?: number; hint?: ReactNode; icon?: ReactNode; className?: string }) {
  const tone = delta === undefined ? '' : delta > 0 ? 'text-success' : delta < 0 ? 'text-danger' : 'text-fg-subtle'
  const Icon = delta === undefined ? null : delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">{label}</span>
        {icon && <span className="text-fg-subtle [&_svg]:size-4">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-h1 font-medium tracking-[var(--text-h1--letter-spacing)]">{value}</span>
        {Icon && <span className={cn('inline-flex items-center gap-0.5 text-small font-medium', tone)}><Icon className="size-3.5" />{Math.abs(delta!)}%</span>}
      </div>
      {hint && <span className="text-small text-fg-subtle">{hint}</span>}
    </div>
  )
}
