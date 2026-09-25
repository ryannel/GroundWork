import { useSpec, refHref } from './context'
import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import type { SectionKind } from '@shared/spec'
import { refLabel, type Ref } from '@shared/spec-index'
import { Tooltip } from '@/ui/tooltip'
import { cn } from '@/lib/cn'

/** One-line note for a filtered section. */
export function LensNote({ shown, total, kind }: { shown: number; total: number; kind: string }) {
  const { lensName } = useSpec()
  if (!lensName) return null
  return <span className="text-fg-subtle">{shown === 0 ? `nothing here touches ${lensName}` : `${shown} of ${total} ${kind} touch ${lensName}`}</span>
}

const isIdent = (k: SectionKind) => k === 'api' || k === 'storage' || k === 'tests'

/**
 * A link to one item in another section. Plain text: mono when the target is an identifier
 * (a path, a table, a test id), sans otherwise. Colour and borders are reserved for state.
 */
export function RefChip({ r, className, href, title }: { r: Ref; className?: string; href?: string; title?: string }) {
  const { featureId, ix } = useSpec()
  const [params] = useSearchParams()
  const trace = params.get('trace')
  const action = trace?.startsWith('journey:') ? ix.step[trace.slice(8)] : undefined
  const nextTrace = r.kind === 'journey'
    ? ix.step[r.id]?.flow?.length ? `journey:${r.id}` : undefined
    : action && (r.kind !== 'flow' || action.flow?.includes(r.id)) ? trace : undefined
  const actionQuery = nextTrace ? `?trace=${encodeURIComponent(nextTrace)}` : ''
  const got = refLabel(ix, r)
  if (!got) return null
  const l = title ? { ...got, title } : got
  const link = (
    <Link
      to={href ?? `${refHref(featureId, r)}${actionQuery}`}
      className={cn('text-fg-muted underline-offset-2 transition-colors hover:text-fg hover:underline', isIdent(r.kind) && 'font-mono text-[12px]', className)}
    >
      {l.title}
    </Link>
  )
  return l.sub ? <Tooltip label={l.sub}>{link}</Tooltip> : link
}

/** Gap marker: a thing that ought to be covered and is not. The one class of metadata that earns colour. */
export function Gap({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 text-[12px] text-warning', className)}><AlertTriangle className="size-3" />{children}</span>
}

/** A labelled group of refs. Empty groups are dropped; `warn` renders a gap in place of an empty group. */
export interface RefGroup { label: string; refs: Ref[]; warn?: string; render?: { href?: string; title?: string } }
const Sep = () => <span className="text-fg-subtle/60 select-none">·</span>
function Refs({ g }: { g: RefGroup }) {
  return (
    <>
      {g.refs.map((r, i) => (
        <span key={`${r.kind}:${r.id}`} className="inline-flex items-center gap-1.5">
          {i > 0 && <Sep />}
          <RefChip r={r} href={g.render?.href} title={g.render?.title} />
        </span>
      ))}
      {!g.refs.length && g.warn && <Gap>{g.warn}</Gap>}
    </>
  )
}

/** Labelled rows of refs. Full detail; used when an item is expanded or has room. */
export function RefRow({ groups, className, cols }: { groups: RefGroup[]; className?: string; cols?: 1 | 2 }) {
  const shown = groups.filter(g => g.refs.length || g.warn)
  if (!shown.length) return null
  return (
    <dl className={cn('grid gap-x-8 gap-y-1.5 text-small', cols === 2 ? 'sm:grid-cols-2' : '', className)}>
      {shown.map(g => (
        <div key={g.label} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <dt className="w-20 shrink-0 text-fg-subtle">{g.label}</dt>
          <dd className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5"><Refs g={g} /></dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * The connections of one item, collapsed to a single muted line: every target in reading order,
 * gaps in colour, and a count that expands to the labelled rows. Truncates rather than wraps so an
 * item's height is set by its content, not its metadata.
 */
export function Links({ groups, className, trailing }: { groups: RefGroup[]; className?: string; trailing?: ReactNode }) {
  const shown = groups.filter(g => g.refs.length || g.warn)
  const n = shown.reduce((a, g) => a + g.refs.length, 0)
  if (!shown.length && !trailing) return null
  return <div className={className}>
    {shown.length > 0 && <details className="connection-details">
      <summary>Explore {n} connection{n === 1 ? '' : 's'} · {shown.map(g => g.label.toLowerCase()).join(', ')}</summary>
      <RefRow groups={groups} cols={2} />
    </details>}
    {trailing && <div className="mt-3 text-small text-accent">{trailing}</div>}
  </div>
}
