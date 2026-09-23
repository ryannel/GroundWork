import type { Change } from '@/data/spec'

/** The one vocabulary for change assessments: every badge, filter, legend and mark reads its label and glyph here. */
export const changeMeta: Record<Change, { label: string; glyph: string }> = {
  added: { label: 'Added', glyph: '+' },
  updated: { label: 'Changed', glyph: '~' },
  removed: { label: 'Removed', glyph: '−' },
  unchanged: { label: 'Unchanged', glyph: '=' },
  unspecified: { label: 'Not assessed', glyph: '?' },
}
