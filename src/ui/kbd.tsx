import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
export function Kbd({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <kbd className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-[6px] border border-border-strong bg-(--glass-fill-2) px-1.5 font-mono text-[11px] font-medium text-fg-muted shadow-[inset_0_-1px_0_var(--border)]', className)} {...rest} />
}
