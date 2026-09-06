import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export const fieldBase =
  'w-full rounded-md surface px-3 text-body text-fg placeholder:text-fg-subtle transition-[border-color,box-shadow] duration-150 focus:outline-none focus:border-(--accent) focus:shadow-[0_0_0_3px_var(--accent-soft)] disabled:opacity-45'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leading?: ReactNode
  trailing?: ReactNode
}
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ leading, trailing, className, ...rest }, ref) {
  if (!leading && !trailing) return <input ref={ref} className={cn(fieldBase, 'h-9', className)} {...rest} />
  return (
    <div className={cn('relative flex items-center', className)}>
      {leading && <span className="pointer-events-none absolute left-3 text-fg-subtle [&_svg]:size-4">{leading}</span>}
      <input ref={ref} className={cn(fieldBase, 'h-9', leading && 'pl-9', trailing && 'pr-9')} {...rest} />
      {trailing && <span className="absolute right-2.5 text-fg-subtle [&_svg]:size-4">{trailing}</span>}
    </div>
  )
})
