import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Glass, type GlassProps } from './glass'

export function Card({ className, ...rest }: GlassProps) {
  return <Glass className={cn('flex flex-col', className)} {...rest} />
}
export function CardHeader({ title, description, actions, eyebrow, className, ...rest }: HTMLAttributes<HTMLDivElement> & { title?: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5', className)} {...rest}>
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        {title && <h3 className="text-h2 font-medium tracking-[var(--text-h2--letter-spacing)] [[data-skin=grain]_&]:font-display [[data-skin=grain]_&]:text-[24px]">{title}</h3>}
        {description && <p className="mt-1 text-small text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-5', className)} {...rest} />
}
export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-auto flex items-center gap-3 border-t border-border px-5 py-3 text-small text-fg-muted', className)} {...rest} />
}
