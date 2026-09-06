import { useState } from 'react'
import { Info } from 'lucide-react'

const regions = { '—': null, DE: 0.19, FR: 0.2, 'US-CA': 0.0725, 'US-OR': 0 } as const
const lines = [{ name: 'Wool overshirt', cat: 'apparel', net: 129 }, { name: 'Field notebook', cat: 'stationery', net: 14 }]

/** Minimal working mock of the cart totals block, showing the placeholder → computed transition and the disclosure. */
export function TaxCartTotals() {
  const [region, setRegion] = useState<keyof typeof regions>('—')
  const [open, setOpen] = useState(false)
  const rate = regions[region]
  const sub = lines.reduce((n, l) => n + l.net, 0)
  const tax = rate === null ? null : Math.round(sub * rate * 100) / 100
  const fmt = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'EUR' })
  return (
    <div className="mx-auto max-w-sm rounded-md border border-border bg-(--bg) p-4 text-[13px]">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-medium">Your cart</span>
        <label className="flex items-center gap-2 text-fg-muted">
          Deliver to
          <select value={region} onChange={e => setRegion(e.target.value as keyof typeof regions)} className="rounded-sm border border-border bg-transparent px-1.5 py-0.5">
            {Object.keys(regions).map(r => <option key={r}>{r}</option>)}
          </select>
        </label>
      </div>
      <ul className="divide-y divide-border">
        {lines.map(l => (
          <li key={l.name} className="flex justify-between py-2">
            <span>{l.name}<span className="ml-2 text-fg-subtle">{l.cat}</span></span>
            <span className="tabular-nums">{fmt(l.net)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 space-y-1 border-t border-border pt-2">
        <div className="flex justify-between text-fg-muted"><span>Subtotal</span><span className="tabular-nums">{fmt(sub)}</span></div>
        <div className="flex justify-between text-fg-muted">
          <button onClick={() => tax !== null && setOpen(o => !o)} className="flex items-center gap-1 disabled:opacity-100" disabled={tax === null}>
            Tax {tax !== null && <Info className="size-3" />}
          </button>
          <span className="tabular-nums">{tax === null ? <span className="text-fg-subtle">calculated at checkout</span> : fmt(tax)}</span>
        </div>
        {open && tax !== null && (
          <div className="rounded-sm border border-border bg-(--glass-fill-2) px-2 py-1.5 text-[12px] text-fg-muted">
            {region} standard rate {(rate! * 100).toFixed(2).replace(/\.?0+$/, '')}% applied to all lines. Rule <code className="font-mono">r_{region.toLowerCase()}_std</code>.
          </div>
        )}
        <div className="flex justify-between pt-1 font-medium"><span>Total</span><span className="tabular-nums">{fmt(sub + (tax ?? 0))}</span></div>
      </div>
    </div>
  )
}
