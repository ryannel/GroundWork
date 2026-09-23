import { useState } from 'react'
import type { Tests, TestCase, TestStatus } from '@/data/spec'
import type { Ref } from '@/data/spec-index'
import { useQuery } from '@/data/store'
import { invert } from '@/data/view-models'
import { Badge } from '@/ui/badge'
import { Tooltip } from '@/ui/tooltip'
import { cn } from '@/lib/cn'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { Links, LensNote, RefChip, Gap } from './refs'
import { useFocus, useLens, useSpec } from './context'

const status: Record<TestStatus, { label: string; tone: 'neutral' | 'info' | 'success' | 'danger'; dot: string }> = {
  planned: { label: 'Planned', tone: 'neutral', dot: 'bg-fg-subtle' },
  written: { label: 'Written', tone: 'info', dot: 'bg-info' },
  passing: { label: 'Passing', tone: 'success', dot: 'bg-success' },
  failing: { label: 'Failing', tone: 'danger', dot: 'bg-danger' },
}

function Case({ c, focus }: { c: TestCase; focus?: string }) {
  const q = useQuery()
  const { ix, featureId } = useSpec()
  const [params] = useSearchParams()
  const trace = params.get('trace')
  const action = trace?.startsWith('journey:') && c.steps?.includes(trace.slice(8)) ? trace : `tests:${c.id}`
  const f = useFocus(c.id, focus)
  const st = status[c.status ?? 'planned']
  const spans = ix.testSpans[c.id] ?? []
  return (
    <div ref={f} className={cn('overflow-hidden rounded-md border border-border', focus === c.id && 'focus-flash')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border bg-(--glass-fill-2) px-4 py-2.5">
        <code className="font-mono text-[12px] text-fg-subtle">{c.id}</code>
        <span className="font-medium">{c.title}</span>
        <span className="ml-auto flex items-center gap-3">
          <span className="hidden font-mono text-[11px] text-fg-subtle md:inline">{spans.map(s => q.componentLabel(s)).join(' → ')}</span>
          <Badge tone={st.tone}>{st.label}</Badge>
        </span>
      </div>
      <div className="grid gap-3 px-4 py-3">
        <dl className="grid gap-x-4 gap-y-1.5 text-small sm:grid-cols-[48px_1fr]">
          <dt className="text-fg-subtle">Given</dt><dd>{c.given}</dd>
          <dt className="text-fg-subtle">When</dt><dd>{c.when}</dd>
          <dt className="text-fg-subtle">Then</dt>
          <dd><ul className="grid gap-0.5">{c.then.map(t => <li key={t} className="flex gap-2"><span className="text-fg-subtle">–</span>{t}</li>)}</ul></dd>
        </dl>
        <Links
          groups={[
            { label: 'Criteria', refs: (ix.testCriteria[c.id] ?? []).map(id => ({ kind: 'purpose', id })) },
            { label: 'Steps', refs: (c.steps ?? []).map(id => ({ kind: 'journey', id })) },
            { label: 'Contracts', refs: (c.contracts ?? []).map(id => ({ kind: 'api', id })) },
            { label: 'Tables', refs: (c.tables ?? []).map(id => ({ kind: 'storage', id })) },
          ]}
          trailing={ix.testNodes[c.id]?.length > 0 && <Link to={`/f/${featureId}/flow?trace=${encodeURIComponent(action)}`} className="hover:text-fg">Open related system flow →</Link>}
        />
      </div>
    </div>
  )
}

/**
 * Coverage: everything a test can prove (criteria, steps, contracts, tables) against the tests that
 * prove it. The single place gaps are listed; items elsewhere only carry a marker.
 */
function Coverage({ cases }: { cases: TestCase[] }) {
  const { ix, spec, featureId } = useSpec()
  const [open, setOpen] = useState(true)
  const critTests = invert(ix.testCriteria)
  const rows: { group: string; r: Ref; tests: string[] }[] = [
    ...(spec.purpose?.success ?? []).map(c => ({ group: 'Criteria', r: { kind: 'purpose' as const, id: c.id }, tests: critTests.get(c.id) ?? [] })),
    ...(spec.journey?.steps ?? []).map(s => ({ group: 'Steps', r: { kind: 'journey' as const, id: s.id }, tests: ix.stepTests[s.id] ?? [] })),
    ...(spec.api?.contracts ?? []).filter(c => c.change !== 'removed').map(c => ({ group: 'Contracts', r: { kind: 'api' as const, id: c.id }, tests: ix.contractTests[c.id] ?? [] })),
    ...(spec.storage?.tables ?? []).filter(t => t.change !== 'removed').map(t => ({ group: 'Tables', r: { kind: 'storage' as const, id: t.id }, tests: ix.tableTests[t.id] ?? [] })),
  ]
  if (!rows.length) return null
  const gaps = rows.filter(r => !r.tests.length).length
  let lastGroup = ''
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <button aria-expanded={open} onClick={() => setOpen(o => !o)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-small hover:bg-(--glass-fill-2)">
        <span className="font-medium">Test links · all tests</span>
        <span className={gaps ? 'text-warning' : 'text-fg-subtle'}>{gaps ? `${gaps} without a test` : 'all items have a linked test'}</span>
        <ChevronDown className={cn('ml-auto size-4 text-fg-subtle transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="overflow-x-auto border-t border-border"><p className="px-4 py-3 text-small text-fg-muted">Dots show linked tests and their status. A link alone does not verify the item.</p>
          <table className="w-full text-small">
            <thead>
              <tr className="text-fg-subtle">
                <th className="w-24 px-4 py-1.5 text-left font-normal" />
                <th className="py-1.5 text-left font-normal" />
                {cases.map(c => (
                  <th key={c.id} className="w-11 px-1 py-1.5 text-center font-mono text-[11px] font-normal">
                    <Tooltip label={c.title}><Link to={`/f/${featureId}/tests/${c.id}`} className="hover:text-fg">{c.id.replace('E2E-', '')}</Link></Tooltip>
                  </th>
                ))}
                <th className="w-24 px-3 py-1.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(row => {
                const head = row.group !== lastGroup ? row.group : ''
                lastGroup = row.group
                return (
                  <tr key={`${row.r.kind}:${row.r.id}`} className={cn(head && 'border-t border-border')}>
                    <td className="px-4 py-1.5 align-top text-fg-subtle">{head}</td>
                    <td className="max-w-md truncate py-1.5 pr-3"><RefChip r={row.r} /></td>
                    {cases.map(c => (
                      <td key={c.id} className="px-1 py-1.5 text-center">
                        {row.tests.includes(c.id) && <span aria-label={status[c.status ?? 'planned'].label} title={status[c.status ?? 'planned'].label} className={cn('inline-block size-2 rounded-full', status[c.status ?? 'planned'].dot)} />}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right">{!row.tests.length && <Gap>no test</Gap>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function TestsSection({ data, focus }: { data: Tests; focus?: string }) {
  const lens = useLens('tests')
  const { ix, spec, featureId } = useSpec()
  const [params] = useSearchParams()
  const missing: Ref[] = [
    ...ix.unprovenCriteria.map(id => ({ kind: 'purpose' as const, id })),
    ...ix.untestedSteps.map(id => ({ kind: 'journey' as const, id })),
    ...ix.untestedContracts.map(id => ({ kind: 'api' as const, id })),
    ...(spec.storage?.tables ?? []).filter(t => t.change !== 'removed' && !ix.tableTests[t.id]?.length).map(t => ({ kind: 'storage' as const, id: t.id })),
  ]
  const cases = lens ? data.cases.filter(c => lens.has(c.id)) : data.cases
  const [filter, setFilter] = useState('all')
  const visible = focus ? cases : cases.filter(c => filter === 'all' || (c.status ?? 'planned') === filter)
  const counts = (Object.keys(status) as TestStatus[]).map(k => [k, cases.filter(c => (c.status ?? 'planned') === k).length] as const).filter(([, n]) => n)
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3 text-small text-fg-muted">
        <span>{cases.length} cases</span>
        {counts.map(([k, n]) => <span key={k} className="flex items-center gap-1.5"><span className={cn('size-1.5 rounded-full', status[k].dot)} />{n} {status[k].label.toLowerCase()}</span>)}
        <LensNote shown={cases.length} total={data.cases.length} kind="cases" />
      </div>
      {!lens && missing.length > 0 && <div className="rounded-md border border-warning-border bg-warning-bg p-4"><h3 className="text-small font-medium mb-2">Needs a linked test · {missing.length} coverage gap{missing.length === 1 ? '' : 's'}</h3><ul className="grid gap-2">{missing.map(r => <li key={`${r.kind}-${r.id}`} className="text-small"><RefChip r={r} /></li>)}</ul></div>}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter tests by status">{['all', ...Object.keys(status)].map(k => <button key={k} aria-pressed={!focus && filter === k} onClick={() => setFilter(k)} disabled={!!focus} className={cn('rounded-sm border border-border px-3 py-1.5 text-small', filter === k && !focus && 'bg-accent-soft text-accent')}>{k === 'all' ? 'All tests' : status[k as TestStatus].label}</button>)}</div>
      {focus && <p className="text-small text-fg-muted">Showing all tests to keep the linked scenario visible. <Link className="text-accent underline underline-offset-2" to={`/f/${featureId}/tests${params.size ? `?${params}` : ''}`}>Clear selection to filter tests</Link></p>}
      {!visible.length && <p className="text-small text-fg-muted py-4">No tests match this status and component scope.</p>}
      <div className="grid gap-3">{visible.map(c => <Case key={c.id} c={c} focus={focus} />)}</div>
      {!lens && <Coverage cases={data.cases} />}
    </div>
  )
}
