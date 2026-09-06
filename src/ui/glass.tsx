import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export type GlassLevel = 1 | 2 | 3
export interface GlassProps extends HTMLAttributes<HTMLDivElement> {
  level?: GlassLevel
  interactive?: boolean
  radius?: 'sm' | 'md' | 'lg' | 'xl'
}
const radii = { sm: 'rounded-sm', md: 'rounded-md', lg: 'rounded-lg', xl: 'rounded-xl' }

export const Glass = forwardRef<HTMLDivElement, GlassProps>(function Glass(
  { level = 1, interactive, radius = 'lg', className, ...rest }, ref,
) {
  return (
    <div ref={ref} className={cn(`glass-${level}`, radii[radius], interactive && 'glass-interactive', className)} {...rest} />
  )
})
