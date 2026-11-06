// Run from the repository root with the model fixture registered through GROUNDWORK_WORKSPACES.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

import { entryFlowPageOf } from '../../../../src/application/entry-flow-page.ts';
import { entryFlowOf } from '../../../../src/application/entry-flow.ts';
import { indexOf } from '../../../../src/application/model-index.ts';
import { modelCounts } from '../../../../src/application/model-map.ts';
import { plansIndex } from '../../../../src/application/plans-index.ts';
import { readModelPlans } from '../../../../src/infrastructure/model-plans.ts';
import { readModel } from '../../../../src/infrastructure/read-model.ts';
import { validateModel } from '../../../../src/infrastructure/validate-model.ts';

const model = await readModel('model-fixture');
assert.ok(model);
const plans = await readModelPlans(model.id);
const overlay = plansIndex(plans, model).plans[0];
assert.ok(overlay);
assert.deepEqual(await validateModel(model), []);
assert.deepEqual(await validateModel(overlay.after), []);
const before = entryFlowPageOf(model, plans, { id: 'api-confirm', plan: 'plan-confirm', version: 'before' });
const after = entryFlowPageOf(model, plans, { id: 'api-confirm', plan: 'plan-confirm', version: 'after' });
assert.ok(before?.flow && after?.flow);
for (const page of [before, after]) {
  const encoded = JSON.stringify(page);
  assert.deepEqual(JSON.parse(encoded), page);
}
function visit(values) { return values.flatMap(node => [node, ...node.branches.flatMap(branch => visit(branch.nodes))]); }
function nodes(flow) {
  return flow.handlers.flatMap(handler => [...visit(handler.nodes), ...handler.failures]);
}
for (const node of nodes(before.flow)) if (node.branches.length === 0) assert.ok(node.citations.length > 0, node.id);
const external = entryFlowOf(indexOf(model), 'api:charge');
assert.equal(external?.component, 'Payments (external)');
assert.ok(external.gaps.includes('api:charge: No handler detail is recorded.'));
const output = {
  fixture: 'Handwritten synthetic examples, not claims about a company.',
  before: { counts: modelCounts(indexOf(model)), selectedFlowBytes: Buffer.byteLength(JSON.stringify(before)), nodeIds: nodes(before.flow).map(node => node.id), failure: before.flow.handlers[0].failures[0].detail },
  after: { counts: modelCounts(overlay.afterIndex), selectedFlowBytes: Buffer.byteLength(JSON.stringify(after)), nodeIds: nodes(after.flow).map(node => node.id), failure: after.flow.handlers[0].failures[0].detail },
  serialisableRoundTrip: true, allLeavesCited: true, beforeAndAfterValidate: true,
  explicitDrills: nodes(before.flow).filter(node => node.drill !== null).map(node => ({ site: node.id, ...node.drill })),
  externalCall: external,
  unknownJob: entryFlowOf(indexOf(model), 'job:unknown'),
};
await writeFile('artifacts/rebuild/verification/pr5/model-proof.json', `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ before: output.before.counts, after: output.after.counts, bytes: [output.before.selectedFlowBytes, output.after.selectedFlowBytes], externalProvider: external.component, allLeavesCited: true, validated: true }));
