import { useId, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/cn'

export interface TabItem { value: string; label: ReactNode; count?: number }
export function Tabs({ items, value, onChange, className }: { items: TabItem[]; value?: string; onChange?: (v: string) => void; className?: string }) {
  const [inner, setInner] = useState(items[0]?.value)
  const current = value ?? inner
  const layoutId = useId()
  const set = (v: string) => { setInner(v); onChange?.(v) }
  return (
    <div role="tablist" className={cn('inline-flex items-center gap-1 rounded-md surface p-1', className)}>
      {items.map(it => {
        const active = it.value === current
        return (
          <button
            key={it.value}
            role="tab"
            aria-selected={active}
            onClick={() => set(it.value)}
            className={cn('relative h-7 rounded-sm px-3 text-small font-medium whitespace-nowrap transition-colors', active ? 'text-fg' : 'text-fg-muted hover:text-fg')}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-sm bg-(--glass-fill-3) border border-border shadow-[inset_0_1px_0_var(--glass-highlight)]"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {it.label}
              {it.count !== undefined && <span className="rounded-full bg-(--glass-fill-3) px-1.5 text-[11px] text-fg-subtle">{it.count}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
