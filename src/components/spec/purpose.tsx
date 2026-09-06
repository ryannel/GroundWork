import type { Purpose } from '@/data/spec'
import { Circle, Ban } from 'lucide-react'
import { RefChip } from './refs'
import { useFocus } from './context'
import { cn } from '@/lib/cn'

function Criterion({ c, focus }: { c: NonNullable<Purpose['success']>[number]; focus?: string }) {
  const f = useFocus<HTMLLIElement>(c.id, focus)
  const tests = c.tests ?? []
  return (
    <li ref={f} className={cn('-mx-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-sm border border-transparent px-2 py-1 text-small', focus === c.id && 'focus-flash')}>
      <span className="flex gap-2"><Circle className={cn('mt-0.5 size-3.5 shrink-0', tests.length ? 'text-info' : 'text-warning')} />{c.text}</span>
      {tests.length > 0 && <span className="flex flex-wrap gap-x-1.5">{tests.map(t => <RefChip key={t} r={{ kind: 'tests', id: t }} />)}</span>}
    </li>
  )
}

const Label = ({ children }: { children: string }) => <div className="mb-1.5 text-small font-medium text-fg-muted">{children}</div>

export function PurposeSection({ data, focus }: { data: Purpose; focus?: string }) {
  const proven = (data.success ?? []).filter(c => c.tests?.length).length
  return (
    <div className="grid gap-8">
      <div className="grid gap-5 md:grid-cols-2">
        <div><Label>Problem</Label><p className="max-w-prose leading-relaxed">{data.problem}</p></div>
        <div><Label>Outcome</Label><p className="max-w-prose leading-relaxed">{data.outcome}</p></div>
      </div>
      {(data.success || data.nonGoals) && (
        <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
          {data.success && (
            <div>
              <div className="mb-1.5 flex items-baseline gap-2">
                <span className="text-small font-medium text-fg-muted">Success looks like</span>
                <span className={cn('text-small', proven < data.success.length ? 'text-warning' : 'text-fg-subtle')}>{proven} of {data.success.length} linked to a test</span>
              </div>
              <ul className="grid gap-0.5">{data.success.map(c => <Criterion key={c.id} c={c} focus={focus} />)}</ul>
            </div>
          )}
          {data.nonGoals && (
            <div>
              <Label>Out of scope</Label>
              <ul className="grid gap-1.5">{data.nonGoals.map(s => <li key={s} className="flex gap-2 text-small text-fg-muted"><Ban className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" />{s}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
