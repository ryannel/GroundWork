import { Link } from 'react-router-dom'
import { GitBranch, FolderGit2 } from 'lucide-react'
import { useRuntime } from '@/data/runtime'
export function RepositoryBar() {
  const { plan, mode, connected } = useRuntime()
  if (!plan) return mode === 'demo' ? <div className="repository-bar">Example content · Start the packaged server to view repository plans.</div> : null
  const { context, manifest, activity } = plan
  const branchHref = (ref?: string) => `/p/${context.checkoutId}${ref ? `/ref/${encodeURIComponent(ref)}` : ''}/`
  return <div className="repository-bar">
    {mode === 'central' && <a href="/">All projects</a>}
    <span><FolderGit2 size={15} />{manifest.name}</span>
    <label><GitBranch size={14} /><span className="sr-only">Plan version</span><select value={context.ref ?? ''} onChange={event => { window.location.href = branchHref(event.target.value || undefined) }}><option value="">{context.branch ?? (context.isGit ? 'Detached HEAD' : 'No Git repository')} · working checkout</option>{activity.branches.map(branch => <option key={branch} value={branch}>{branch} · committed</option>)}</select></label>
    <span className={context.editable ? 'context-editable' : 'context-readonly'}>{context.editable ? 'Working files' : 'Read-only commit'}</span>
    <span className="checkout-path" title={context.root}>{context.root}</span>
    <Link to="/delivery">Delivery & activity</Link>
    <span className="connection-state">{connected ? 'Live' : 'Reconnecting'}</span>
  </div>
}
