import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  variant?: 'glass' | 'ghost'
  size?: 'sm' | 'md'
}
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = 'ghost', size = 'md', className, ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-md text-fg-muted transition-colors duration-150 hover:text-fg disabled:opacity-45 disabled:pointer-events-none',
        variant === 'glass' ? 'surface hover:border-border-strong' : 'hover:bg-(--glass-fill-2)',
        size === 'sm' ? 'size-8 [&_svg]:size-4' : 'size-9 [&_svg]:size-4.5',
        className,
      )}
      {...rest}
    />
  )
})
