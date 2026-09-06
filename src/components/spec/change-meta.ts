import type { Change } from '@/data/spec'

export const changeMeta: Record<Change, { label: string; color: string; glyph: string }> = {
  added: { label: 'Added', color: 'text-success', glyph: '+' },
  updated: { label: 'Changed', color: 'text-info', glyph: '~' },
  removed: { label: 'Removed', color: 'text-danger', glyph: '−' },
  unchanged: { label: 'Unchanged', color: 'text-fg-subtle', glyph: '' },
  unspecified: { label: 'Not assessed', color: 'text-fg-subtle', glyph: '?' },
}

/** Summary line like "3 added · 1 updated · 1 removed". */
export function changeSummary(changes: Change[]) {
  const n = (c: Change) => changes.filter(x => x === c).length
  return (['added', 'updated', 'removed', 'unspecified'] as Change[]).filter(c => n(c)).map(c => `${n(c)} ${changeMeta[c].label.toLowerCase()}`).join(' · ')
}
