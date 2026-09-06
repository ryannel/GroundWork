import { cn } from '@/lib/cn'
import { stageList, stages, stageIndex, hueStyle, type FeatureStage } from '@/lib/taxonomy'

export function Progress({ value, hue, className }: { value: number; hue?: string; className?: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-(--glass-fill-2) border border-border', className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out-quart)]', hue ? 'bg-[hsl(var(--hue))]' : 'bg-accent')} style={{ width: `${v}%`, ...(hue ? hueStyle(hue) : {}) }} />
    </div>
  )
}

/** Segmented lifecycle indicator: one segment per stage, filled up to the current one. */
export function StageProgress({ stage, className }: { stage: FeatureStage; className?: string }) {
  const idx = stageIndex(stage)
  return (
    <div className={cn('flex gap-1', className)} aria-label={`Stage: ${stages[stage].label}`}>
      {stageList.map((s, i) => (
        <span
          key={s}
          title={stages[s].label}
          className={cn('h-1.5 flex-1 rounded-full transition-colors', i <= idx ? 'bg-[hsl(var(--hue))]' : 'bg-(--glass-fill-2) border border-border')}
          style={i <= idx ? hueStyle(stages[stage].hueVar) : undefined}
        />
      ))}
    </div>
  )
}
