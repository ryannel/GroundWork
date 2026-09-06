import type { Change } from '@/data/spec'
import { cn } from '@/lib/cn'

import { changeMeta } from './change-meta'

/** Text and glyph accompany row colour so changes do not depend on colour perception. */
export function ChangeMark({ change, className }: { change: Change; className?: string }) {
  const m = changeMeta[change]
  return <span className={cn("change-label", `change-${change}`, className)}><span aria-hidden="true">{m.glyph || '·'}</span>{m.label}</span>
}
