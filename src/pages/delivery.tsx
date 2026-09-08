import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Layers, CheckCircle2, FlaskConical } from 'lucide-react'
import { useRuntime } from '@/data/runtime'
import { q } from '@/data/store'
import { deliveryGaps, validationResult, type Delivery, type Deliverable, type Task, type Validation } from '@/data/delivery'

function InlineText({ text }: { text: string }) {
  return <>{text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part)}</>
}
function BulletList({ values }: { values: string[] }) {
  return values.length ? <ul>{values.map((value, i) => <li key={i}><InlineText text={value} /></li>)}</ul> : null
}
function CheckPlan({ check, delivery, featureId }: { check: Validation; delivery: Delivery; featureId: string }) {
  const { result, evidence } = validationResult(delivery, check)
  const feature = q.features().find(f => f.id === featureId)
  return <article className="validation-plan">
    <div className="validation-heading"><strong>{check.title}</strong><span className={`validation-result result-${result}`}>{evidence ? `Latest run: ${result}` : 'No run recorded'}</span></div>
    <p>{check.level === 'end-to-end' ? 'End-to-end · connected system' : check.level === 'component-integration' ? 'Honeycomb · component boundary' : 'Unit · isolated logic'}</p>
    <dl><dt>Entry point</dt><dd>{check.entryPoint ?? 'Not specified'}</dd><dt>Environment</dt><dd>{check.environment ?? 'Not specified'}</dd><dt>Test file</dt><dd><code>{check.file ?? 'Not specified'}</code></dd><dt>Run</dt><dd><code>{check.command ?? 'Not specified'}</code></dd></dl>
    <div className="test-topology"><span>Run for real: {check.realDependencyIds.map(id => q.componentLabel(id)).join(', ') || 'Not specified'}</span><span>Substituted at the boundary: {check.substitutedDependencyIds.map(id => q.componentLabel(id)).join(', ') || 'None declared'}</span></div>
    {check.testIds.length > 0 && <details><summary>{check.testIds.length} linked behavioural scenarios</summary><ul>{check.testIds.map(id => <li key={id}><Link to={`/f/${featureId}/tests/${id}`}>{feature?.spec?.tests?.cases.find(t => t.id === id)?.title ?? id}<ArrowRight size={12} /></Link></li>)}</ul></details>}
    {check.notes && <p className="validation-note">{check.notes}</p>}
    {evidence && <div className="validation-evidence"><strong>Latest recorded evidence</strong><p>{evidence.description}</p><small>{evidence.recordedAt}{evidence.testedRevision && ` · Revision ${evidence.testedRevision}`}{evidence.environment && ` · ${evidence.environment}`}</small>{evidence.reference && <p>{evidence.reference}</p>}</div>}
  </article>
}
function Readiness({ delivery, unit }: { delivery: Delivery; unit: Deliverable | Task }) {
  const gaps = deliveryGaps(delivery, unit)
  return gaps.length ? <details className="delivery-gaps"><summary>{gaps.length} delivery {gaps.length === 1 ? 'gap' : 'gaps'}{unit.status === 'done' ? ' · declared done still needs proof' : ''}</summary><BulletList values={gaps} /></details> : <p className="delivery-proven"><CheckCircle2 size={14} />Planned checks have passing evidence recorded</p>
}
function Status({ unit }: { unit: { status: string } }) {
  return <div className="delivery-status"><span>Declared status</span><strong>{unit.status.replaceAll('-', ' ')}</strong></div>
}
function TaskCard({ task, delivery, featureId }: { task: Task; delivery: Delivery; featureId: string }) {
  const checks = delivery.validation.filter(v => v.level !== 'end-to-end' && v.taskId === task.id)
  const spec = q.features().find(f => f.id === featureId)?.spec
  const dependencies = [...delivery.tasks, ...delivery.deliverables, ...delivery.undecomposedTasks]
  return <details className="component-task" id={task.id}>
    <summary><span className="task-summary"><span className="task-meta"><span className="task-component">Task · {q.componentLabel(task.componentId)}</span><code className="task-reference" aria-label={`Task ID: ${task.id}`}>{task.id}</code></span><strong>{task.title}</strong>{task.summary && <span className="task-description">{task.summary}</span>}</span><span className="task-state">{task.status.replaceAll('-', ' ')}</span></summary>
    <div className="task-body">
    {task.acceptance.length > 0 && <><h5>Done when</h5><BulletList values={task.acceptance} /></>}
    <details className="task-scope"><summary>Implementation details · {task.scope.length} {task.scope.length === 1 ? 'item' : 'items'}</summary><BulletList values={task.scope} />{!task.scope.length && <p>Component scope not defined.</p>}</details>
    {task.dependsOn.length > 0 && <p className="task-dependencies">After: {task.dependsOn.map(id => dependencies.find(d => d.id === id)?.title ?? id).join(' → ')}</p>}
    {task.prerequisites.length > 0 && <details><summary>Build and integration prerequisites</summary><BulletList values={task.prerequisites} /></details>}
    <h5>API and event boundaries</h5><div className="task-contracts">{task.contractIds.map(id => <Link key={id} to={`/f/${featureId}/api/${id}`}>{spec?.api?.contracts.find(c => c.id === id)?.name ?? id}<ArrowRight size={12} /></Link>)}{!task.contractIds.length && <p>No public contracts linked yet.</p>}</div>
    <h5>Component validation</h5>{checks.map(check => <CheckPlan key={check.id} check={check} delivery={delivery} featureId={featureId} />)}{!checks.length && <p className="delivery-missing">Plan tests through the public API into real component logic and infrastructure. Reserve unit tests for complex isolated logic.</p>}
    <Readiness delivery={delivery} unit={task} />
    {delivery.branches.filter(b => b.taskId === task.id).map(b => <p key={b.branch} className="task-dependencies">Branch: <code>{b.branch}</code></p>)}
    </div>
  </details>
}
export function DeliveryPage({ embedded = false }: { embedded?: boolean }) {
  const { id } = useParams()
  const { plan } = useRuntime()
  if (!plan) return <div className="runtime-start">Delivery is available for repository plans.</div>
  const features = plan.snapshot.features.filter(f => !id || f.id === id)
  const linked = new Set(Object.values(plan.delivery).flatMap(d => d.branches.map(b => b.branch)))
  return <div className={embedded ? "delivery-board delivery-embedded" : "delivery-board"}>
    {embedded ? <header className="section-intro"><div><p className="eyebrow">05 · Deliver</p><h2>Deliverables & tasks</h2><p>Prove the user outcome end to end. Build and validate each component at its boundary.</p></div></header> : <header><p className="board-eyebrow">{plan.manifest.name} / {id ? features[0]?.title ?? 'Feature' : 'Delivery'}</p><h1>From feature to working software<span>.</span></h1><p>Prove the user outcome end to end. Build and validate each component at its boundary.</p>{id && <Link className="delivery-back" to={`/f/${id}`}>← Back to feature plan</Link>}</header>}
    <div className="delivery-grid"><section aria-label="Deliverables and component tasks">{features.map(feature => {
      const delivery = plan.delivery[feature.id]
      return <section className="feature-delivery" key={feature.id}>
        <div className="feature-delivery-heading"><div><p className="board-eyebrow">Feature</p><h3>{id ? feature.title : <Link to={`/f/${feature.id}/delivery`}>{feature.title}</Link>}</h3></div><span>{delivery?.deliverables.length ?? 0} deliverables</span></div>
        {!!delivery?.deliverables.length && <p className="delivery-guide">Each deliverable is a user outcome. Open one to see the tasks that build it and the tests that prove it.</p>}
        {(!delivery || !delivery.deliverables.length) && <div className="central-empty"><h3>Shape the delivery</h3><p>Start with the smallest outcome a user can experience. Name the components that must work together, then define small tasks for each independently testable behavior within those components.</p><p>Your coding agent can author the deliverable, tasks, and validation plans in this feature’s delivery.json using the Groundwork guide.</p></div>}
        {delivery?.deliverables.map((deliverable, index) => {
          const tasks = delivery.tasks.filter(s => s.deliverableId === deliverable.id)
          const checks = delivery.validation.filter(v => v.level === 'end-to-end' && v.deliverableId === deliverable.id)
          return <details className="deliverable-card" key={deliverable.id} open={index === 0}>
            <summary><span className="deliverable-summary"><span className="delivery-kind">Deliverable {String(index + 1).padStart(2, '0')}</span><strong>{deliverable.title.replace(/^\d+[ .·:-]+/, '')}</strong><small>{tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} · {checks.length} end-to-end {checks.length === 1 ? 'check' : 'checks'}</small></span><span className="deliverable-state">{deliverable.status}</span></summary>
            <div className="deliverable-body"><div className="deliverable-outcome"><div><p className="board-eyebrow">User-visible value</p><h3>{deliverable.outcome ?? 'Define the outcome this deliverable unlocks for the user.'}</h3></div><Status unit={deliverable} /></div>
              <div className="deliverable-chain">Across {deliverable.componentIds.map(cid => q.componentLabel(cid)).join(' · ') || 'components not yet defined'}</div>
              {deliverable.dependsOn.length > 0 && <p className="task-dependencies">After: {deliverable.dependsOn.map(mid => delivery.deliverables.find(m => m.id === mid)?.title ?? mid).join(', ')}</p>}
              <details className="deliverable-acceptance"><summary>Deliverable acceptance · {deliverable.acceptance.length} outcomes</summary><BulletList values={deliverable.acceptance} /></details>
              <div className="delivery-subheading"><Layers size={16} /><h4>Tasks</h4><small>{tasks.length}</small></div>{tasks.map(task => <TaskCard key={task.id} task={task} delivery={delivery} featureId={feature.id} />)}
              {!tasks.length && <p className="delivery-missing">No component tasks defined yet.</p>}
              <details className="deliverable-proof"><summary>End-to-end proof · {checks.length} {checks.length === 1 ? 'check' : 'checks'}</summary>
              <div className="delivery-subheading"><FlaskConical size={16} /><h4>End-to-end proof</h4></div>{checks.map(check => <CheckPlan key={check.id} check={check} delivery={delivery} featureId={feature.id} />)}{!checks.length && <p className="delivery-missing">No end-to-end validation planned. Passing individual tasks does not prove the connected user journey.</p>}
              </details>
              <Readiness delivery={delivery} unit={deliverable} />
            </div>
          </details>
        })}
        {!!delivery?.undecomposedTasks.length && <details className="legacy-delivery"><summary>{delivery.undecomposedTasks.length} earlier tasks · component decomposition needed</summary><p>These records remain intact. Map implementation work to a component task before treating it as delivery proof.</p>{delivery.undecomposedTasks.map(task => <div key={task.id}><strong>{task.title}</strong><small> · {task.status}</small><BulletList values={task.acceptance} /></div>)}</details>}
        {!!delivery?.evidence.filter(e => !e.validationId).length && <details className="legacy-delivery"><summary>Unlinked evidence and source records</summary><p>These records are preserved but do not prove a deliverable or task validation plan.</p>{delivery.evidence.filter(e => !e.validationId).map(e => <p key={e.id}><strong>{e.result}</strong> · {e.description}</p>)}</details>}
      </section>
    })}{!features.length && <div className="central-empty"><p>No feature plans yet.</p><p>Talk with your agent to plan a feature. Its deliverables and tasks will appear here.</p></div>}</section>
    <aside className="git-activity"><h2>Observed Git activity</h2><p>From the working checkout. A commit or a completed task does not prove the deliverable’s user outcome.</p><h3>Unlinked branches</h3>{plan.activity.branches.filter(branch => !linked.has(branch)).map(branch => <p key={branch}><code>{branch}</code></p>)}{!plan.activity.branches.length && <p>No branches found.</p>}<h3>Recent commits</h3>{plan.activity.commits.map(commit => <p key={commit}><code>{commit}</code></p>)}{!plan.activity.commits.length && <p>No commits yet.</p>}<h3>Working files</h3><pre>{plan.activity.changes.join('\n') || 'No changes reported.'}</pre><h3>Decisions</h3>{Object.entries(plan.decisions).map(([file, text]) => <details key={file}><summary>{file}</summary><pre>{text}</pre></details>)}{!Object.keys(plan.decisions).length && <p>No decisions recorded.</p>}</aside></div>
  </div>
}
