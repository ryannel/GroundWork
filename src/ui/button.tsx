import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leading?: ReactNode
  trailing?: ReactNode
}

const base = 'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap select-none rounded-md transition-[transform,background-color,border-color,box-shadow,opacity] duration-150 ease-out active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none motion-reduce:active:scale-100'
const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_6px_20px_-6px_var(--accent)] hover:brightness-110',
  secondary: 'surface text-fg hover:bg-(--glass-fill-2) hover:border-border-strong',
  ghost: 'text-fg-muted hover:text-fg hover:bg-(--glass-fill-2)',
  danger: 'bg-danger-bg text-danger border border-danger-border hover:bg-danger hover:text-white',
}
const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-small [&_svg]:size-3.5',
  md: 'h-9 px-3.5 text-body [&_svg]:size-4',
  lg: 'h-11 px-5 text-body [&_svg]:size-4.5',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, leading, trailing, className, children, disabled, ...rest }, ref,
) {
  return (
    <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 className="animate-spin" /> : leading}
      {children}
      {trailing}
    </button>
  )
})
