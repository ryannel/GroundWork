import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { kinds, stages, hueStyle, type ProductKind, type FeatureStage } from '@/lib/taxonomy'

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  /** Set an identity hue (CSS value like var(--kind-cli)); overrides tone. */
  hue?: string
  dot?: boolean
  leading?: ReactNode
}
const tones: Record<Tone, string> = {
  neutral: 'bg-(--glass-fill-2) text-fg-muted border-border',
  accent: 'bg-accent-soft text-accent border-(--accent-soft)',
  success: 'bg-success-bg text-success border-success-border',
  warning: 'bg-warning-bg text-warning border-warning-border',
  danger: 'bg-danger-bg text-danger border-danger-border',
  info: 'bg-info-bg text-info border-info-border',
}

export function Badge({ tone = 'neutral', hue, dot, leading, className, style, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-small font-medium leading-none whitespace-nowrap [&_svg]:size-3.5',
        hue ? 'hue-bg hue-fg hue-border' : tones[tone],
        className,
      )}
      style={hue ? { ...hueStyle(hue), ...style } : style}
      {...rest}
    >
      {dot && <span className={cn('size-1.5 rounded-full', hue ? 'bg-current' : 'bg-current')} />}
      {leading}
      {children}
    </span>
  )
}

export function KindBadge({ kind, className }: { kind: ProductKind; className?: string }) {
  const k = kinds[kind]
  return <Badge hue={k.hueVar} leading={<k.icon />} className={className}>{k.label}</Badge>
}
export function StageBadge({ stage, className }: { stage: FeatureStage; className?: string }) {
  return <Badge hue={stages[stage].hueVar} dot className={className}>{stages[stage].label}</Badge>
}
