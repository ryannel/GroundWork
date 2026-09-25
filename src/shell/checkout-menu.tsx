import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { GitBranch, ChevronDown } from 'lucide-react'
import { useRuntime } from '@/data/runtime'

export function CheckoutMenu() {
  const { plan, mode, connected } = useRuntime()
  const menu = useRef<HTMLDetailsElement>(null)
  if (!plan) return null
  const { context, activity } = plan
  const branchHref = (ref?: string) => `/p/${context.checkoutId}${ref ? `/ref/${encodeURIComponent(ref)}` : ''}/`
  return <details className="checkout-menu" ref={menu} onKeyDown={event => {
    if (event.key === 'Escape') { menu.current!.open = false;
      menu.current?.querySelector('summary')?.focus() }
  }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false }}>
    <summary aria-label="Checkout details">
      <GitBranch size={14} />
      <span>{context.ref ?? context.branch ?? (context.isGit ? 'Detached' : 'Local')}</span>
      {!context.editable && <small>Read-only</small>}
      {!connected && <small>Offline</small>}
      <ChevronDown size={12} />
    </summary>
    <div className="checkout-panel">
      <p className="eyebrow">{mode === 'central' ? 'Via Groundwork Hub' : 'Standalone viewer'}</p>
      <label>Plan version
        <select value={context.ref ?? ''} onChange={event => { window.location.href = branchHref(event.target.value || undefined) }}>
          <option value="">{context.branch ?? (context.isGit ? 'Detached HEAD' : 'No Git repository')} · working files</option>
          {activity.branches.map(branch => <option key={branch} value={branch}>{branch} · committed</option>)}
        </select>
      </label>
      <p>{context.editable ? 'Working files' : 'Read-only commit'} · {connected ? 'Live updates' : 'Reconnecting…'}</p>
      <p className="checkout-location">{context.root}</p>
      <Link to="/delivery" onClick={() => { menu.current!.open = false }}>Delivery & activity →</Link>
    </div>
  </details>
}
