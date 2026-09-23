import { cloneElement, useId, type ReactElement } from 'react'
import { cn } from '@/lib/cn'

/**
 * CSS-only tooltip that shows on hover and focus. The single child is described by the tooltip
 * through aria-describedby, so screen readers announce the label with it.
 */
export function Tooltip({ label, children, side = 'top', className }: {
  label: string
  children: ReactElement<{ 'aria-describedby'?: string }>
  side?: 'top' | 'bottom'
  className?: string
}) {
  const id = useId()
  return (
    <span className={cn('group/tt relative inline-flex', className)}>
      {cloneElement(children, { 'aria-describedby': id })}
      <span
        id={id}
        role="tooltip"
        className={cn(
          'pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-sm glass-3 px-2 py-1',
          'text-small text-fg opacity-0 transition-[opacity,transform] duration-150 ease-out',
          'group-hover/tt:opacity-100 group-focus-within/tt:opacity-100',
          side === 'top' ? 'bottom-full mb-2 translate-y-1 group-hover/tt:translate-y-0' : 'top-full mt-2 -translate-y-1 group-hover/tt:translate-y-0',
        )}
      >
        {label}
      </span>
    </span>
  )
}
