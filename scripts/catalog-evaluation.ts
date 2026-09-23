import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { readPlan } from '../server/repository.ts'
import { queryCatalog } from '../server/catalog.ts'
import { initialise } from '../server/setup.ts'
import { migrateCatalog } from '../server/catalog-migration.ts'
import { operate } from '../server/operations.ts'
import { catalogId } from '../src/data/catalog-identity.ts'
const root = process.argv[2]
if (!root) throw new Error('Usage: node scripts/catalog-evaluation.ts <Commercial Backbone catalog root>')
const cases = [
  { question: 'MSRP', expected: 'gpe-price/endpoint/post-api-v5-prices-calculate-msrp' },
  { question: 'manufacturer suggested retail price without discounts', expected: 'gpe-price/endpoint/post-api-v5-prices-calculate-msrp' },
  { question: 'upload full features file processing storage Kafka', expected: 'product-configuration-facade/flow/full-features-upload' },
  { question: 'consume tax update queue invalidation', expected: 'price-event-dispatcher/flow/consume-tax-update' },
  { question: 'process pending cache invalidations', expected: 'price-event-dispatcher/job/process-cache-invalidations' },
  { question: 'market authorization fields', expected: 'product-configuration-facade/message/market-authorization-blob-event' },
  { question: 'price', ambiguous: true }, { question: 'quantum payroll', missing: true },
]
const results = []
for (const scenario of cases) {
  const started = performance.now(), plan = await readPlan(root)
  const response = queryCatalog(plan, 'get_discovery_context', { question: scenario.question, limit: 5 })
  const readAndQueryMs = performance.now() - started, warmStart = performance.now()
  queryCatalog(plan, 'get_discovery_context', { question: scenario.question, limit: 5 })
  const items = response.items as { id: string; componentId: string; name: string }[]
  if (scenario.expected) assert.ok(items.some(item => item.id.endsWith('/' + scenario.expected)), scenario.question)
  if (scenario.missing) assert.equal(response.total, 0)
  if (scenario.ambiguous) assert.ok(new Set(items.map(item => item.componentId)).size > 1)
  assert.ok(Buffer.byteLength(JSON.stringify(response)) <= 32768)
  assert.match(response.uncertainty, /do not prove absence/)
  results.push({ question: scenario.question, readAndQueryMs: +readAndQueryMs.toFixed(1), reusedProjectionQueryMs: +(performance.now() - warmStart).toFixed(1), bytes: Buffer.byteLength(JSON.stringify(response)), totalCandidates: response.totalCandidates, omitted: response.omitted, firstFive: items.map(item => ({ id: item.id, name: item.name })) })
}
const plan = await readPlan(root)
const copy = await mkdtemp(path.join(os.tmpdir(), 'groundwork-planning-evaluation-'))
await initialise(copy, { files: plan.files })
const migration = await migrateCatalog(copy, {})
await migrateCatalog(copy, { dryRun: false, expectedRevision: migration.expectedRevision, expectedContext: migration.expectedContext })
const scenarios = [
  { id: 'eval-upload-correlation', title: 'Evaluation: carry upload correlation across storage and messaging', component: 'product-configuration-facade', endpoint: 'http-full-features-upload', flow: 'full-features-upload', assumptions: ['The proposed correlation field and compatibility policy require product agreement.', 'Existing blob/message consumers and retention behavior must be inspected before finalizing the change.'], discovery: 'Inspect upload parsing, Blob storage metadata and Kafka payload; identify all consumers and schema compatibility constraints.', implementation: 'After discovery, add the agreed optional correlation field through request handling, persistence and message publication; preserve existing clients.', proof: 'Exercise the upload API against real Blob/Kafka test infrastructure; verify propagation and old-client compatibility, including malformed input and publish failure.', rollout: 'Use additive optional fields first; deploy compatible readers before writers, retain old payload support and test rollback without dropping stored records.' },
  { id: 'eval-msrp-policy', title: 'Evaluation: introduce an explicit MSRP pricing policy', component: 'gpe-price', endpoint: 'post-api-v5-prices-calculate-msrp', flow: 'calculate-msrp', assumptions: ['The desired pricing rule, eligible markets and authoritative owner require product agreement.', 'Remote Pretax, tax and configuration behavior is outside the retained local trace.'], discovery: 'Inspect MSRP mapping and calculator defaults, configuration/market policy and boundary tests; confirm compatibility with Pretax and tax services.', implementation: 'Implement the agreed policy behind an explicit configuration gate; preserve current defaults and keep discount behavior intentional.', proof: 'Exercise the MSRP API with representative market and validity-date cases; verify price projections, tax calls, failure behavior and disabled-policy compatibility.', rollout: 'Stage by market with a configuration rollback; compare expected financial results before widening. No policy is approved by this evaluation.' },
]
const exercises = []
for (const scenario of scenarios) {
  let current = await readPlan(copy)
  const component = current.snapshot.components.find(item => item.id === scenario.component)!
  await operate('create_feature', { id: scenario.id, title: scenario.title, productId: component.productId, ownerId: current.snapshot.members[0].id, problem: 'Hypothetical evaluation only: test evidence-backed planning without publishing a real feature.', outcome: scenario.title, expectedRevision: current.revision, expectedContext: current.context.token }, copy)
  current = await readPlan(copy)
  const baseline: any = await operate('retain_discovery_baseline', { featureId: scenario.id, question: scenario.title, ids: [catalogId(current.manifest.id, component.id, 'endpoint', scenario.endpoint), catalogId(current.manifest.id, component.id, 'flow', scenario.flow)], assumptions: scenario.assumptions, expectedRevision: current.revision, expectedContext: current.context.token }, copy)
  current = await readPlan(copy)
  await operate('plan_delivery', { featureId: scenario.id, expectedRevision: current.revision, expectedContext: current.context.token, delivery: {
    deliverables: [{ id: 'outcome', title: scenario.title, status: 'planned', componentIds: [component.id], acceptance: [scenario.proof, scenario.rollout] }],
    tasks: [{ id: 'discovery', deliverableId: 'outcome', componentId: component.id, title: 'Resolve critical unknowns', status: 'planned', scope: [scenario.discovery], acceptance: ['Record source evidence and update assumptions before implementation.'] }, { id: 'implementation', deliverableId: 'outcome', componentId: component.id, title: 'Implement agreed behavior', status: 'blocked', dependsOn: ['discovery'], scope: [scenario.implementation], prerequisites: scenario.assumptions, acceptance: [scenario.proof] }],
    validation: [{ id: 'boundary', level: 'component-integration', taskId: 'implementation', title: scenario.proof, entryPoint: scenario.endpoint, notes: 'Planned validation only; exact infrastructure and commands are chosen after discovery.' }, { id: 'journey', level: 'end-to-end', deliverableId: 'outcome', title: 'Verify the connected result and rollback', notes: scenario.rollout }],
  } }, copy)
  current = await readPlan(copy)
  await operate('assess_feature_discovery', { featureId: scenario.id, baselineId: baseline.baselineId, expectedRevision: current.revision, expectedContext: current.context.token }, copy)
  exercises.push({ id: scenario.id, baselineId: baseline.baselineId, state: 'Evaluation draft; implementation blocked on explicit hypothetical requirements and discovery. No tests were executed against source systems.' })
}
const report = { checkedAt: new Date().toISOString(), sourceCatalogRevision: plan.revision, results, planningCopy: copy, exercises, limitations: 'Single local sample. Reused projection is not a persistent cache; no end-to-end agent speedup is claimed. Source implementations were not executed. Broad text queries still include irrelevant candidates. The production catalog has no evaluation features.' }
await writeFile(path.join(copy, 'evaluation.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
