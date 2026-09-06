import { Link } from 'react-router-dom'
import type { Design, Mockup } from '@/data/spec'
import { ExternalLink, Frame, Image, PenLine, Play } from 'lucide-react'
import { mocks } from '@/mocks'
import { Badge } from '@/ui/badge'
import { cn } from '@/lib/cn'
import { RefChip } from './refs'
import { useFocus, useSpec } from './context'

const kindMeta: Record<Mockup['kind'], { label: string; icon: typeof Play }> = {
  live: { label: 'Live', icon: Play },
  wireframe: { label: 'Wireframe', icon: PenLine },
  figma: { label: 'Figma', icon: Frame },
  image: { label: 'Image', icon: Image },
}

export function MockupCard({ m, focus }: { m: Mockup; focus?: string }) {
  const { ix } = useSpec()
  const f = useFocus(m.id, focus)
  const k = kindMeta[m.kind]
  const Live = m.kind === 'live' ? mocks[m.ref] : undefined
  const steps = ix.mockupSteps[m.id] ?? []
  const placeholder = m.ref.includes('/placeholder/')
  return (
    <div ref={f} className={cn('overflow-hidden rounded-md border border-border', focus === m.id && 'focus-flash')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border bg-(--glass-fill-2) px-3 py-2">
        <Badge leading={<k.icon />} tone={m.kind === 'live' ? 'success' : 'neutral'}>{k.label}</Badge>
        <span className="font-medium">{m.title}</span>
        {steps.length > 0 && (
          <span className="flex items-center gap-1.5 text-small text-fg-subtle">
            <span className="hidden sm:inline">seen at</span>
            {steps.map(id => <RefChip key={id} r={{ kind: 'journey', id }} />)}
          </span>
        )}
        {m.kind !== 'live' && !placeholder && (
          <a href={m.ref} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 text-small text-fg-muted hover:text-fg">Open <ExternalLink className="size-3.5" /></a>
        )}
      </div>
      {Live ? (
        <div className="bg-[radial-gradient(var(--glass-border-1)_1px,transparent_1px)] bg-size-[16px_16px] p-4 sm:p-6"><Live /></div>
      ) : m.kind === 'image' && !placeholder ? (
        <a href={m.ref} target="_blank" rel="noreferrer" className="block bg-(--glass-fill-2) p-4"><img src={m.ref} alt={m.title} className="mx-auto h-auto max-h-[70vh] max-w-full object-contain" /></a>
      ) : (
        <div className="grid h-40 place-items-center text-small text-fg-subtle">{placeholder ? 'Design reference not attached yet' : `External ${k.label.toLowerCase()} · open the reference to explore`}</div>
      )}
      {m.note && <p className="border-t border-border px-3 py-2 text-small text-fg-muted">{m.note}</p>}
    </div>
  )
}

export function DesignSection({ data, focus }: { data: Design; focus?: string }) {
  const { featureId } = useSpec()
  const selected = data.mockups.find(m => m.id === focus) ?? data.mockups[0]
  if (!selected) return <p className="text-fg-muted">No screens have been attached yet.</p>
  return <div className="grid gap-5"><nav aria-label="Screens" className="flex flex-wrap gap-2">{data.mockups.map(m => <Link key={m.id} to={`/f/${featureId}/design/${m.id}`} aria-current={selected.id === m.id ? 'page' : undefined} className={cn('rounded-sm border px-4 py-2 text-small', selected.id === m.id ? 'border-accent bg-accent-soft text-accent' : 'border-border text-fg-muted')}>{m.title}</Link>)}</nav><MockupCard key={selected.id} m={selected} /></div>
}
