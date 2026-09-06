import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border-strong px-6 py-12 text-center', className)}>
      {icon && <div className="flex size-11 items-center justify-center rounded-md glass-2 text-fg-muted [&_svg]:size-5">{icon}</div>}
      <div>
        <div className="font-medium">{title}</div>
        {description && <div className="mt-1 max-w-sm text-small text-fg-muted">{description}</div>}
      </div>
      {action}
    </div>
  )
}
