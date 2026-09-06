import { cn } from '@/lib/cn'
import { hueStyle } from '@/lib/taxonomy'

export interface AvatarProps { name: string; src?: string; size?: 'sm' | 'md' | 'lg'; hue?: string; className?: string }
const sizes = { sm: 'size-6 text-[10px]', md: 'size-8 text-xs', lg: 'size-10 text-sm' }
export function Avatar({ name, src, size = 'md', hue, className }: AvatarProps) {
  const initials = name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border font-medium', hue ? 'hue-bg hue-fg' : 'bg-(--glass-fill-2) text-fg-muted', sizes[size], className)}
      style={hue ? hueStyle(hue) : undefined}
      title={name}
    >
      {src ? <img src={src} alt={name} className="size-full object-cover" /> : initials}
    </span>
  )
}
